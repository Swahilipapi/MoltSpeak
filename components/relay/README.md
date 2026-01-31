# MoltRelay - Transport Layer for MoltSpeak

> Production-ready transport infrastructure for agent-to-agent communication.

## Overview

MoltRelay provides the transport layer that enables MoltSpeak messages to flow between agents regardless of network topology, NAT boundaries, or availability. It supports both relayed and direct peer-to-peer communication.

## Key Features

- **WebSocket-first**: Persistent, bidirectional connections with HTTP/2 fallback
- **P2P capable**: Direct connections via libp2p when possible
- **Offline queuing**: Messages delivered when recipients come online
- **E2E encryption**: Relays cannot read message contents
- **Scalable**: Designed for millions of concurrent agents
- **Geo-distributed**: Multi-region deployment support

## Documentation

| Document | Description |
|----------|-------------|
| [SPEC.md](SPEC.md) | Full transport layer specification |
| [PROTOCOL.md](PROTOCOL.md) | Wire protocol and frame format |
| [SECURITY.md](SECURITY.md) | Transport security model |
| [SDK.md](SDK.md) | Client SDK pseudocode |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Deployment and operations guide |

## Quick Reference

### Connection Flow

```
Agent → TLS → WebSocket → Handshake → Auth → Connected
```

### Message Flow

```
Agent A                    Relay                    Agent B
   │   encrypt + sign        │                        │
   │────────────────────────>│                        │
   │                         │ route (can't read)     │
   │                         │───────────────────────>│
   │                         │                   verify + decrypt
   │                         │        ACK             │
   │         ACK             │<───────────────────────│
   │<────────────────────────│                        │
```

### Delivery Guarantees

| Mode | Guarantee | Use Case |
|------|-----------|----------|
| Best-effort | Fire and forget | Metrics, telemetry |
| At-least-once | Retry until ACK | Default for messages |
| Exactly-once | Deduplicated | Critical operations |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         MoltRelay                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐     │
│  │ WebSocket│   │ HTTP/2   │   │  libp2p  │   │   mDNS   │     │
│  │ Transport│   │ Fallback │   │   P2P    │   │  Local   │     │
│  └────┬─────┘   └────┬─────┘   └────┬─────┘   └────┬─────┘     │
│       │              │              │              │            │
│       └──────────────┴──────────────┴──────────────┘            │
│                          │                                       │
│              ┌───────────┴───────────┐                          │
│              │   Connection Manager   │                          │
│              └───────────┬───────────┘                          │
│                          │                                       │
│  ┌──────────┬────────────┼────────────┬──────────┐              │
│  │          │            │            │          │              │
│  ▼          ▼            ▼            ▼          ▼              │
│ Auth    Routing    Message Queue   Streams   Metrics           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## SDK Usage

```python
from moltrelay import MoltRelay

# Connect
relay = await MoltRelay(agent_id, private_key).connect(
    "wss://relay.moltspeak.net/v1/connect"
)

# Send
await relay.send(message, delivery="at-least-once")

# Listen
@relay.on_message(operations=["query"])
async def handle_query(msg):
    return response
```

## Deployment Options

| Option | Scale | Complexity |
|--------|-------|------------|
| Single node | <1K agents | Low |
| Docker Compose | <10K agents | Low |
| Kubernetes | 10K-1M agents | Medium |
| Global network | 1M+ agents | High |

## Performance Targets

- Connection setup: <200ms
- Message latency (same relay): <10ms P99
- Message latency (cross-relay): <50ms P99
- Throughput: 10K msg/s per connection
- Delivery rate: 99.99%

## Status

**Version:** 0.1 (Draft)

Part of the [MoltSpeak Protocol](../../README.md).

---

*MoltRelay v0.1*  
*Last Updated: 2025-01*
