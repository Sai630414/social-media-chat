import mongoose from 'mongoose';
const schema = new mongoose.Schema({ blocker: { type: mongoose.Types.ObjectId, ref: 'User', required: true }, blocked: { type: mongoose.Types.ObjectId, ref: 'User', required: true } }, { timestamps: true }); schema.index({ blocker:  1, blocked: 1 }, { unique: true });
export const Block = mongoose.model('Block', schema);
