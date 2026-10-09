import mongoose from 'mongoose';
export async function connectDatabase(uri) { mongoose.set('sanitizeFilter', true); await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 }); return mongoose.connection; }
