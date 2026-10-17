import { model, models, Schema, type InferSchemaType } from 'mongoose';

const userSchema = new Schema({
  name: { type: String, default: null },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  emailVerified: { type: Date, default: null },
  image: { type: String, default: null },
  passwordHash: { type: String, select: false },
  role: { type: String, enum: ['user', 'admin'], default: 'user', required: true },
}, { timestamps: true, collection: 'users' });

export type UserRecord = InferSchemaType<typeof userSchema>;
const User = models.User ?? model('User', userSchema);
export default User;
