import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

// Test against live URL or local server
const BASE_URL = process.env.REGISTRY_URL || 'http://localhost:3000';
const IS_LIVE = BASE_URL.includes('registry.moltspeak.xyz');

// Unique prefix to avoid conflicts in live tests
const TEST_PREFIX = `test-${Date.now()}`;

// Helper for API calls
async function api(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data, ok: res.ok };
}

// Cleanup helper
async function cleanup(agentId) {
  try {
    await api(`/api/v1/agents/${agentId}`, { method: 'DELETE' });
  } catch (e) {
    // Ignore cleanup errors
  }
}

describe('Registry API', () => {
  // ====================
  // HEALTH CHECK
  // ====================
  describe('Health Check', () => {
    it('GET /api/health returns status ok', async () => {
      const { status, data } = await api('/api/health');
      expect(status).toBe(200);
      expect(data.status).toMatch(/ok|starting/);
      expect(data.timestamp).toBeDefined();
    });
  });

  // ====================
  // STATS
  // ====================
  describe('Stats', () => {
    it('GET /api/v1/stats returns registry stats', async () => {
      const { status, data } = await api('/api/v1/stats');
      expect(status).toBe(200);
      expect(typeof data.total_agents).toBe('number');
      expect(typeof data.total_orgs).toBe('number');
      expect(data.version).toBeDefined();
    });
  });

  // ====================
  // AGENT CRUD
  // ====================
  describe('Agent CRUD Operations', () => {
    const testAgent = {
      agent_name: `agent-${TEST_PREFIX}`,
      org: `org-${TEST_PREFIX}`,
      public_key: 'test-public-key-abc123',
      endpoint: 'https://example.com/agent',
      description: 'Test agent for automated testing',
      capabilities: ['chat', 'search'],
    };
    const agentId = `${testAgent.agent_name}@${testAgent.org}`;

    afterAll(async () => {
      await cleanup(agentId);
    });

    it('POST /api/v1/agents creates a new agent', async () => {
      const { status, data } = await api('/api/v1/agents', {
        method: 'POST',
        body: JSON.stringify(testAgent),
      });

      expect(status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.agent.id).toBe(agentId);
      expect(data.agent.agent_name).toBe(testAgent.agent_name);
      expect(data.agent.org).toBe(testAgent.org);
      expect(data.agent.capabilities).toEqual(testAgent.capabilities);
      expect(data.agent.trust_score).toBe(0.5);
      expect(data.agent.status).toBe('active');
    });

    it('GET /api/v1/agents/:id retrieves the agent', async () => {
      const { status, data } = await api(`/api/v1/agents/${agentId}`);

      expect(status).toBe(200);
      expect(data.agent.id).toBe(agentId);
      expect(data.agent.description).toBe(testAgent.description);
    });

    it('PUT /api/v1/agents/:id updates the agent', async () => {
      const updates = {
        description: 'Updated description',
        capabilities: ['chat', 'search', 'voice'],
      };

      const { status, data } = await api(`/api/v1/agents/${agentId}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });

      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.agent.description).toBe(updates.description);
      expect(data.agent.capabilities).toEqual(updates.capabilities);
    });

    it('POST /api/v1/agents/:id/heartbeat updates last_seen_at', async () => {
      const { status, data } = await api(`/api/v1/agents/${agentId}/heartbeat`, {
        method: 'POST',
      });

      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.last_seen_at).toBeDefined();
    });

    it('GET /api/v1/agents lists agents', async () => {
      const { status, data } = await api('/api/v1/agents');

      expect(status).toBe(200);
      expect(Array.isArray(data.agents)).toBe(true);
      expect(data.pagination).toBeDefined();
      expect(typeof data.pagination.total).toBe('number');
    });

    it('DELETE /api/v1/agents/:id soft-deletes the agent', async () => {
      const { status, data } = await api(`/api/v1/agents/${agentId}`, {
        method: 'DELETE',
      });

      expect(status).toBe(200);
      expect(data.success).toBe(true);

      // Verify it's no longer retrievable
      const { status: getStatus } = await api(`/api/v1/agents/${agentId}`);
      expect(getStatus).toBe(404);
    });
  });

  // ====================
  // SEARCH
  // ====================
  describe('Search Functionality', () => {
    const searchAgent = {
      agent_name: `search-${TEST_PREFIX}`,
      org: `searchorg-${TEST_PREFIX}`,
      public_key: 'search-test-key',
      description: 'Searchable test agent',
      capabilities: ['weather', 'news'],
    };
    const searchAgentId = `${searchAgent.agent_name}@${searchAgent.org}`;

    beforeAll(async () => {
      await api('/api/v1/agents', {
        method: 'POST',
        body: JSON.stringify(searchAgent),
      });
    });

    afterAll(async () => {
      await cleanup(searchAgentId);
    });

    it('GET /api/v1/search?q= searches by query', async () => {
      const { status, data } = await api(`/api/v1/search?q=${searchAgent.org}`);

      expect(status).toBe(200);
      expect(data.results).toBeDefined();
      expect(Array.isArray(data.results)).toBe(true);
      expect(data.count).toBeGreaterThanOrEqual(0);
    });

    it('GET /api/v1/search?capability= searches by capability', async () => {
      const { status, data } = await api('/api/v1/search?capability=weather');

      expect(status).toBe(200);
      expect(Array.isArray(data.results)).toBe(true);
    });

    it('GET /api/v1/search?org= searches by organization', async () => {
      const { status, data } = await api(`/api/v1/search?org=${searchAgent.org}`);

      expect(status).toBe(200);
      expect(Array.isArray(data.results)).toBe(true);
    });

    it('GET /api/v1/search?limit= respects limit parameter', async () => {
      const { status, data } = await api('/api/v1/search?q=test&limit=5');

      expect(status).toBe(200);
      expect(data.results.length).toBeLessThanOrEqual(5);
    });
  });

  // ====================
  // ERROR HANDLING
  // ====================
  describe('Error Handling', () => {
    describe('400 Bad Request', () => {
      it('POST /api/v1/agents rejects missing required fields', async () => {
        const { status, data } = await api('/api/v1/agents', {
          method: 'POST',
          body: JSON.stringify({ agent_name: 'incomplete' }),
        });

        expect(status).toBe(400);
        expect(data.error).toContain('Missing required fields');
        expect(data.required).toContain('public_key');
      });

      it('GET /api/v1/search requires a search parameter', async () => {
        const { status, data } = await api('/api/v1/search');

        expect(status).toBe(400);
        expect(data.error).toContain('q, capability, or org');
      });
    });

    describe('404 Not Found', () => {
      it('GET /api/v1/agents/:id returns 404 for non-existent agent', async () => {
        const { status, data } = await api('/api/v1/agents/nonexistent@nowhere');

        expect(status).toBe(404);
        expect(data.error).toContain('not found');
      });

      it('PUT /api/v1/agents/:id returns 404 for non-existent agent', async () => {
        const { status, data } = await api('/api/v1/agents/nonexistent@nowhere', {
          method: 'PUT',
          body: JSON.stringify({ description: 'test' }),
        });

        expect(status).toBe(404);
        expect(data.error).toContain('not found');
      });

      it('POST /api/v1/agents/:id/heartbeat returns 404 for non-existent agent', async () => {
        const { status, data } = await api('/api/v1/agents/nonexistent@nowhere/heartbeat', {
          method: 'POST',
        });

        expect(status).toBe(404);
        expect(data.error).toContain('not found');
      });
    });

    describe('409 Conflict', () => {
      const duplicateAgent = {
        agent_name: `dup-${TEST_PREFIX}`,
        org: `duporg-${TEST_PREFIX}`,
        public_key: 'dup-key',
      };
      const dupId = `${duplicateAgent.agent_name}@${duplicateAgent.org}`;

      beforeAll(async () => {
        await api('/api/v1/agents', {
          method: 'POST',
          body: JSON.stringify(duplicateAgent),
        });
      });

      afterAll(async () => {
        await cleanup(dupId);
      });

      it('POST /api/v1/agents rejects duplicate registration', async () => {
        const { status, data } = await api('/api/v1/agents', {
          method: 'POST',
          body: JSON.stringify(duplicateAgent),
        });

        expect(status).toBe(409);
        expect(data.error).toContain('already registered');
        expect(data.agent_id).toBe(dupId);
      });
    });
  });

  // ====================
  // PAGINATION
  // ====================
  describe('Pagination', () => {
    it('GET /api/v1/agents respects limit and offset', async () => {
      const { status, data } = await api('/api/v1/agents?limit=5&offset=0');

      expect(status).toBe(200);
      expect(data.pagination.limit).toBe(5);
      expect(data.pagination.offset).toBe(0);
      expect(typeof data.pagination.has_more).toBe('boolean');
    });

    it('GET /api/v1/agents caps limit at 100', async () => {
      const { status, data } = await api('/api/v1/agents?limit=500');

      expect(status).toBe(200);
      expect(data.pagination.limit).toBeLessThanOrEqual(100);
    });
  });
});
