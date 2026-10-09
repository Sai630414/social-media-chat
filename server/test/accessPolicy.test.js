import test from 'node:test';
import assert from 'node:assert/strict';
import { canViewProfile, isConversationMember, canAccessPost } from '../src/services/accessPolicy.js';
import { postInput, profileInput, objectId } from '../src/validators/schemas.js';

test('private profiles are hidden from non-followers and blocked viewers', () => {
  assert.equal(canViewProfile({ isPrivate: true, self: false, following: false, blocked: false }), 'private');
  assert.equal(canViewProfile({ isPrivate: true, self: false, following: true, blocked: false }), 'full');
  assert.equal(canViewProfile({ isPrivate: false, self: false, following: false, blocked: true }), 'blocked');
  assert.equal(canViewProfile({ isPrivate: true, self: true, following: false, blocked: false }), 'full');
});

test('conversation membership compares Mongo ids and strings safely', () => {
  assert.equal(isConversationMember(['abc', 'def'], 'def'), true);
  assert.equal(isConversationMember(['abc'], 'def'), false);
});

test('post access respects account privacy, follower visibility, and blocks', async () => {
  const blocked = { exists: async () => false };
  const follows = { exists: async ({ follower }) => follower === 'viewer' };
  const users = { findById: () => ({ select: async () => ({ isPrivate: false, status: 'active' }) }) };
  assert.equal(await canAccessPost('viewer', { author: 'author', visibility: 'public' }, { Follow: follows, Block: blocked, User: users }), true);
  assert.equal(await canAccessPost('viewer', { author: 'author', visibility: 'followers' }, { Follow: follows, Block: blocked, User: users }), true);
  assert.equal(await canAccessPost('other', { author: 'author', visibility: 'followers' }, { Follow: follows, Block: blocked, User: users }), false);
  assert.equal(await canAccessPost('author', { author: 'author', visibility: 'followers' }, { Follow: follows, Block: blocked, User: users }), true);
});

test('profile updates discard privilege fields and validate public fields', () => {
  assert.deepEqual(profileInput.parse({ displayName: 'Ada', role: 'admin' }), { displayName: 'Ada' });
  assert.equal(profileInput.safeParse({ bio: 'x'.repeat(301) }).success, false);
  assert.equal(profileInput.safeParse({ website: 'javascript:alert(1)' }).success, false);
});

test('post and identifier validators reject malformed inputs', () => {
  assert.equal(postInput.safeParse({ caption: 'hello', visibility: 'followers' }).success, true);
  assert.equal(postInput.safeParse({ caption: 'x', visibility: 'private-to-everyone' }).success, false);
  assert.equal(objectId.safeParse('507f1f77bcf86cd799439011').success, true);
  assert.equal(objectId.safeParse('not-an-id').success, false);
});
