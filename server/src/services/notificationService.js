import { Notification } from '../models/Notification.js';
let socketServer;
export function setNotificationSocket(io) { socketServer = io; }
export async function createNotification(input) { const notification = await Notification.create(input); await notification.populate('actor', 'username displayName avatar'); socketServer?.to(`user:${String(input.recipient)}`).emit('notification:new', { notification }); return notification; }
