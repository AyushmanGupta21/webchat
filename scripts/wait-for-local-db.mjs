import { Client } from "pg";

const connectionString =
  process.env.LOCAL_DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:5433/webchat_local?sslmode=disable";

const maxAttempts = 30;
const waitMs = 1000;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function canConnect() {
  const client = new Client({ connectionString });

  try {
    await client.connect();
    await client.query("SELECT 1");
    return true;
  } catch {
    return false;
  } finally {
    try {
      await client.end();
    } catch {
      // no-op
    }
  }
}

for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
  const ok = await canConnect();

  if (ok) {
    console.log("Local Postgres is ready.");
    process.exit(0);
  }

  if (attempt < maxAttempts) {
    console.log(`Waiting for local Postgres (${attempt}/${maxAttempts})...`);
    await delay(waitMs);
  }
}

console.error("Local Postgres did not become ready in time.");
process.exit(1);
