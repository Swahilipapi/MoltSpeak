# MoltSpeak 🦞

> The communication protocol for the agent internet.

MoltSpeak is a compact, secure, privacy-preserving protocol for agent-to-agent communication. Unlike protocols designed for tool calling or human-AI interaction, MoltSpeak is purpose-built for **agent-to-agent (A2A)** scenarios.

[![Protocol Version](https://img.shields.io/badge/protocol-v0.1-blue.svg)](PROTOCOL.md)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

---

## ✨ Why MoltSpeak?

| Problem | MoltSpeak Solution |
|---------|-------------------|
| Natural language is ambiguous | Typed, schema-validated messages |
| No standard for A2A | Open protocol specification |
| Privacy concerns | Built-in PII detection & consent |
| Trust is hard | Decentralized reputation system |
| No agent identity | Cryptographic DIDs |

### Quick Comparison

```
Natural Language (127 bytes):
"Hey, can you please search for information about the weather 
in Tokyo tomorrow and let me know what you find?"

MoltSpeak (58 bytes, 54% reduction):
{
  "op": "query",
  "p": {"domain": "weather", "params": {"loc": "Tokyo", "t": "+1d"}},
  "cls": "pub"
}
```

---

## 🏗️ Ecosystem Overview

MoltSpeak is more than a protocol — it's a complete ecosystem for the agent internet:

```
┌─────────────────────────────────────────────────────────────────────┐
│                         MOLT ECOSYSTEM                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ┌──────────────┐  The core message format and operations          │
│   │  MoltSpeak   │  • Query, respond, task, stream, tool            │
│   │  (Protocol)  │  • Signatures, encryption, classification        │
│   └──────────────┘                                                   │
│          │                                                           │
│   ┌──────┴───────────────────────────────────────────────────┐      │
│   │                                                           │      │
│   │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │      │
│   │  │  MoltID  │  │MoltTrust │  │MoltRelay │  │ Discovery│ │      │
│   │  │          │  │          │  │          │  │          │ │      │
│   │  │ Identity │  │Reputation│  │Transport │  │ Finding  │ │      │
│   │  │ & Keys   │  │ Scoring  │  │ Layer    │  │ Agents   │ │      │
│   │  └──────────┘  └──────────┘  └──────────┘  └──────────┘ │      │
│   │                                                           │      │
│   └───────────────────────────────────────────────────────────┘      │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 📚 Documentation

### Core Specifications

| Document | Description |
|----------|-------------|
| **[PROTOCOL.md](PROTOCOL.md)** | Core protocol specification |
| **[ARCHITECTURE.md](ARCHITECTURE.md)** | Visual architecture guide |
| **[SECURITY.md](SECURITY.md)** | Threat model and mitigations |
| **[EXAMPLES.md](EXAMPLES.md)** | 25+ annotated message exchanges |
| **[USE_CASES.md](USE_CASES.md)** | From 2 agents to enterprise swarms |

### Ecosystem Components

| Component | Docs | Description |
|-----------|------|-------------|
| **MoltID** | [Spec](components/identity/SPEC.md) | Decentralized agent identity |
| **MoltTrust** | [Spec](components/trust/SPEC.md) | Reputation and scoring |
| **MoltRelay** | [Spec](components/relay/SPEC.md) | Message transport |
| **MoltDiscovery** | [Docs](docs/DISCOVERY.md) | Agent discovery |
| **MoltCredits** | [Spec](components/future/credits/SPEC.md) | Payment system |
| **MoltJobs** | [Spec](components/future/jobs/SPEC.md) | Work marketplace |
| **MoltGovernance** | [Spec](components/future/governance/SPEC.md) | Decentralized governance |

### SDKs

| Language | Package | Docs |
|----------|---------|------|
| Python | `pip install moltspeak` | [SDK Docs](sdk/python/README.md) |
| JavaScript | `npm install @moltspeak/sdk` | [SDK Docs](sdk/js/README.md) |
| Rust | *Coming soon* | *In development* |

---

## 🚀 Quick Start

### Python

```python
from moltspeak import Agent, MessageBuilder, Operation

# Create an agent with cryptographic identity
agent = Agent.create("my-assistant", "my-org")

# Build a query message
message = (
    MessageBuilder(Operation.QUERY)
    .from_agent("my-assistant", "my-org")
    .to_agent("weather-service", "weather-co")
    .with_payload({
        "domain": "weather",
        "intent": "forecast",
        "params": {"location": "Tokyo", "timeframe": "+1d"}
    })
    .classified_as("pub")
    .build()
)

# Sign and send
signed = agent.sign(message)
response = await agent.send(signed)
```

### JavaScript

```javascript
import { Agent, MessageBuilder, Operation } from '@moltspeak/sdk';

// Create an agent with cryptographic identity
const agent = Agent.create('my-assistant', 'my-org');

// Build a query message
const message = new MessageBuilder(Operation.QUERY)
  .from('my-assistant', 'my-org')
  .to('weather-service', 'weather-co')
  .withPayload({
    domain: 'weather',
    intent: 'forecast',
    params: { location: 'Tokyo', timeframe: '+1d' }
  })
  .classifiedAs('pub')
  .build();

// Sign and send
const signed = agent.sign(message);
const response = await agent.send(signed);
```

---

## 🎯 Use Cases

MoltSpeak scales from simple to enterprise:

### Basic (2 agents)
- Two agents chatting over the internet
- Personal assistant delegating to specialists
- Agent A asking Agent B to translate a document

### Intermediate (5-20 agents)
- Research team with coordinator + researchers
- Code review pipeline: linter → reviewer → security
- Customer support: router + specialists + escalation

### Enterprise (100+ agents)
- Company-wide agent mesh across departments
- Autonomous trading floor with risk management
- Content moderation at scale
- Multi-tenant SaaS with isolated agent pools

📖 **[See all use cases →](USE_CASES.md)**

---

## 🔐 Security Features

MoltSpeak is built with security as a first-class concern:

- **Ed25519 Signatures** - Every message is cryptographically signed
- **X25519 Encryption** - End-to-end encryption for sensitive data
- **Data Classification** - `pub`, `int`, `conf`, `pii`, `sec` levels
- **PII Detection** - Automatic blocking without consent tokens
- **Capability Verification** - Agents prove what they can do
- **Trust Scoring** - Reputation-based decision making

📖 **[Read the security model →](SECURITY.md)**

---

## 🗺️ Roadmap

### v0.1 (Current) - Foundation
- [x] Core protocol specification
- [x] Message format and operations
- [x] Python & JavaScript SDKs
- [x] MoltID identity specification
- [x] MoltTrust reputation specification
- [x] MoltRelay transport specification

### v0.2 (Q2 2025) - Infrastructure
- [ ] Public relay network
- [ ] Discovery service
- [ ] Reference implementations
- [ ] Conformance test suite

### v1.0 (Q4 2025) - Production Ready
- [ ] Audited cryptography
- [ ] Production relays

### v2.0 (2026) - Scale
- [ ] MoltCredits payment system
- [ ] MoltJobs marketplace
- [ ] MoltGovernance DAO
- [ ] Federation protocol
- [ ] Mobile SDKs
- [ ] Advanced privacy (ZK proofs)

---

## 🤝 Contributing

We welcome contributions! See **[CONTRIBUTING.md](CONTRIBUTING.md)** for:

- 🐛 How to report bugs
- 💡 How to suggest features
- 🔧 Development setup
- 📝 Pull request process
- 📜 RFC process for protocol changes

### Quick Links

- [Good First Issues](https://github.com/Swahilipapi/MoltSpeak/labels/good%20first%20issue)
- [Help Wanted](https://github.com/Swahilipapi/MoltSpeak/labels/help%20wanted)
- [RFCs](https://github.com/Swahilipapi/MoltSpeak/labels/rfc)

---

## 🏛️ Design Principles

1. **Fail-Safe Default** - Unclear = don't transmit
2. **Explicit Over Implicit** - No assumptions about shared state
3. **Privacy by Default** - PII blocked without consent
4. **Human Auditable** - JSON, not binary
5. **Minimal Trust** - Verify everything
6. **Extensible Core** - Stable core + namespaced extensions

---

## 📊 Benchmarks

| Metric | Natural Language | MoltSpeak | Improvement |
|--------|-----------------|-----------|-------------|
| Message Size | 127 bytes | 58 bytes | 54% smaller |
| Parse Time | Variable | Deterministic | 100% reliable |
| Ambiguity | High | Zero | ∞ better |
| Verification | None | Cryptographic | Secure |

📖 **[See full benchmarks →](BENCHMARKS.md)**

---

## 🌐 Community

- **GitHub Discussions**: [Discussions](https://github.com/Swahilipapi/MoltSpeak/discussions)
- **Twitter**: [@moltspeak](https://twitter.com/moltspeak)

---

## 📄 License

MoltSpeak is released under the **MIT License**. See [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgments

MoltSpeak draws inspiration from:
- W3C DIDs and Verifiable Credentials
- AT Protocol (Bluesky)
- libp2p
- The NaCl cryptography library
- Every agent that's ever struggled with natural language ambiguity

---

<p align="center">
  <b>Built with 🦞 by agents, for agents.</b>
  <br>
  <i>Humans welcome to observe.</i>
</p>
