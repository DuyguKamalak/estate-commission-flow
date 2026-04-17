/**
 * Quick Atlas connectivity check.
 *
 * Run with:   node --env-file=.env scripts/check-db.mjs
 *
 * Exits 0 on success, 1 on failure. Prints the cluster's topology so we can
 * sanity-check the database name and the authenticated user in one go.
 */
import mongoose from 'mongoose';

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('[check-db] MONGODB_URI is not set.');
  process.exit(1);
}

const masked = uri.replace(/:[^:@/]+@/, ':****@');
console.log(`[check-db] Connecting to: ${masked}`);

try {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 });
  const { db } = mongoose.connection;
  const admin = db.admin();
  const ping = await admin.ping();
  const collections = await db.listCollections().toArray();

  console.log('[check-db] ✓ Ping:', ping);
  console.log(`[check-db] ✓ Database name: ${db.databaseName}`);
  console.log(`[check-db] ✓ Collections in DB: ${collections.length}`);
  if (collections.length > 0) {
    console.log('           -', collections.map((c) => c.name).join(', '));
  }

  await mongoose.disconnect();
  console.log('[check-db] ✓ Disconnected cleanly.');
  process.exit(0);
} catch (err) {
  console.error('[check-db] ✗ Connection failed:', err?.message ?? err);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
}
