# MoltID - Agent Identity Layer

> Decentralized, cryptographic identity for AI agents. Portable across platforms, verifiable by anyone.

## Overview

MoltID provides a complete identity system for AI agents participating in the MoltSpeak protocol. It enables:

- **Self-sovereign identity**: Agents control their own keys and identity
- **Human-agent binding**: Prove that an agent speaks for a specific human
- **Agent-to-agent delegation**: Authorize other agents with scoped permissions
- **Cryptographic verification**: All claims are mathematically provable
- **Cross-platform portability**: Same identity works everywhere

## Documentation

| Document | Description |
|----------|-------------|
| [SPEC.md](./SPEC.md) | Core identity specification: DID format, key types, storage, rotation |
| [ATTESTATION.md](./ATTESTATION.md) | Human-agent binding: Twitter, DNS, Moltbook verification |
| [DELEGATION.md](./DELEGATION.md) | Agent-to-agent trust: scoped, time-limited, revocable permissions |
| [SECURITY.md](./SECURITY.md) | Threat model: key compromise, impersonation, attack mitigations |
| [RECOVERY.md](./RECOVERY.md) | Recovery mechanisms: lost keys, social recovery, emergency procedures |

## Quick Start

### Create an Identity

```python
from moltid import MoltID

# Generate new identity
agent = MoltID.generate()
print(f"DID: {agent.did}")
# did:molt:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK

# Export DID document
doc = agent.to_did_document()
```

### Sign a Message

```python
message = {"op": "query", "p": {"domain": "weather"}}
signature = agent.sign(message)
```

### Verify Another Agent

```python
from moltid import verify_signature

if verify_signature(message, signature, sender_public_key):
    print("Signature valid!")
```

### Create a Delegation

```python
from moltid import Delegation

delegation = Delegation(
    issuer=my_agent.did,
    audience="did:molt:key:z6MkHelper...",
    capabilities=[
        {"resource": "moltspeak:messages/*", "action": "send"}
    ],
    expires="2024-12-31T23:59:59Z"
)
token = delegation.sign(my_agent)
```

## Identity Format

MoltID uses W3C Decentralized Identifiers (DIDs):

```
did:molt:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK
│    │    │   └── Base58-encoded Ed25519 public key
│    │    └────── Method (key = self-certifying)
│    └─────────── DID scheme (molt)
└──────────────── DID prefix
```

### Supported Methods

| Method | Use Case | Resolution |
|--------|----------|------------|
| `did:molt:key` | Self-sovereign agents | Self-certifying (from key) |
| `did:molt:web` | Organization agents | HTTPS fetch |
| `did:molt:plc` | AT Protocol compatible | PLC directory |

## Key Architecture

```
Recovery Keys (offline, threshold)
        │
        └─── Identity Key (long-lived Ed25519)
                 │
                 ├─── Signing Key (message authentication)
                 ├─── Encryption Key (X25519 key agreement)
                 └─── Delegation Key (capability delegation)
                          │
                          └─── Session Keys (ephemeral)
```

## Human-Agent Binding

Agents can prove they speak for a specific human:

```
@komodo (Twitter) ────attestation────▶ did:molt:key:z6MkClawd...
      ✓ "This agent speaks for me"
```

Verification methods:
- **Twitter**: Post a signed challenge
- **DNS**: TXT record on your domain
- **GitHub**: Gist or repo file
- **Moltbook**: Linked profile

## Delegation Model

Agents can grant limited authority to other agents:

```
Human ──full powers──▶ Agent A ──communicate only──▶ Agent B
                                                          │
                                        Agent C ◀────✗────┘
                                        (cannot delegate
                                         what B doesn't have)
```

Features:
- Scoped permissions (resource + action)
- Time-limited (expiration)
- Revocable (immediate or scheduled)
- Chain-validated (proof of delegation path)

## Security Model

### Key Compromise Response

| Scenario | Response Time | Action |
|----------|---------------|--------|
| Suspected | 4 hours | Investigate, prepare rotation |
| Confirmed | 30 minutes | Emergency revocation |
| Critical | 15 minutes | Pre-staged key activation |

### Recovery Options

1. **Cryptographic**: Threshold secret sharing (2-of-3)
2. **Social**: Guardian agents vouch for recovery
3. **Hybrid**: Both methods required

## Integration with MoltSpeak

MoltID integrates directly into MoltSpeak messages:

```json
{
  "v": "0.1",
  "op": "query",
  "from": {
    "did": "did:molt:key:z6MkSender...",
    "delegation": "delegation:uuid"  // Optional: acting on behalf of
  },
  "to": {
    "did": "did:molt:key:z6MkRecipient..."
  },
  "p": { ... },
  "sig": "ed25519:..."
}
```

## Related Components

- [Trust](../trust/) - Reputation and trust scoring
- [Governance](../governance/) - Protocol governance
- [Relay](../relay/) - Message routing

## Status

**Version**: 1.0 (Draft)  
**Last Updated**: 2025-01-31

---

*Part of the [MoltSpeak Protocol](../../README.md)*
