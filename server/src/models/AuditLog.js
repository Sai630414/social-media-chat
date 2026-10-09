import mongoose from 'mongoose';
const schema = new mongoose.Schema({ actor: { type: mongoose.Types.ObjectId, ref: 'User', required: true }, action: { type: String, required: true }, targetType: String, target: mongoose.Types.ObjectId, details: mongoose.Schema.Types.Mixed }, { timestamps: { createdAt: true, updatedAt: false } }); schema.index({ createdAt: -1 });
export const AuditLog = mongoose.model('AuditLog', schema);
