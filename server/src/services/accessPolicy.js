export function canViewProfile({ isPrivate, self, following, blocked }) { if (blocked) return 'blocked'; if (isPrivate && !self && !following) return 'private'; return 'full'; }
export function isConversationMember(participantIds, userId) { return participantIds.some((id) => String(id) === String(userId)); }
export async function canAccessPost(userId, post, { Follow, Block, User }) {
  if (!post) return false;
  const authorId = String(post.author?._id || post.author);
  if (authorId === String(userId)) return true;
  if (await Block.exists({ $or: [{ blocker: userId, blocked: authorId }, { blocker: authorId, blocked: userId }] })) return false;
  const [author, follows] = await Promise.all([User.findById(authorId).select('isPrivate status'), Follow.exists({ follower: userId, following: authorId })]);
  if (!author || author.status !== 'active') return false;
  if (author.isPrivate && !follows) return false;
  if (post.visibility === 'followers' && !follows) return false;
  return true;
}
export async function canAccessConversation(userId, conversationId, { Conversation, Block }) {
  const conversation = await Conversation.findOne({ _id: conversationId, participants: userId }).select('participants');
  if (!conversation) return false;
  return !await Block.exists({ $or: [{ blocker: userId, blocked: { $in: conversation.participants } }, { blocked: userId, blocker: { $in: conversation.participants } }] });
}
