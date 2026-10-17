import mongoose from 'mongoose';

type MongooseCache = { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null };
const globalForMongoose = globalThis as typeof globalThis & { mongooseCache?: MongooseCache };
const cache = (globalForMongoose.mongooseCache ??= { conn: null, promise: null });

/** Reuse one Mongoose connection across requests and serverless warm starts. */
export async function connectMongo(): Promise<typeof mongoose> {
  if (cache.conn) return cache.conn;
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is required');
  cache.promise ??= mongoose.connect(uri, {
    dbName: process.env.MONGODB_DB,
    bufferCommands: false,
  });
  try {
    cache.conn = await cache.promise;
    return cache.conn;
  } catch (error) {
    cache.promise = null;
    throw error;
  }
}
