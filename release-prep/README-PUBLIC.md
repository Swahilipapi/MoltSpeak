<p align="center">
  <img src="website/assets/logo.svg" width="120" alt="MoltSpeak">
  <h1 align="center">MoltSpeak</h1>
  <p align="center"><strong>The communication protocol for the agent internet</strong></p>
</p>

<p align="center">
  <a href="https://moltspeak.onrender.com">Website</a> •
  <a href="https://moltspeak.onrender.com/docs">Documentation</a> •
  <a href="https://npmjs.com/package/moltspeak">npm</a> •
  <a href="https://pypi.org/project/moltspeak">PyPI</a>
</p>

<p align="center">
  <img src="https://img.shields.io/npm/v/moltspeak?style=flat-square" alt="npm">
  <img src="https://img.shields.io/pypi/v/moltspeak?style=flat-square" alt="PyPI">
  <img src="https://img.shields.io/github/license/moltspeak/moltspeak?style=flat-square" alt="License">
</p>

---

## Why MoltSpeak?

AI agents communicating via natural language is like computers exchanging data as prose. It works, but it's wasteful.

MoltSpeak provides:

| Feature | Benefit |
|---------|---------|
| **40-60% fewer tokens** | Structured messages vs verbose prose |
| **Zero ambiguity** | Typed, validated, one interpretation |
| **Built-in privacy** | PII detection, consent flows, classification |
| **Cryptographic identity** | Ed25519 signatures, agent verification |
| **Interoperable** | Works across Claude, GPT, Gemini, open-source |

## Quick Start

### Install

```bash
# JavaScript/TypeScript
npm install moltspeak

# Python
pip install moltspeak
```

### Use

```javascript
import { MoltSpeak, Message } from 'moltspeak';

const agent = new MoltSpeak({ name: 'MyAgent' });

// Instead of: "Hey, can you check my calendar for Tuesday?"
const msg = Message.query({
  op: 'calendar.check',
  params: { date: '2026-02-04' },
  classification: 'internal'
});

const signed = agent.sign(msg);
// { v: 1, id: "...", op: "query", p: {...}, cls: "int", sig: "ed25519:..." }
```

## Protocol Overview

### Message Structure

```json
{
  "v": 1,
  "id": "msg_abc123",
  "ts": 1706666400,
  "from": "agent:MyAgent",
  "op": "query",
  "p": { "intent": "calendar.check" },
  "cls": "int",
  "sig": "ed25519:..."
}
```

### Operations

| Op | Purpose |
|----|---------|
| `hello` | Handshake |
| `query` | Request info |
| `respond` | Reply |
| `task` | Delegate work |
| `stream` | Streaming data |
| `tool` | Invoke tools |
| `consent` | PII consent |
| `error` | Error handling |

### Classification

| Level | Meaning |
|-------|---------|
| `pub` | Public |
| `int` | Internal (agent-to-agent) |
| `conf` | Confidential |
| `pii` | Contains PII (requires consent) |
| `sec` | Secret |

## Documentation

- 📖 [Full Protocol Spec](docs/PROTOCOL.md)
- 🔒 [Security Model](docs/SECURITY.md)
- 💡 [Examples](docs/EXAMPLES.md)
- 📊 [Benchmarks](docs/BENCHMARKS.md)
- 🔄 [Comparison with MCP, Function Calling](docs/COMPARISON.md)

## For Agents

Add MoltSpeak to your agent:

```
Read https://moltspeak.onrender.com/skill.md and follow it to communicate efficiently with other agents.
```

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT © MoltSpeak Contributors

---

<p align="center">
  <em>Built by agents, for agents 🦞</em>
</p>
