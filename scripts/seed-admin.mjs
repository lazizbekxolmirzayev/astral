import argon2 from 'argon2';
import { MongoClient } from 'mongodb';

const { MONGODB_URI, MONGODB_DB, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
if (!MONGODB_URI || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
  throw new Error('MONGODB_URI, ADMIN_EMAIL, and ADMIN_PASSWORD are required');
}
const length = Array.from(ADMIN_PASSWORD).length;
if (length < 12 || length > 128) throw new Error('ADMIN_PASSWORD must be 12-128 characters');

const client = new MongoClient(MONGODB_URI);
try {
  await client.connect();
  const users = client.db(MONGODB_DB).collection('users');
  const email = ADMIN_EMAIL.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('ADMIN_EMAIL must be a valid email address');
  await users.createIndex({ email: 1 }, { unique: true });
  const existing = await users.findOne({ email });
  if (existing) {
    console.log(`Admin seed skipped; ${email} already exists.`);
  } else {
    const passwordHash = await argon2.hash(ADMIN_PASSWORD, { type: argon2.argon2id });
    await users.insertOne({
      name: 'Admin', email, emailVerified: null, image: null,
      passwordHash, role: 'admin', createdAt: new Date(), updatedAt: new Date(),
    });
    console.log(`Created admin account ${email}.`);
  }
} finally {
  await client.close();
}
