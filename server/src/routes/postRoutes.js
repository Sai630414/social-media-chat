import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { createPost, listFeed, explore, getPost, deletePost, toggleLike, toggleBookmark, addComment, listComments, listBookmarks } from '../controllers/postController.js';
const router = Router();
router.get('/feed', asyncHandler(listFeed)); router.get('/explore', asyncHandler(explore)); router.get('/bookmarks', asyncHandler(listBookmarks)); router.post('/', asyncHandler(createPost)); router.get('/:id', asyncHandler(getPost)); router.delete('/:id', asyncHandler(deletePost)); router.put('/:id/like', asyncHandler(toggleLike)); router.put('/:id/bookmark', asyncHandler(toggleBookmark)); router.get('/:id/comments', asyncHandler(listComments)); router.post('/:id/comments', asyncHandler(addComment));
export default router;
