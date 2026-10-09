import mongoose from 'mongoose';
const schema = new mongoose.Schema({ post: { type: mongoose.Types.ObjectId, ref: 'Post', required: true, index: true }, author: { type: mongoose.Types.ObjectId, ref: 'User', required: true }, parent: { type: mongoose.Types.ObjectId, ref: 'Comment', default: null }, body: { type: String, maxlength: 2000, required: true } }, { timestamps: true }); schema.index({ post: 1, createdAt: -1 });
export const Comment = mongoose.model('Comment', schema);
