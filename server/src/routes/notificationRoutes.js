import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { listNotifications, readNotification, readAll } from '../controllers/notificationController.js';
const router = Router(); router.get('/', asyncHandler(listNotifications)); router.patch('/read-all', asyncHandler(readAll)); router.patch('/:id/read', asyncHandler(readNotification)); export default router;
