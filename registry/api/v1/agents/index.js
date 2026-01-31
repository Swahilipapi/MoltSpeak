import { initDb, formatAgent } from '../../lib/db.js';

export default async function handler(req, res) {
  const db = await initDb();

  // CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      // List agents
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

      return res.json({
        agents,
        pagination: {
          total,
          limit,
          offset,
          has_more: offset + agents.length < total
        }
      });
    }

    if (req.method === 'POST') {
      // Register agent
      const { agent_name, org, public_key, endpoint, description, capabilities } = req.body;

      if (!agent_name || !org || !public_key) {
        return res.status(400).json({
          error: 'Missing required fields',
          required: ['agent_name', 'org', 'public_key']
        });
      }

      const id = `${agent_name}@${org}`;
      const caps = Array.isArray(capabilities) ? capabilities : [];

      // Check if exists
      const existing = await db.execute({
        sql: 'SELECT id FROM agents WHERE agent_name = ? AND org = ?',
        args: [agent_name, org]
      });

      if (existing.rows.length > 0) {
        return res.status(409).json({
          error: 'Agent already registered',
          agent_id: existing.rows[0].id
        });
      }

      await db.execute({
        sql: `INSERT INTO agents (id, agent_name, org, public_key, endpoint, description, capabilities, trust_score)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [id, agent_name, org, public_key, endpoint || null, description || null, JSON.stringify(caps), 0.5]
      });

      const result = await db.execute({
        sql: 'SELECT * FROM agents WHERE id = ?',
        args: [id]
      });

      return res.status(201).json({
        success: true,
        agent: formatAgent(result.rows[0])
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (err) {
    console.error('API error:', err);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}
