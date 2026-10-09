import mongoose from 'mongoose';
const schema = new mongoose.Schema({ type: { type: String, enum: ['direct', 'group'], default: 'direct' }, title: { type: String, maxlength: 80 }, participants: [{ type: mongoose.Types.ObjectId, ref: 'User', required: true }], admins: [{ type: mongoose.Types.ObjectId, ref: 'User' }], lastMessage: { type: mongoose.Types.ObjectId, ref: 'Message' }, lastActivityAt: { type: Date, default: Date.now } }, { timestamps: true }); schema.index({ participants: 1, lastActivityAt: -1 });
export const Conversation = mongoose.model('Conversation', schema);
