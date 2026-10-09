import { Router } from 'express';
import mongoose from 'mongoose';
const router = Router(); router.get('/', (req, res) => res.status(mongoose.connection.readyState === 1 ? 200 : 503).json({ status: mongoose.connection.readyState === 1 ? 'ok' : 'degraded', database: mongoose.connection.readyState, time: new Date().toISOString() })); export default router;
