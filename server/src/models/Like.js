import mongoose from 'mongoose';
const schema = new mongoose.Schema({ user: { type: mongoose.Types.ObjectId, ref: 'User', required: true }, post: { type: mongoose.Types.ObjectId, ref: 'Post', required: true } }, { timestamps: true }); schema.index({ user: 1, post: 1 }, { unique: true }); schema.index({ post: 1, createdAt: -1 });
export const Like = mongoose.model('Like', schema);
