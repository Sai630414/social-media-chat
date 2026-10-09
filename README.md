# Circles — Social media with real-time chat

Circles is a JavaScript monorepo with a Vite/React client and an Express/Mongoose API. Supabase Auth owns identity and password handling; MongoDB stores application profiles and activity; Cloudinary stores binary media; Socket.IO carries authenticated conversation events.

## Project map

- `client/src`: React pages, reusable components, Supabase and Axios clients, and the Socket.IO provider.
- `server/src`: Express routes/controllers, validation, Mongoose models, Cloudinary media service, auth middleware, and Socket.IO handlers.
- API paths are under `/api/v1`. Health check: `GET /api/v1/health`.

## Run locally

Requirements: Node.js 20.19+ (or Node.js 22), npm, a MongoDB Atlas database, a Supabase project, and (for uploads) a Cloudinary account.

1. Copy `client/.env.example` to `client/.env` and `server/.env.example` to `server/.env`.
2. Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_API_URL` in the client file. These are public browser values; never put a service-role or Cloudinary secret in the client file.
3. Set `MONGODB_URI`, `SUPABASE_URL`, and `SUPABASE_ANON_KEY` in the server file. The publishable/anon key is used with `auth.getUser(accessToken)` to verify bearer tokens. `SUPABASE_SERVICE_ROLE_KEY` is optional and is only for trusted server administrative operations.
4. Set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` in the server file to enable media uploads. The API secret stays on the server; the backend signs upload requests and verifies Cloudinary's response.
5. At the repository root run `npm install`, then `npm run dev`. The client runs at `http://localhost:5173`; the API and socket server run at `http://localhost:4000`.

The server exits on startup when required MongoDB or Supabase verification settings are missing. Cloudinary is optional for text-only development; media endpoints return `503` until Cloudinary is configured.

Run the included access-policy and validation tests with `npm test`.

## Deploy with Docker

The root `Dockerfile` builds the React client and runs it with the API and Socket.IO server in one Node 22 container. The container runs as a non-root user, exposes port `4000` by default, and provides a readiness health check at `/api/v1/health`. The built frontend uses same-origin API and socket URLs unless `VITE_API_URL` or `VITE_SOCKET_URL` is overridden during the build.

Build the image with the public Supabase browser settings (the anon/publishable key is intended for browser use and must be protected by Supabase RLS policies):

```sh
docker build \
  --build-arg VITE_SUPABASE_URL=https://<project-ref>.supabase.co \
  --build-arg VITE_SUPABASE_ANON_KEY=<supabase-publishable-or-anon-key> \
  -t circles:latest .
```

Set these runtime environment variables in the deployment platform's secret/configuration settings:

- `NODE_ENV=production`
- `PORT` (use the port assigned by the platform, if it provides one)
- `CLIENT_URL` (the exact HTTPS origin serving the client; comma-separated origins are supported)
- `TRUST_PROXY_HOPS` (set to the number of trusted reverse proxies in front of the app; common single-proxy platforms use `1`)
- `MONGODB_URI`
- `SUPABASE_URL` and `SUPABASE_ANON_KEY`
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`

Do not bake MongoDB, Supabase server, or Cloudinary secrets into the image or pass them as Docker build arguments. Keep `SUPABASE_SERVICE_ROLE_KEY` unset unless a trusted server feature specifically needs it. If hosting the client separately, build with `VITE_API_URL=https://<api-host>/api/v1` and `VITE_SOCKET_URL=https://<api-host>`, allow the client origin in `CLIENT_URL`, and configure the proxy to pass WebSocket upgrades. Configure the Supabase Site URL and redirect URLs to the deployed client origin and use HTTPS at the hosting edge.

The health check is database readiness: it returns `503` until MongoDB is connected. Use a single deployment replica unless Socket.IO is configured with a shared adapter and compatible sticky-session/proxy behavior. The current app does not configure the Redis adapter automatically. Configure `TRUST_PROXY_HOPS` to match the hosting proxy chain so Express rate limits real client IPs; do not blindly trust arbitrary forwarded headers.

## Supabase setup

In the Supabase dashboard, enable Email authentication and choose whether sign-up requires email confirmation. Set the site URL and allowed redirect URLs to the client origin (for local development, `http://localhost:5173`). Enable Google under Authentication → Providers and add the OAuth client ID/secret from Google Cloud there. The browser uses Supabase's publishable/anon key. The server validates the bearer token against Supabase and never accepts a client-supplied user ID as identity.

## MongoDB Atlas setup

Create a database user, allow the app server's network in Atlas, and copy the SRV connection string into `MONGODB_URI`. Mongoose creates the declared indexes from the model schemas. For production, use a least-privilege database user, managed backups, and a deployment topology that supports transactions if later workflows need multi-document atomicity.

## Cloudinary setup

Create a Cloudinary account and copy its cloud name, API key, and API secret from the dashboard into the server environment. Upload signatures are generated only by the backend; files upload directly from the browser to Cloudinary as private assets, and the backend verifies the signed response and stored asset before attaching it to a post or profile. Media links are access-checked and time-limited. Allowed MIME types and file sizes are checked before authorization. Never expose `CLOUDINARY_API_SECRET` in Vite variables.

## Implemented API surface

- `GET/PATCH /api/v1/profiles/me`, `GET /profiles/search`, `GET /profiles/:username`, follow/unfollow, follow-request response, block/unblock.
- `GET /posts/feed`, `/posts/explore`, `/posts/bookmarks`, create/delete posts, like/bookmark toggles, paginated comments.
- `POST /media/uploads`, `POST /media/uploads/complete`, and access-checked `GET /media/resolve?key=...`.
- Conversation list/create/history under `/conversations`.
- Notifications list, mark one read, and mark all read.
- Report submission and admin-only report/account status operations under `/reports`.
- `GET /health` for process/database health.

REST responses use JSON; errors have `{ "error": { "code", "message" } }`. List routes return a page and `hasMore` where applicable. The Socket.IO event names include `conversation:join`, `message:send`, `message:delivered`, `message:read`, `typing:start`, `typing:stop`, and server events `message:new`, `message:delivered`, `message:read`, `typing:update`, and `presence:update`. Each socket connection is authenticated; conversation membership is checked before joining, reading, or sending. Message persistence completes before the server acknowledges a send.

## Security notes

Helmet, origin allowlisting, request throttling, JSON size limits, Zod validation, centralized errors, token redaction, account suspension checks, server-enforced admin checks, and media authorization are enabled. User role is not editable through profile updates. MongoDB relationships use dedicated indexed collections rather than unbounded follower/message arrays. Deleting a post removes its likes, bookmarks, and comments; object retention/deletion should be extended to match the deployment's moderation and retention policy.

Before production, set exact client origins, use TLS, configure email and Google OAuth redirect URLs, enable MongoDB backups, protect Cloudinary credentials, add monitoring/alerting, and exercise account recovery and moderation workflows in the external dashboards. Horizontal Socket.IO scaling can add Redis and the Socket.IO Redis adapter when needed.
