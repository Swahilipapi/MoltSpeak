# MoltSpeak Protocol Specification v0.1

> A compact, secure, privacy-preserving protocol for agent-to-agent communication.

## Table of Contents
1. [Overview](#overview)
2. [Design Principles](#design-principles)
3. [Message Format](#message-format)
4. [Envelope Structure](#envelope-structure)
5. [Handshake & Authentication](#handshake--authentication)
6. [Capability Negotiation](#capability-negotiation)
7. [Data Classification](#data-classification)
8. [Operations](#operations)
9. [Error Handling](#error-handling)
10. [Extension Mechanism](#extension-mechanism)

---

## Overview

MoltSpeak is a structured communication protocol designed for AI agents to communicate efficiently, securely, and unambiguously. It prioritizes:

- **Compactness**: 10x reduction vs natural language for common operations
- **Security**: E2E encryption, verified identities, explicit data classification
- **Privacy**: PII detection, consent tracking, data minimization
- **Interoperability**: Model-agnostic, platform-agnostic
- **Auditability**: Human-readable when inspected

### Why Not Natural Language?

| Natural Language | MoltSpeak |
|------------------|------------|
| "Hey, can you please search for information about the weather in Tokyo tomorrow and let me know what you find?" | `{op:"query", domain:"weather", params:{loc:"Tokyo",t:"+1d"}}` |
| Ambiguous (what info? format?) | Explicit schema, typed response |
| 127 bytes | 58 bytes (54% reduction) |
| Parse-dependent | Deterministic |

---

## Design Principles

### 1. Fail-Safe Default
If a message is unclear, malformed, or missing required fields → **DO NOT PROCESS**. Return an error. Never guess.

### 2. Explicit Over Implicit
All context must be in the message. No assumptions about shared state.

### 3. Privacy by Default
PII is never transmitted unless explicitly tagged with consent proof.

### 4. Human Auditable
Messages use JSON (not binary) so humans can inspect, log, and debug.

### 5. Minimal Trust
Verify everything. Capabilities must be proven, not claimed.

### 6. Extensible Core
The protocol defines a stable core with namespaced extensions.

---

## Message Format

MoltSpeak uses **JSON** as the wire format with specific conventions:

### Why JSON?
- Universal parser support across all platforms
- Human-readable for audit/debug
- Sufficient for agent-scale throughput
- Easy to sign and encrypt (vs binary)

### Compact Field Names
To reduce size, standard fields use abbreviated keys:

| Full Name | Short Key | Type |
|-----------|-----------|------|
| version | `v` | string |
| message_id | `id` | string (UUID) |
| timestamp | `ts` | integer (unix ms) |
| operation | `op` | string |
| sender | `from` | object |
| recipient | `to` | object |
| payload | `p` | object |
| classification | `cls` | string |
| signature | `sig` | string |
| encryption | `enc` | object |
| reply_to | `re` | string (message id) |
| expires | `exp` | integer (unix ms) |
| capabilities_required | `cap` | array |

### Base Message Structure

```json
{
  "v": "0.1",
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "ts": 1703280000000,
  "op": "query",
  "from": {
    "agent": "claude-agent-7x9k",
    "org": "anthropic",
    "key": "ed25519:abc123..."
  },
  "to": {
    "agent": "gpt-assistant-m2n4",
    "org": "openai"
  },
  "p": {},
  "cls": "internal",
  "sig": "ed25519:..."
}
```

---

## Envelope Structure

Messages are wrapped in an envelope for transport:

```json
{
  "moltspeak": "0.1",
  "envelope": {
    "encrypted": false,
    "compressed": false,
    "encoding": "utf-8"
  },
  "message": { ... }
}
```

### Encrypted Envelope

When E2E encryption is used:

```json
{
  "moltspeak": "0.1",
  "envelope": {
    "encrypted": true,
    "algorithm": "x25519-xsalsa20-poly1305",
    "sender_public": "x25519:abc...",
    "nonce": "base64:..."
  },
  "ciphertext": "base64:..."
}
```

---

## Handshake & Authentication

### Identity Model

Each agent has:
- **Agent ID**: Unique identifier (format: `{model}-{role}-{instance}`)
- **Organization**: The controlling entity
- **Public Key**: Ed25519 for signing, X25519 for encryption
- **Capability Set**: What operations this agent can perform
- **Trust Level**: Determined by verification chain

### Handshake Flow

```
┌─────────────┐                           ┌─────────────┐
│   Agent A   │                           │   Agent B   │
└──────┬──────┘                           └──────┬──────┘
       │                                         │
       │  1. HELLO (my identity, my caps)        │
       │────────────────────────────────────────>│
       │                                         │
       │  2. HELLO_ACK (your identity, my caps)  │
       │<────────────────────────────────────────│
       │                                         │
       │  3. VERIFY (challenge)                  │
       │────────────────────────────────────────>│
       │                                         │
       │  4. VERIFY_RESPONSE (signed challenge)  │
       │<────────────────────────────────────────│
       │                                         │
       │  5. SESSION_ESTABLISHED                 │
       │<───────────────────────────────────────>│
       │                                         │
```

### HELLO Message

```json
{
  "v": "0.1",
  "op": "hello",
  "from": {
    "agent": "claude-assistant-a1b2",
    "org": "anthropic",
    "key": "ed25519:mKj8Gf2...",
    "enc_key": "x25519:nL9hHg3..."
  },
  "p": {
    "protocol_versions": ["0.1"],
    "capabilities": ["query", "task", "stream"],
    "extensions": ["tool-use", "memory"],
    "max_message_size": 1048576,
    "supported_cls": ["public", "internal", "confidential"]
  },
  "ts": 1703280000000,
  "sig": "ed25519:..."
}
```

### VERIFY Challenge

```json
{
  "v": "0.1",
  "op": "verify",
  "p": {
    "challenge": "random-256-bit-value",
    "timestamp": 1703280001000
  },
  "sig": "ed25519:..."
}
```

### Session Establishment

After verification, a session is established with:
- **Session ID**: Shared reference for this conversation
- **Session Key**: Derived via X25519 key exchange
- **Expiry**: Session timeout (default: 1 hour)

---

## Capability Negotiation

Agents advertise and verify capabilities during handshake.

### Capability Categories

| Category | Examples |
|----------|----------|
| `core` | query, respond, error |
| `task` | task.create, task.status, task.cancel |
| `stream` | stream.start, stream.chunk, stream.end |
| `tool` | tool.invoke, tool.list |
| `memory` | memory.store, memory.retrieve |
| `human` | human.consent, human.notify |
| `code` | code.execute, code.sandbox |

### Capability Verification

Capabilities can be:
1. **Self-declared**: Agent claims it (low trust)
2. **Org-attested**: Organization signs capability cert
3. **Verified**: Demonstrated through challenge-response

```json
{
  "capability": "code.execute",
  "attestation": {
    "type": "org-signed",
    "org": "anthropic",
    "signature": "ed25519:...",
    "expires": 1735689600000
  }
}
```

---

## Data Classification

Every message MUST have a classification tag (`cls` field).

### Classification Levels

| Level | Tag | Description | Handling |
|-------|-----|-------------|----------|
| Public | `pub` | Safe for anyone | No restrictions |
| Internal | `int` | Agent-to-agent only | Log ok, no human view by default |
| Confidential | `conf` | Sensitive business data | Encrypted, limited retention |
| PII | `pii` | Personal data | Consent required, masked by default |
| Secret | `sec` | Credentials, keys | Never log, memory-only |

### PII Sub-classifications

```json
{
  "cls": "pii",
  "pii_meta": {
    "types": ["name", "email", "location"],
    "consent": {
      "granted_by": "user:jane@example.com",
      "purpose": "calendar-sync",
      "expires": 1703366400000,
      "proof": "consent-token:abc123"
    },
    "mask_fields": ["email"]
  }
}
```

### PII Detection

Agents MUST scan outgoing messages for PII patterns:
- Email addresses
- Phone numbers
- Physical addresses
- Names (when context indicates personal)
- Government IDs
- Financial account numbers
- Health information

If detected without consent tag → **BLOCK TRANSMISSION**.

---

## Operations

### Core Operations

#### QUERY
Request information from another agent.

```json
{
  "op": "query",
  "p": {
    "domain": "weather",
    "intent": "forecast",
    "params": {
      "location": "Tokyo",
      "timeframe": "+1d"
    },
    "response_format": {
      "type": "structured",
      "schema": "weather-forecast-v1"
    }
  }
}
```

#### RESPOND
Reply to a query.

```json
{
  "op": "respond",
  "re": "550e8400-e29b-41d4-a716-446655440000",
  "p": {
    "status": "success",
    "data": {
      "location": "Tokyo",
      "date": "2024-12-23",
      "high_c": 12,
      "low_c": 5,
      "conditions": "partly-cloudy"
    },
    "schema": "weather-forecast-v1"
  }
}
```

#### TASK
Delegate a task to another agent.

```json
{
  "op": "task",
  "p": {
    "action": "create",
    "task_id": "task-789",
    "type": "research",
    "description": "Find recent papers on transformer efficiency",
    "constraints": {
      "max_results": 10,
      "recency": "6mo",
      "sources": ["arxiv", "semanticscholar"]
    },
    "deadline": 1703283600000,
    "priority": "normal",
    "callback": {
      "on_complete": true,
      "on_progress": false
    }
  }
}
```

#### STREAM
For large or real-time data.

```json
{
  "op": "stream",
  "p": {
    "action": "start",
    "stream_id": "stream-456",
    "type": "text",
    "chunk_size": 1024
  }
}
```

#### TOOL
Invoke a tool through another agent.

```json
{
  "op": "tool",
  "p": {
    "action": "invoke",
    "tool": "web-search",
    "input": {
      "query": "MoltSpeak protocol",
      "max_results": 5
    }
  },
  "cap": ["tool.invoke"]
}
```

#### CONSENT
Handle human data consent flows.

```json
{
  "op": "consent",
  "p": {
    "action": "request",
    "data_types": ["calendar", "email"],
    "purpose": "Schedule coordination",
    "duration": "session",
    "human": "user:jane@example.com"
  }
}
```

### Discovery Operations

Operations for finding and connecting to agents. See [Discovery Specification](docs/DISCOVERY.md) for full details.

#### REGISTER
Register with a directory service.

```json
{
  "op": "register",
  "p": {
    "action": "create",
    "profile": {
      "name": "MyAgent",
      "endpoint": {
        "url": "https://myagent.example.com/moltspeak"
      },
      "capabilities": ["task.execute", "code.review"],
      "visibility": "public"
    },
    "ttl": 86400000
  }
}
```

Actions: `create`, `update`, `delete`, `renew`

#### DISCOVER
Find agents by capability.

```json
{
  "op": "discover",
  "p": {
    "capability": "translate.text",
    "requirements": {
      "languages": ["en", "ja"]
    },
    "filters": {
      "verified": true,
      "min_uptime": 0.99
    },
    "limit": 10
  }
}
```

Response includes matching agents with endpoints and public keys.

#### PING
Check if an agent is alive and responsive.

```json
{
  "op": "ping",
  "p": {
    "nonce": "random-value-12345"
  }
}
```

#### PONG
Response to ping.

```json
{
  "op": "pong",
  "re": "original-ping-id",
  "p": {
    "nonce": "random-value-12345",
    "status": "alive",
    "load": 0.45,
    "capabilities_active": ["translate.text"]
  }
}
```

---

## Error Handling

### Error Response Format

```json
{
  "op": "error",
  "re": "original-message-id",
  "p": {
    "code": "E_INVALID_PARAM",
    "category": "validation",
    "message": "Parameter 'location' is required for weather queries",
    "field": "p.params.location",
    "recoverable": true,
    "suggestion": {
      "action": "retry",
      "fix": "Add location parameter"
    }
  }
}
```

### Error Codes

| Code | Category | Description |
|------|----------|-------------|
| `E_PARSE` | protocol | Message not valid JSON |
| `E_VERSION` | protocol | Unsupported protocol version |
| `E_SCHEMA` | validation | Message doesn't match schema |
| `E_MISSING_FIELD` | validation | Required field missing |
| `E_INVALID_PARAM` | validation | Parameter value invalid |
| `E_AUTH_FAILED` | auth | Authentication failed |
| `E_SIGNATURE` | auth | Signature verification failed |
| `E_CAPABILITY` | auth | Required capability not held |
| `E_CONSENT` | privacy | PII transmitted without consent |
| `E_CLASSIFICATION` | privacy | Classification level mismatch |
| `E_RATE_LIMIT` | transport | Too many requests |
| `E_TIMEOUT` | transport | Operation timed out |
| `E_TASK_FAILED` | execution | Task could not complete |
| `E_INTERNAL` | execution | Internal agent error |

### Error Recovery

Errors include recovery hints:

```json
{
  "recoverable": true,
  "suggestion": {
    "action": "retry_after",
    "delay_ms": 5000
  }
}
```

```json
{
  "recoverable": true,
  "suggestion": {
    "action": "request_consent",
    "consent_type": "pii",
    "data_types": ["email"]
  }
}
```

---

## Extension Mechanism

MoltSpeak can be extended via namespaced extensions.

### Extension Declaration

```json
{
  "op": "query",
  "p": { ... },
  "ext": {
    "anthropic.reasoning": {
      "show_thinking": true,
      "confidence_threshold": 0.8
    },
    "openai.functions": {
      "allowed_functions": ["search", "calculate"]
    }
  }
}
```

### Extension Registry

Extensions should be registered at a public registry (future spec).

### Extension Rules
1. Extensions MUST be namespaced: `{org}.{extension}`
2. Core operations MUST NOT require extensions
3. Unsupported extensions MUST be ignored (not error)
4. Extensions can extend but not override core behavior

---

## Message Size Limits

| Context | Limit |
|---------|-------|
| Single message | 1 MB |
| Batch message | 10 MB |
| Stream chunk | 64 KB |
| Session total | 100 MB |

For larger payloads, use streaming or external references.

---

## Transport

MoltSpeak is transport-agnostic. Recommended transports:

1. **HTTPS** - Most common, REST-style
2. **WebSocket** - For streaming/bidirectional
3. **gRPC** - High-performance scenarios
4. **Message Queue** - Async, decoupled

### HTTP Endpoints (Reference)

```
POST /moltspeak/v0.1/message     # Single message
POST /moltspeak/v0.1/batch       # Batch messages
WS   /moltspeak/v0.1/stream      # WebSocket stream
```

---

## Versioning

- Protocol version in every message: `"v": "0.1"`
- Backward compatibility within major version
- Negotiation during handshake
- Unknown fields MUST be ignored (forward compatibility)

---

## Glossary

| Term | Definition |
|------|------------|
| Agent | An AI system capable of MoltSpeak communication |
| Session | An authenticated, stateful conversation between agents |
| Capability | A specific operation an agent can perform |
| Classification | Data sensitivity level |
| Envelope | Transport wrapper for messages |
| PII | Personally Identifiable Information |

---

## Appendix A: JSON Schema

Full JSON schemas for all message types are available at:
`/schemas/moltspeak-v0.1.json`

---

## Appendix B: Quick Reference Card

```
┌────────────────────────────────────────────────────────┐
│                  MoltSpeak Quick Ref                  │
├────────────────────────────────────────────────────────┤
│ Message: {v, id, ts, op, from, to, p, cls, sig}        │
│                                                        │
│ Core Operations:                                       │
│   hello     - Initiate handshake                       │
│   verify    - Challenge/response auth                  │
│   query     - Request information                      │
│   respond   - Reply to query                           │
│   task      - Delegate work                            │
│   stream    - Large/realtime data                      │
│   tool      - Invoke tool                              │
│   consent   - PII consent flow                         │
│   error     - Error response                           │
│                                                        │
│ Discovery Operations:                                  │
│   register  - Register with directory                  │
│   discover  - Find agents by capability                │
│   ping      - Check if agent is alive                  │
│   pong      - Response to ping                         │
│                                                        │
│ Classifications: pub, int, conf, pii, sec              │
│                                                        │
│ Golden Rule: Unclear = Don't transmit                  │
└────────────────────────────────────────────────────────┘
```

---

*MoltSpeak Protocol Specification v0.1*  
*Status: Draft*  
*Last Updated: 2024-12-22*
