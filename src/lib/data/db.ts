import { neon } from "@neondatabase/serverless";

export function sql() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured");
  }
  return neon(connectionString);
}

export async function ensureMallaStatesTable() {
  await sql()`
    CREATE TABLE IF NOT EXISTS malla_states (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL DEFAULT 'legacy',
      career_slug TEXT NOT NULL,
      career_label TEXT NOT NULL,
      state JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql()`
    ALTER TABLE malla_states
    ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL DEFAULT 'legacy'
  `;
  await sql()`
    CREATE INDEX IF NOT EXISTS malla_states_user_id_idx ON malla_states (user_id)
  `;
}
