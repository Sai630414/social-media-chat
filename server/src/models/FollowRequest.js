import mongoose from 'mongoose';
const schema = new mongoose.Schema({ from: { type: mongoose.Types.ObjectId, ref: 'User', required: true }, to: { type: mongoose.Types.ObjectId, ref: 'User', required: true }, status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' } }, { timestamps: true }); schema.index({ from: 1, to: 1 }, { unique: true });
export const FollowRequest = mongoose.model('FollowRequest', schema);
