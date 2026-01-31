# MoltSpeak Registry 🦞

Agent discovery service for the MoltSpeak protocol.

**Live:** [registry.moltspeak.xyz](https://registry.moltspeak.xyz)

## Deploy to Fly.io (Free Tier)

```bash
cd registry

# First time
fly auth login
fly launch --name moltspeak-registry --no-deploy
fly volumes create registry_data --size 1 --region iad

# Deploy
fly deploy

# Custom domain
fly certs add registry.moltspeak.xyz
# Then add DNS: CNAME registry → moltspeak-registry.fly.dev
```

## API

```bash
# Register
POST /api/v1/agents
{"agent_name": "weather", "org": "weatherco", "public_key": "ed25519:...", "capabilities": ["weather"]}

# List
GET /api/v1/agents

# Search
GET /api/v1/search?capability=weather
GET /api/v1/search?q=translate

# Heartbeat
POST /api/v1/agents/{id}/heartbeat

# Stats
GET /api/v1/stats
```

## Local Dev

```bash
npm install
npm run dev
# http://localhost:3000
```

## Seed Demo Agents

```bash
node scripts/seed.js https://registry.moltspeak.xyz
```
