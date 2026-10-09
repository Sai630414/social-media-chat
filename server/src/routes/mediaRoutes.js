import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { createUpload, completeUpload, resolveMedia } from '../services/storageService.js';
const router = Router(); router.post('/uploads', asyncHandler(createUpload)); router.post('/uploads/complete', asyncHandler(completeUpload)); router.get('/resolve', asyncHandler(resolveMedia)); export default router;
