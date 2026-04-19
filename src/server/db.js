import { Pool } from "pg";

const DATABASE_URL = process.env.DATABASE_URL;

let cached = global.pg;

if (!cached) {
  cached = global.pg = {
    pool: null,
    connectPromise: null,
    schemaPromise: null,
  };
}

async function ensureSchema(pool) {
  if (!cached.schemaPromise) {
    cached.schemaPromise = (async () => {
      await pool.query("CREATE EXTENSION IF NOT EXISTS pgcrypto;");

      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          full_name TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          profile_pic TEXT NOT NULL DEFAULT '',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS messages (
          id BIGSERIAL PRIMARY KEY,
          sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          text TEXT,
          image_url TEXT,
          image_encrypted BOOLEAN NOT NULL DEFAULT FALSE,
          image_iv TEXT,
          image_mime_type TEXT,
          image_file_name TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CONSTRAINT message_requires_content CHECK (text IS NOT NULL OR image_url IS NOT NULL)
        );
      `);

      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_messages_sender_receiver_created_at
        ON messages (sender_id, receiver_id, created_at);
      `);

      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_messages_receiver_sender_created_at
        ON messages (receiver_id, sender_id, created_at);
      `);
    })().catch((error) => {
      cached.schemaPromise = null;
      throw error;
    });
  }

  await cached.schemaPromise;
}

export async function connectDB() {
  if (!DATABASE_URL) {
    throw new Error("Please define DATABASE_URL in your environment variables");
  }

  if (cached.pool) {
    return cached.pool;
  }

  if (!cached.connectPromise) {
    cached.connectPromise = (async () => {
      const isLocalDatabase =
        DATABASE_URL.includes("localhost") || DATABASE_URL.includes("127.0.0.1");

      const pool = new Pool({
        connectionString: DATABASE_URL,
        ssl: isLocalDatabase ? false : { rejectUnauthorized: false },
        connectionTimeoutMillis: 3000,
      });

      await pool.query("SELECT 1");
      await ensureSchema(pool);
      cached.pool = pool;
      return pool;
    })().catch((error) => {
      cached.connectPromise = null;
      throw error;
    });
  }

  return cached.connectPromise;
}

export async function dbQuery(text, params = []) {
  const pool = await connectDB();
  return pool.query(text, params);
}
