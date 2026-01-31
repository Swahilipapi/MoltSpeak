import { createClient } from '@libsql/client';

let db = null;

export function getDb() {
  if (!db) {
    db = createClient({
      url: process.env.TURSO_DATABASE_URL || 'file:local.db',
      authToken: process.env.TURSO_AUTH_TOKEN
    });
  }
  return db;
}

export async function initDb() {
  const db = getDb();
  
  await db.execute(`
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      agent_name TEXT NOT NULL,
      org TEXT NOT NULL,
      public_key TEXT NOT NULL,
      endpoint TEXT,
      description TEXT,
      capabilities TEXT,
      trust_score REAL DEFAULT 0.5,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      last_seen_at TEXT,
      UNIQUE(agent_name, org)
    )
  `);
  
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_agents_org ON agents(org)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status)`);
  
  return db;
}

export function formatAgent(row) {
  return {
    id: row.id,
    agent_name: row.agent_name,
    org: row.org,
    public_key: row.public_key,
    endpoint: row.endpoint,
    description: row.description,
    capabilities: JSON.parse(row.capabilities || '[]'),
    trust_score: row.trust_score,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    last_seen_at: row.last_seen_at
  };
}
