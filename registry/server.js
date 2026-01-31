import express from 'express';
import cors from 'cors';
import { initDb, formatAgent, getDb } from './api/lib/db.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('web'));

// JSON parse error handler
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }
  next(err);
});

// Initialize DB on startup
let dbReady = false;
initDb().then(() => {
  dbReady = true;
  console.log('Database initialized');
}).catch(err => {
  console.error('DB init failed:', err);
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: dbReady ? 'ok' : 'starting', timestamp: new Date().toISOString() });
});

// Stats
app.get('/api/v1/stats', async (req, res) => {
  try {
    const db = getDb();
    const agents = await db.execute("SELECT COUNT(*) as count FROM agents WHERE status = 'active'");
    const orgs = await db.execute("SELECT COUNT(DISTINCT org) as count FROM agents WHERE status = 'active'");
    
    res.json({
      total_agents: agents.rows[0].count,
      total_orgs: orgs.rows[0].count,
      version: '0.1.0'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Search agents
app.get('/api/v1/search', async (req, res) => {
  try {
    const db = getDb();
    const { q, capability, org } = req.query;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);

    let result;

    if (capability) {
      result = await db.execute({
        sql: `SELECT * FROM agents WHERE status = 'active' AND capabilities LIKE ? ORDER BY trust_score DESC LIMIT ?`,
        args: [`%"${capability}"%`, limit]
      });
    } else if (org) {
      result = await db.execute({
        sql: `SELECT * FROM agents WHERE status = 'active' AND org = ? ORDER BY trust_score DESC`,
        args: [org]
      });
    } else if (q) {
      const pattern = `%${q}%`;
      result = await db.execute({
        sql: `SELECT * FROM agents WHERE status = 'active' 
              AND (agent_name LIKE ? OR org LIKE ? OR description LIKE ? OR capabilities LIKE ?)
              ORDER BY trust_score DESC LIMIT ?`,
        args: [pattern, pattern, pattern, pattern, limit]
      });
    } else {
      return res.status(400).json({ error: 'Provide q, capability, or org parameter' });
    }

    const agents = result.rows.map(formatAgent);
    res.json({ query: { q, capability, org }, results: agents, count: agents.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List/Create agents
app.get('/api/v1/agents', async (req, res) => {
  try {
    const db = getDb();
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const offset = parseInt(req.query.offset) || 0;

    const result = await db.execute({
      sql: 'SELECT * FROM agents WHERE status = ? ORDER BY trust_score DESC LIMIT ? OFFSET ?',
      args: ['active', limit, offset]
    });

    const countResult = await db.execute({
      sql: 'SELECT COUNT(*) as count FROM agents WHERE status = ?',
      args: ['active']
    });

    const agents = result.rows.map(formatAgent);
    const total = countResult.rows[0].count;

    res.json({
      agents,
      pagination: { total, limit, offset, has_more: offset + agents.length < total }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/v1/agents', async (req, res) => {
  try {
    const db = getDb();
    const { agent_name, org, public_key, endpoint, description, capabilities } = req.body;

    if (!agent_name || !org || !public_key) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['agent_name', 'org', 'public_key']
      });
    }

    const id = `${agent_name}@${org}`;
    const caps = Array.isArray(capabilities) ? capabilities : [];

    const existing = await db.execute({
      sql: 'SELECT id FROM agents WHERE agent_name = ? AND org = ?',
      args: [agent_name, org]
    });

    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Agent already registered', agent_id: existing.rows[0].id });
    }

    await db.execute({
      sql: `INSERT INTO agents (id, agent_name, org, public_key, endpoint, description, capabilities, trust_score)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [id, agent_name, org, public_key, endpoint || null, description || null, JSON.stringify(caps), 0.5]
    });

    const result = await db.execute({ sql: 'SELECT * FROM agents WHERE id = ?', args: [id] });
    res.status(201).json({ success: true, agent: formatAgent(result.rows[0]) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Single agent operations
app.get('/api/v1/agents/:id', async (req, res) => {
  try {
    const db = getDb();
    const result = await db.execute({
      sql: 'SELECT * FROM agents WHERE id = ? AND status = ?',
      args: [req.params.id, 'active']
    });

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    res.json({ agent: formatAgent(result.rows[0]) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/v1/agents/:id', async (req, res) => {
  try {
    const db = getDb();
    const { endpoint, description, capabilities } = req.body;
    const id = req.params.id;

    const existing = await db.execute({ sql: 'SELECT * FROM agents WHERE id = ?', args: [id] });

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const agent = existing.rows[0];
    const caps = Array.isArray(capabilities) ? capabilities : JSON.parse(agent.capabilities || '[]');

    await db.execute({
      sql: `UPDATE agents SET endpoint = ?, description = ?, capabilities = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      args: [endpoint || agent.endpoint, description || agent.description, JSON.stringify(caps), id]
    });

    const result = await db.execute({ sql: 'SELECT * FROM agents WHERE id = ?', args: [id] });
    res.json({ success: true, agent: formatAgent(result.rows[0]) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/v1/agents/:id', async (req, res) => {
  try {
    const db = getDb();
    await db.execute({ sql: 'UPDATE agents SET status = ? WHERE id = ?', args: ['deleted', req.params.id] });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Heartbeat
app.post('/api/v1/agents/:id/heartbeat', async (req, res) => {
  try {
    const db = getDb();
    const id = req.params.id;

    const result = await db.execute({
      sql: `UPDATE agents SET last_seen_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'active' RETURNING *`,
      args: [id]
    });

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    res.json({ success: true, last_seen_at: result.rows[0].last_seen_at });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`MoltSpeak Registry running on port ${PORT}`);
});
