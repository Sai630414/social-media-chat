import mongoose from 'mongoose';
const schema = new mongoose.Schema({ follower: { type: mongoose.Types.ObjectId, ref: 'User', required: true }, following: { type: mongoose.Types.ObjectId, ref: 'User', required: true } }, { timestamps: true }); schema.index({ follower: 1, following: 1 }, { unique: true }); schema.index({ following: 1, createdAt: -1 });
export const Follow = mongoose.model('Follow', schema);
