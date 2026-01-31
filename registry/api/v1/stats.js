import { initDb } from '../lib/db.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const db = await initDb();

  try {
    const countResult = await db.execute({
      sql: 'SELECT COUNT(*) as count FROM agents WHERE status = ?',
      args: ['active']
    });

    const agentsResult = await db.execute({
      sql: 'SELECT capabilities, org FROM agents WHERE status = ?',
      args: ['active']
    });

    const capCounts = {};
    const orgCounts = {};

    for (const row of agentsResult.rows) {
      const caps = JSON.parse(row.capabilities || '[]');
      for (const cap of caps) {
        capCounts[cap] = (capCounts[cap] || 0) + 1;
      }
      orgCounts[row.org] = (orgCounts[row.org] || 0) + 1;
    }

    return res.json({
      total_agents: countResult.rows[0].count,
      capabilities: capCounts,
      organizations: orgCounts,
      generated_at: new Date().toISOString()
    });

  } catch (err) {
    console.error('Stats error:', err);
    return res.status(500).json({ error: 'Stats failed', details: err.message });
  }
}
