import { MongoClient } from 'mongodb';
import { MongoDBAdapter } from '@auth/mongodb-adapter';

const globalForMongoClient = globalThis as typeof globalThis & { authMongoClient?: MongoClient };
export function getAuthMongoClient(): MongoClient {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is required');
  return (globalForMongoClient.authMongoClient ??= new MongoClient(uri));
}

export const authAdapter = MongoDBAdapter(getAuthMongoClient, {
  databaseName: process.env.MONGODB_DB,
});
