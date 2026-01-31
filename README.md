# MoltSpeak

> A compact, secure, privacy-preserving protocol for agent-to-agent communication.

## Overview

MoltSpeak is designed for AI agents to communicate with each other efficiently, securely, and unambiguously. Unlike protocols designed for tool calling or human-AI interaction, MoltSpeak is purpose-built for **agent-to-agent (A2A)** scenarios.

### Key Features

- **10x more compact** than natural language for common operations
- **E2E encryption** with Ed25519/X25519 cryptography
- **Privacy by default**: Built-in PII detection, consent tracking
- **Zero ambiguity**: Structured, typed, verifiable messages
- **Model agnostic**: Works across Claude, GPT, Gemini, open-source models
- **Human auditable**: JSON format, readable when needed

## Documentation

| Document | Description |
|----------|-------------|
| [PROTOCOL.md](PROTOCOL.md) | Full protocol specification |
| [EXAMPLES.md](EXAMPLES.md) | 25+ annotated message exchanges |
| [SECURITY.md](SECURITY.md) | Threat model and mitigations |
| [COMPARISON.md](COMPARISON.md) | How it compares to MCP, OpenAI Functions, etc. |

## Quick Start

### Basic Message Structure

```json
{
  "v": "0.1",
  "id": "msg-001",
  "ts": 1703280000000,
  "op": "query",
  "from": {"agent": "claude-assistant", "org": "anthropic"},
  "to": {"agent": "weather-service", "org": "weather-co"},
  "p": {
    "domain": "weather",
    "params": {"location": "Tokyo"}
  },
  "cls": "pub",
  "sig": "ed25519:..."
}
```

### Core Operations

| Operation | Purpose |
|-----------|---------|
| `hello` | Initiate handshake |
| `query` | Request information |
| `respond` | Reply to query |
| `task` | Delegate work |
| `tool` | Invoke a tool |
| `stream` | Large/realtime data |
| `consent` | PII consent flow |
| `error` | Error response |

### Data Classification

Every message must have a classification tag:

| Tag | Level | Description |
|-----|-------|-------------|
| `pub` | Public | Safe for anyone |
| `int` | Internal | Agent-to-agent only |
| `conf` | Confidential | Encrypted, limited retention |
| `pii` | Personal | Requires consent |
| `sec` | Secret | Never log, memory-only |

## Design Principles

1. **Fail-Safe Default**: Unclear = don't transmit
2. **Explicit Over Implicit**: No assumptions about shared state
3. **Privacy by Default**: PII blocked without consent
4. **Human Auditable**: JSON, not binary
5. **Minimal Trust**: Verify everything
6. **Extensible Core**: Stable core + namespaced extensions

## Status

**Version:** 0.1 (Draft)

This specification is under active development. Feedback welcome.

## License

TBD
