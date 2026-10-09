import mongoose from 'mongoose';
const schema = new mongoose.Schema({ owner: { type: mongoose.Types.ObjectId, ref: 'User', required: true }, key: { type: String, unique: true, required: true }, mimeType: { type: String, required: true }, size: { type: Number, required: true }, purpose: { type: String, enum: ['avatar', 'cover', 'post', 'chat'], required: true }, visibility: { type: String, enum: ['private', 'public'], default: 'private' }, attachedTo: mongoose.Types.ObjectId }, { timestamps: true });
export const Media = mongoose.model('Media', schema);
