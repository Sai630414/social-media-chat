import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getMe, getFollowing, updateMe, completeOnboarding, searchUsers, getProfile, followUser, unfollowUser, respondRequest, blockUser, unblockUser } from '../controllers/profileController.js';
const router = Router();
router.get('/me', asyncHandler(getMe)); router.get('/me/following', asyncHandler(getFollowing)); router.patch('/me', asyncHandler(updateMe)); router.post('/me/onboarding', asyncHandler(completeOnboarding)); router.get('/search', asyncHandler(searchUsers)); router.get('/:username', asyncHandler(getProfile));
router.post('/:id/follow', asyncHandler(followUser)); router.delete('/:id/follow', asyncHandler(unfollowUser)); router.post('/requests/:id/respond', asyncHandler(respondRequest)); router.post('/:id/block', asyncHandler(blockUser)); router.delete('/:id/block', asyncHandler(unblockUser));
export default router;
