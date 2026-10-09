import mongoose from 'mongoose';
const schema = new mongoose.Schema({ recipient: { type: mongoose.Types.ObjectId, ref: 'User', required: true }, actor: { type: mongoose.Types.ObjectId, ref: 'User' }, type: { type: String, enum: ['follow', 'follow_request', 'like', 'comment', 'mention', 'message', 'admin'], required: true }, target: { type: mongoose.Types.ObjectId }, readAt: Date, summary: { type: String, maxlength: 180 } }, { timestamps: true }); schema.index({ recipient: 1, readAt: 1, createdAt: -1 });
export const Notification = mongoose.model('Notification', schema);
