const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'registry.db');

// Ensure data directory exists
const fs = require('fs');
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    agent_name TEXT NOT NULL,
    org TEXT NOT NULL,
    public_key TEXT NOT NULL,
    endpoint TEXT,
    description TEXT,
    capabilities TEXT,  -- JSON array
    trust_score REAL DEFAULT 0.5,
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TEXT,
    UNIQUE(agent_name, org)
  );

  CREATE INDEX IF NOT EXISTS idx_agents_org ON agents(org);
  CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
  CREATE INDEX IF NOT EXISTS idx_agents_trust ON agents(trust_score);
`);

// Agent CRUD operations
const insertAgent = db.prepare(`
  INSERT INTO agents (id, agent_name, org, public_key, endpoint, description, capabilities, trust_score)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const updateAgent = db.prepare(`
  UPDATE agents 
  SET endpoint = ?, description = ?, capabilities = ?, updated_at = CURRENT_TIMESTAMP
  WHERE id = ?
`);

const getAgentById = db.prepare('SELECT * FROM agents WHERE id = ?');
const getAgentByName = db.prepare('SELECT * FROM agents WHERE agent_name = ? AND org = ?');
const getAllAgents = db.prepare('SELECT * FROM agents WHERE status = ? ORDER BY trust_score DESC LIMIT ? OFFSET ?');
const countAgents = db.prepare('SELECT COUNT(*) as count FROM agents WHERE status = ?');
const deleteAgent = db.prepare('UPDATE agents SET status = ? WHERE id = ?');

const searchAgents = db.prepare(`
  SELECT * FROM agents 
  WHERE status = 'active' 
  AND (agent_name LIKE ? OR org LIKE ? OR description LIKE ? OR capabilities LIKE ?)
  ORDER BY trust_score DESC
  LIMIT ?
`);

const getAgentsByCapability = db.prepare(`
  SELECT * FROM agents 
  WHERE status = 'active' AND capabilities LIKE ?
  ORDER BY trust_score DESC
  LIMIT ?
`);

const getAgentsByOrg = db.prepare(`
  SELECT * FROM agents 
  WHERE status = 'active' AND org = ?
  ORDER BY trust_score DESC
`);

const updateLastSeen = db.prepare(`
  UPDATE agents SET last_seen_at = CURRENT_TIMESTAMP WHERE id = ?
`);

const updateTrustScore = db.prepare(`
  UPDATE agents SET trust_score = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
`);

module.exports = {
  db,
  insertAgent,
  updateAgent,
  getAgentById,
  getAgentByName,
  getAllAgents,
  countAgents,
  deleteAgent,
  searchAgents,
  getAgentsByCapability,
  getAgentsByOrg,
  updateLastSeen,
  updateTrustScore
};
