import { api } from './api.js';

export async function uploadMedia(file, purpose) {
  const { data: authorization } = await api.post('/media/uploads', {
    name: file.name,
    mimeType: file.type,
    size: file.size,
    purpose,
  });

  const form = new FormData();
  form.append('file', file);
  form.append('api_key', authorization.apiKey);
  form.append('timestamp', String(authorization.timestamp));
  form.append('public_id', authorization.key);
  form.append('type', authorization.type);
  form.append('signature', authorization.signature);

  let uploaded;
  try {
    const response = await fetch(authorization.uploadUrl, { method: 'POST', body: form });
    uploaded = await response.json();
    if (!response.ok) throw new Error(uploaded.error?.message || `Cloudinary upload failed (HTTP ${response.status}).`);
  } catch (error) {
    if (error instanceof TypeError) throw new Error('Could not reach Cloudinary. Check your network and Cloudinary account configuration.');
    throw error;
  }

  const { data } = await api.post('/media/uploads/complete', {
    public_id: uploaded.public_id,
    version: uploaded.version,
    signature: uploaded.signature,
  });
  return { key: authorization.key, url: data.url, mimeType: file.type, size: file.size };
}
