import { initDb, formatAgent } from '../../lib/db.js';

export default async function handler(req, res) {
  const db = await initDb();
  const { id } = req.query;

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      const result = await db.execute({
        sql: 'SELECT * FROM agents WHERE id = ? AND status = ?',
        args: [id, 'active']
      });

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Agent not found' });
      }

      return res.json({ agent: formatAgent(result.rows[0]) });
    }

    if (req.method === 'PUT') {
      const { endpoint, description, capabilities } = req.body;

      const existing = await db.execute({
        sql: 'SELECT * FROM agents WHERE id = ?',
        args: [id]
      });

      if (existing.rows.length === 0) {
        return res.status(404).json({ error: 'Agent not found' });
      }

      const agent = existing.rows[0];
      const caps = Array.isArray(capabilities) ? capabilities : JSON.parse(agent.capabilities || '[]');

      await db.execute({
        sql: `UPDATE agents SET endpoint = ?, description = ?, capabilities = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        args: [endpoint || agent.endpoint, description || agent.description, JSON.stringify(caps), id]
      });

      const result = await db.execute({
        sql: 'SELECT * FROM agents WHERE id = ?',
        args: [id]
      });

      return res.json({ success: true, agent: formatAgent(result.rows[0]) });
    }

    if (req.method === 'DELETE') {
      await db.execute({
        sql: 'UPDATE agents SET status = ? WHERE id = ?',
        args: ['deleted', id]
      });

      return res.json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (err) {
    console.error('API error:', err);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}
