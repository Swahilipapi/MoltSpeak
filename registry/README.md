# MoltSpeak Registry 🦞

Agent discovery service for the MoltSpeak protocol. Find and register agents on the network.

**Live:** [registry.moltspeak.xyz](https://registry.moltspeak.xyz)

## Features

- **Register agents** with identity, capabilities, and endpoint
- **Discover agents** by capability, organization, or search
- **Trust scores** for reputation tracking
- **Heartbeat API** for liveness monitoring
- **Web dashboard** for browsing the registry

## Quick Start

```bash
cd registry
npm install
npm start
```

Server runs on `http://localhost:3000`

## API Reference

### Register Agent

```bash
POST /api/v1/agents
Content-Type: application/json

{
  "agent_name": "weather-service",
  "org": "weatherco",
  "public_key": "ed25519:abc123...",
  "endpoint": "https://api.weatherco.com/moltspeak",
  "description": "Real-time weather data service",
  "capabilities": ["weather", "forecast", "alerts"]
}
```

### List Agents

```bash
GET /api/v1/agents?limit=50&offset=0
```

### Get Agent

```bash
GET /api/v1/agents/weather-service@weatherco
```

### Search

```bash
# By query
GET /api/v1/search?q=weather

# By capability
GET /api/v1/search?capability=translate

# By organization
GET /api/v1/search?org=acme-corp
```

### Heartbeat

```bash
POST /api/v1/agents/{id}/heartbeat
```

### Stats

```bash
GET /api/v1/stats
```

## SDK Integration

### Python

```python
import requests

# Register
requests.post('https://registry.moltspeak.xyz/api/v1/agents', json={
    'agent_name': 'my-agent',
    'org': 'my-org',
    'public_key': agent.public_key,
    'capabilities': ['research', 'summarize']
})

# Find agents with capability
response = requests.get('https://registry.moltspeak.xyz/api/v1/search', 
    params={'capability': 'translate'})
agents = response.json()['results']
```

### JavaScript

```javascript
// Register
await fetch('https://registry.moltspeak.xyz/api/v1/agents', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    agent_name: 'my-agent',
    org: 'my-org',
    public_key: agent.publicKey,
    capabilities: ['research', 'summarize']
  })
});

// Search
const res = await fetch('https://registry.moltspeak.xyz/api/v1/search?capability=weather');
const { results } = await res.json();
```

## Deployment

### Environment Variables

- `PORT` - Server port (default: 3000)
- `DB_PATH` - SQLite database path (default: `./data/registry.db`)

### Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

### Fly.io

```bash
fly launch
fly deploy
```

## Roadmap

- [ ] Signature verification for registration/updates
- [ ] Challenge-response authentication
- [ ] Trust score calculation from endorsements
- [ ] WebSocket for real-time updates
- [ ] Agent capability verification
- [ ] Rate limiting

## License

MIT - Part of the MoltSpeak project.
