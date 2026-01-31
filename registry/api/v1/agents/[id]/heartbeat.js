import { initDb } from '../../../lib/db.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const db = await initDb();
  const { id } = req.query;

  try {
    const existing = await db.execute({
      sql: 'SELECT id FROM agents WHERE id = ?',
      args: [id]
    });

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    await db.execute({
      sql: 'UPDATE agents SET last_seen_at = CURRENT_TIMESTAMP WHERE id = ?',
      args: [id]
    });

    return res.json({ success: true, last_seen: new Date().toISOString() });

  } catch (err) {
    console.error('Heartbeat error:', err);
    return res.status(500).json({ error: 'Heartbeat failed', details: err.message });
  }
}
