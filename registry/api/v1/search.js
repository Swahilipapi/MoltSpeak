import { initDb, formatAgent } from '../lib/db.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const db = await initDb();

  try {
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

    return res.json({
      query: { q, capability, org },
      results: agents,
      count: agents.length
    });

  } catch (err) {
    console.error('Search error:', err);
    return res.status(500).json({ error: 'Search failed', details: err.message });
  }
}
