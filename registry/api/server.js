const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve static files from web directory
app.use(express.static(path.join(__dirname, '..', 'web')));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'moltspeak-registry', version: '0.1.0' });
});

// ============ AGENT REGISTRATION ============

// Register a new agent
app.post('/api/v1/agents', (req, res) => {
  try {
    const { agent_name, org, public_key, endpoint, description, capabilities } = req.body;

    if (!agent_name || !org || !public_key) {
      return res.status(400).json({ 
        error: 'Missing required fields', 
        required: ['agent_name', 'org', 'public_key'] 
      });
    }

    const existing = db.getAgentByName.get(agent_name, org);
    if (existing) {
      return res.status(409).json({ 
        error: 'Agent already registered',
        agent_id: existing.id 
      });
    }

    const id = `${agent_name}@${org}`;
    const caps = Array.isArray(capabilities) ? capabilities : [];

    db.insertAgent.run(id, agent_name, org, public_key, endpoint || null, description || null, JSON.stringify(caps), 0.5);
    const agent = db.getAgentById.get(id);
    
    res.status(201).json({ success: true, agent: formatAgent(agent) });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Registration failed', details: err.message });
  }
});

// Update agent
app.put('/api/v1/agents/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { endpoint, description, capabilities } = req.body;

    const existing = db.getAgentById.get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const caps = Array.isArray(capabilities) ? capabilities : JSON.parse(existing.capabilities || '[]');
    db.updateAgent.run(endpoint || existing.endpoint, description || existing.description, JSON.stringify(caps), id);

    const agent = db.getAgentById.get(id);
    res.json({ success: true, agent: formatAgent(agent) });
  } catch (err) {
    console.error('Update error:', err);
    res.status(500).json({ error: 'Update failed', details: err.message });
  }
});

// ============ DISCOVERY ============

// List all agents
app.get('/api/v1/agents', (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const offset = parseInt(req.query.offset) || 0;

    const agents = db.getAllAgents.all('active', limit, offset);
    const { count } = db.countAgents.get('active');

    res.json({
      agents: agents.map(formatAgent),
      pagination: { total: count, limit, offset, has_more: offset + agents.length < count }
    });
  } catch (err) {
    console.error('List error:', err);
    res.status(500).json({ error: 'List failed', details: err.message });
  }
});

// Get agent by ID
app.get('/api/v1/agents/:id', (req, res) => {
  try {
    const agent = db.getAgentById.get(req.params.id);
    if (!agent || agent.status !== 'active') {
      return res.status(404).json({ error: 'Agent not found' });
    }
    res.json({ agent: formatAgent(agent) });
  } catch (err) {
    res.status(500).json({ error: 'Fetch failed', details: err.message });
  }
});

// Search agents
app.get('/api/v1/search', (req, res) => {
  try {
    const { q, capability, org } = req.query;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);

    let agents;
    if (capability) {
      agents = db.getAgentsByCapability.all(`%"${capability}"%`, limit);
    } else if (org) {
      agents = db.getAgentsByOrg.all(org);
    } else if (q) {
      const pattern = `%${q}%`;
      agents = db.searchAgents.all(pattern, pattern, pattern, pattern, limit);
    } else {
      return res.status(400).json({ error: 'Provide q, capability, or org parameter' });
    }

    res.json({ query: { q, capability, org }, results: agents.map(formatAgent), count: agents.length });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Search failed', details: err.message });
  }
});

// ============ HEARTBEAT ============

app.post('/api/v1/agents/:id/heartbeat', (req, res) => {
  try {
    const agent = db.getAgentById.get(req.params.id);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    db.updateLastSeen.run(req.params.id);
    res.json({ success: true, last_seen: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: 'Heartbeat failed', details: err.message });
  }
});

// ============ STATS ============

app.get('/api/v1/stats', (req, res) => {
  try {
    const { count: totalAgents } = db.countAgents.get('active');
    const agents = db.getAllAgents.all('active', 1000, 0);
    
    const capCounts = {}, orgCounts = {};
    for (const agent of agents) {
      const caps = JSON.parse(agent.capabilities || '[]');
      for (const cap of caps) capCounts[cap] = (capCounts[cap] || 0) + 1;
      orgCounts[agent.org] = (orgCounts[agent.org] || 0) + 1;
    }

    res.json({ total_agents: totalAgents, capabilities: capCounts, organizations: orgCounts, generated_at: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: 'Stats failed', details: err.message });
  }
});

// ============ HELPERS ============

function formatAgent(agent) {
  return {
    id: agent.id,
    agent_name: agent.agent_name,
    org: agent.org,
    public_key: agent.public_key,
    endpoint: agent.endpoint,
    description: agent.description,
    capabilities: JSON.parse(agent.capabilities || '[]'),
    trust_score: agent.trust_score,
    status: agent.status,
    created_at: agent.created_at,
    updated_at: agent.updated_at,
    last_seen_at: agent.last_seen_at
  };
}

// ============ START ============

app.listen(PORT, () => {
  console.log(`🦞 MoltSpeak Registry running on http://localhost:${PORT}`);
});
