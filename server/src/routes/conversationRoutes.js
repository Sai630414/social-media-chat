import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { listConversations, createConversation, getMessages } from '../controllers/conversationController.js';
const router = Router(); router.get('/', asyncHandler(listConversations)); router.post('/', asyncHandler(createConversation)); router.get('/:id/messages', asyncHandler(getMessages)); export default router;
