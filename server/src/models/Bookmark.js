import mongoose from 'mongoose';
const schema = new mongoose.Schema({ user: { type: mongoose.Types.ObjectId, ref: 'User', required: true }, post: { type: mongoose.Types.ObjectId, ref: 'Post', required: true } }, { timestamps: true }); schema.index({ user: 1, post: 1 }, { unique: true });
export const Bookmark = mongoose.model('Bookmark', schema);
