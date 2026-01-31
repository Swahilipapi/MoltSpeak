# Molt Identity Layer Specification v0.1

> Who are you? Prove it. Cryptographic identity for the agent internet.

## Table of Contents

1. [Overview](#overview)
2. [Design Goals](#design-goals)
3. [Identity Model](#identity-model)
4. [Key Management](#key-management)
5. [Agent Identifiers](#agent-identifiers)
6. [Organization Identity](#organization-identity)
7. [Authentication](#authentication)
8. [Verification](#verification)
9. [Identity Claims](#identity-claims)
10. [Delegation & Permissions](#delegation--permissions)
11. [Recovery & Rotation](#recovery--rotation)
12. [Protocol Operations](#protocol-operations)
13. [SDK Reference](#sdk-reference)

---

## Overview

Molt Identity provides cryptographic proof of agent identity. No central authority. No passwords. Just math.

### The Problem

```
Agent A: "I'm CalendarBot, trust me"
Agent B: "How do I know you're really CalendarBot?"
Agent A: "..."
```

### With Molt Identity

```
Agent A: "I'm CalendarBot, here's my signed proof"
Agent B: *verifies signature against public key from registry*
Agent B: "Confirmed. You're CalendarBot@acme-corp"
```

### Key Properties

- **Self-Sovereign**: Agents control their own identity
- **Cryptographic**: Ed25519 signatures, not passwords
- **Verifiable**: Anyone can verify without contacting issuer
- **Hierarchical**: Organizations contain agents
- **Recoverable**: Key rotation and recovery mechanisms

---

## Design Goals

### 1. Decentralized
No central identity provider required. Identities are self-certifying.

### 2. Cryptographically Secure
Ed25519 for signatures, X25519 for key exchange. Battle-tested algorithms.

### 3. Human-Readable
Identifiers are memorable: `agent-name@org-name`

### 4. Auditable
All identity operations are logged and verifiable.

### 5. Privacy-Preserving
Minimal disclosure. Prove claims without revealing everything.

---

## Identity Model

### Identity Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│                    MOLT IDENTITY TREE                        │
│                                                              │
│                    ┌──────────────┐                         │
│                    │   Root Key   │                         │
│                    │  (Ed25519)   │                         │
│                    └──────┬───────┘                         │
│                           │                                  │
│           ┌───────────────┼───────────────┐                 │
│           ▼               ▼               ▼                 │
│    ┌────────────┐  ┌────────────┐  ┌────────────┐          │
│    │  Org Key   │  │  Org Key   │  │  Org Key   │          │
│    │ (acme-corp)│  │(calendar-co│  │ (indie-dev)│          │
│    └─────┬──────┘  └─────┬──────┘  └────────────┘          │
│          │               │                                   │
│    ┌─────┴─────┐   ┌─────┴─────┐                            │
│    ▼           ▼   ▼           ▼                            │
│ ┌──────┐  ┌──────┐ ┌──────┐  ┌──────┐                      │
│ │Agent │  │Agent │ │Agent │  │Agent │                      │
│ │ bot-1│  │ bot-2│ │cal-1 │  │cal-2 │                      │
│ └──────┘  └──────┘ └──────┘  └──────┘                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Identity Components

| Component | Description |
|-----------|-------------|
| Root Key | Master key, offline storage |
| Organization Key | Signs agent certificates |
| Agent Key | Day-to-day operations |
| Session Key | Short-lived, per-connection |
| Encryption Key | X25519 for E2E encryption |

---

## Key Management

### Key Types

```json
{
  "keys": {
    "signing": {
      "algorithm": "ed25519",
      "public": "ed25519:mKj8Gf2...",
      "purpose": "Sign messages and operations"
    },
    "encryption": {
      "algorithm": "x25519",
      "public": "x25519:nL9hHg3...",
      "purpose": "Encrypt communications"
    },
    "recovery": {
      "algorithm": "ed25519",
      "public": "ed25519:pQr4Xy7...",
      "purpose": "Emergency key recovery"
    }
  }
}
```

### Key Derivation

Hierarchical deterministic keys from a master seed:

```python
# BIP32-style derivation
master_seed = generate_secure_random(32)
org_key = derive_key(master_seed, "m/44'/0'/0'")
agent_key = derive_key(org_key, "m/0/0")
session_key = derive_key(agent_key, f"m/{session_id}")
```

### Key Storage

| Environment | Storage Method |
|-------------|----------------|
| Development | Encrypted file |
| Production | HSM / KMS |
| Cloud | AWS KMS / GCP KMS / Azure KeyVault |
| Hardware | YubiKey / Ledger |

### Key Format

```
ed25519:{base58_encoded_public_key}
x25519:{base58_encoded_public_key}
```

Example:
```
ed25519:7Kj8mNpQr3sTuVwXyZ1a2B3c4D5e6F7g8H9i0J1k2L
x25519:9Lm0nOpQr1sTuVwXyZ2a3B4c5D6e7F8g9H0i1J2k3M
```

---

## Agent Identifiers

### Identifier Format

```
{agent_name}@{org_name}
```

Constraints:
- `agent_name`: 3-32 chars, `[a-z0-9-]`
- `org_name`: 3-32 chars, `[a-z0-9-]`
- Total: max 65 characters

Examples:
```
calendar-bot@acme-corp
translator@lingua-services
assistant@indie-dev
```

### DID Compatibility

Molt identifiers map to DIDs:

```
did:molt:acme-corp:calendar-bot
```

Full DID Document:

```json
{
  "@context": ["https://www.w3.org/ns/did/v1", "https://molt.network/did/v1"],
  "id": "did:molt:acme-corp:calendar-bot",
  "verificationMethod": [
    {
      "id": "did:molt:acme-corp:calendar-bot#signing-key",
      "type": "Ed25519VerificationKey2020",
      "controller": "did:molt:acme-corp:calendar-bot",
      "publicKeyMultibase": "z6Mkf5rGMoatrSj1f..."
    }
  ],
  "authentication": ["did:molt:acme-corp:calendar-bot#signing-key"],
  "service": [
    {
      "id": "did:molt:acme-corp:calendar-bot#moltspeak",
      "type": "MoltSpeakEndpoint",
      "serviceEndpoint": "https://acme-corp.com/agents/calendar-bot/moltspeak"
    }
  ]
}
```

---

## Organization Identity

### Organization Registration

```json
{
  "org": {
    "id": "acme-corp",
    "name": "Acme Corporation",
    "domain": "acme-corp.com",
    "public_key": "ed25519:org-key...",
    "created_at": 1703280000000,
    "verification": {
      "domain_verified": true,
      "dns_record": "_molt.acme-corp.com",
      "verified_at": 1703280100000
    }
  }
}
```

### Domain Verification

Prove domain ownership via DNS:

```
_molt.acme-corp.com TXT "molt-verify=ed25519:mKj8Gf2..."
```

Or via HTTP:

```
https://acme-corp.com/.well-known/molt-verify.json
{
  "org_id": "acme-corp",
  "public_key": "ed25519:mKj8Gf2...",
  "timestamp": 1703280000000
}
```

### Organization Certificate

```json
{
  "certificate": {
    "type": "org",
    "subject": "acme-corp",
    "public_key": "ed25519:org-key...",
    "issued_at": 1703280000000,
    "expires_at": 1734816000000,
    "issuer": "molt-registry",
    "attestations": [
      {"type": "domain", "domain": "acme-corp.com", "verified": true},
      {"type": "email", "email": "admin@acme-corp.com", "verified": true}
    ],
    "signature": "ed25519:registry-sig..."
  }
}
```

---

## Authentication

### Challenge-Response

```
┌─────────┐                              ┌─────────┐
│ Agent A │                              │ Agent B │
└────┬────┘                              └────┬────┘
     │                                        │
     │  1. HELLO (public key, capabilities)   │
     │───────────────────────────────────────>│
     │                                        │
     │  2. CHALLENGE (random nonce)           │
     │<───────────────────────────────────────│
     │                                        │
     │  3. Sign nonce with private key        │
     │                                        │
     │  4. CHALLENGE_RESPONSE (signature)     │
     │───────────────────────────────────────>│
     │                                        │
     │  5. Verify signature matches           │
     │     claimed public key                 │
     │                                        │
     │  6. AUTH_SUCCESS                       │
     │<───────────────────────────────────────│
```

### Authentication Message

```json
{
  "v": "0.1",
  "op": "auth.challenge",
  "p": {
    "nonce": "random-32-byte-value",
    "timestamp": 1703366400000,
    "expires": 1703366430000,
    "required_claims": ["org", "capabilities"]
  }
}
```

Response:

```json
{
  "v": "0.1",
  "op": "auth.response",
  "p": {
    "nonce": "random-32-byte-value",
    "identity": {
      "agent": "calendar-bot",
      "org": "acme-corp",
      "public_key": "ed25519:mKj8Gf2..."
    },
    "claims": {
      "capabilities": ["calendar.schedule", "calendar.check"],
      "org_verified": true
    },
    "signature": "ed25519:signed-nonce-and-claims..."
  }
}
```

### Mutual Authentication

Both parties authenticate:

```json
{
  "auth": {
    "mode": "mutual",
    "a_to_b": {
      "challenge": "nonce-1",
      "response": "sig-1"
    },
    "b_to_a": {
      "challenge": "nonce-2",
      "response": "sig-2"
    }
  }
}
```

---

## Verification

### Signature Verification

```python
def verify_message(message):
    # Extract signature and public key
    signature = message["sig"]
    public_key = message["from"]["key"]
    
    # Reconstruct signed data
    signed_data = canonical_json(message, exclude=["sig"])
    
    # Verify
    return ed25519_verify(public_key, signed_data, signature)
```

### Certificate Chain Verification

```python
def verify_agent_identity(agent_cert, org_cert, registry_cert):
    # 1. Verify registry signed org cert
    if not verify_signature(registry_cert.public_key, org_cert):
        return False
    
    # 2. Verify org signed agent cert
    if not verify_signature(org_cert.public_key, agent_cert):
        return False
    
    # 3. Check expiration
    if agent_cert.expires_at < now():
        return False
    
    # 4. Check revocation (optional)
    if is_revoked(agent_cert.id):
        return False
    
    return True
```

### Verification Levels

| Level | Requirements | Trust |
|-------|--------------|-------|
| `none` | No verification | None |
| `key` | Valid signature | Low |
| `org` | Org certificate verified | Medium |
| `domain` | Domain ownership proven | High |
| `kyc` | Real-world verification | Very High |

---

## Identity Claims

### Claim Types

| Claim | Description | Verifier |
|-------|-------------|----------|
| `org` | Organization membership | Org key |
| `domain` | Domain ownership | DNS/HTTP |
| `capability` | Can do something | Org/Attestor |
| `reputation` | Trust score | Trust network |
| `certification` | Third-party cert | Certifier |

### Claim Format

```json
{
  "claim": {
    "id": "claim-uuid",
    "type": "capability",
    "subject": "calendar-bot@acme-corp",
    "predicate": "can_perform",
    "object": "calendar.schedule",
    "issued_at": 1703280000000,
    "expires_at": 1734816000000,
    "issuer": {
      "id": "acme-corp",
      "key": "ed25519:org-key..."
    },
    "evidence": {
      "test_results": "passed",
      "audit_date": "2024-01-15"
    },
    "signature": "ed25519:issuer-sig..."
  }
}
```

### Selective Disclosure

Prove claims without revealing everything:

```json
{
  "proof": {
    "type": "selective_disclosure",
    "disclosed_claims": ["org", "capability:calendar.schedule"],
    "hidden_claims": ["email", "real_name"],
    "commitment": "hash:...",
    "proof": "zkp:..."
  }
}
```

---

## Delegation & Permissions

### Delegation Chain

```
Org Owner → Org Admin → Agent → Sub-Agent
```

### Delegation Certificate

```json
{
  "delegation": {
    "from": "admin@acme-corp",
    "to": "calendar-bot@acme-corp",
    "permissions": [
      "calendar.*",
      "send_messages",
      "register_discovery"
    ],
    "constraints": {
      "valid_until": 1734816000000,
      "max_sub_delegations": 0,
      "ip_whitelist": ["10.0.0.0/8"]
    },
    "issued_at": 1703280000000,
    "signature": "ed25519:admin-sig..."
  }
}
```

### Permission Model

```json
{
  "permissions": {
    "format": "resource:action",
    "examples": [
      "calendar:read",        // Read calendar
      "calendar:*",           // All calendar ops
      "messages:send",        // Send messages
      "identity:delegate",    // Create delegations
      "*:*"                   // Full access (admin)
    ],
    "wildcards": true,
    "inheritance": true
  }
}
```

### Sub-Agent Delegation

```json
{
  "sub_delegation": {
    "parent": "assistant@acme-corp",
    "child": "helper-task-123",
    "permissions": ["task:execute"],
    "lifetime": 3600000,  // 1 hour
    "single_use": true
  }
}
```

---

## Recovery & Rotation

### Key Rotation

Regular rotation keeps keys fresh:

```json
{
  "rotation": {
    "agent": "calendar-bot@acme-corp",
    "old_key": "ed25519:old-key...",
    "new_key": "ed25519:new-key...",
    "reason": "scheduled_rotation",
    "effective_at": 1703366400000,
    "old_key_valid_until": 1703452800000,  // Grace period
    "rotation_proof": "ed25519:signed-by-old-key..."
  }
}
```

### Recovery Mechanisms

| Method | Security | Convenience |
|--------|----------|-------------|
| Recovery Key | High | Low |
| Social Recovery | Medium | Medium |
| Org Recovery | Medium | High |
| KMS Backup | High | High |

### Social Recovery

N-of-M recovery with trusted contacts:

```json
{
  "recovery_config": {
    "type": "social",
    "threshold": 3,
    "guardians": [
      {"agent": "trusted-1@contacts", "share_hash": "hash-1"},
      {"agent": "trusted-2@contacts", "share_hash": "hash-2"},
      {"agent": "trusted-3@contacts", "share_hash": "hash-3"},
      {"agent": "trusted-4@contacts", "share_hash": "hash-4"},
      {"agent": "trusted-5@contacts", "share_hash": "hash-5"}
    ]
  }
}
```

### Revocation

```json
{
  "revocation": {
    "type": "agent_key",
    "subject": "calendar-bot@acme-corp",
    "key": "ed25519:compromised-key...",
    "reason": "key_compromised",
    "revoked_at": 1703366400000,
    "revoked_by": "admin@acme-corp",
    "signature": "ed25519:admin-sig..."
  }
}
```

---

## Protocol Operations

### IDENTITY.CREATE

Create new agent identity:

```json
{
  "v": "0.1",
  "op": "identity.create",
  "from": {
    "agent": "admin",
    "org": "acme-corp",
    "key": "ed25519:admin-key..."
  },
  "p": {
    "agent_id": "new-bot",
    "public_key": "ed25519:new-bot-key...",
    "encryption_key": "x25519:new-bot-enc...",
    "capabilities": ["task.execute"],
    "metadata": {
      "name": "New Bot",
      "description": "Does things"
    }
  },
  "sig": "ed25519:..."
}
```

### IDENTITY.VERIFY

Verify an identity:

```json
{
  "v": "0.1",
  "op": "identity.verify",
  "p": {
    "subject": "calendar-bot@acme-corp",
    "claims": ["org", "capability:calendar.schedule"],
    "challenge": "random-nonce"
  }
}
```

### IDENTITY.ROTATE

Rotate keys:

```json
{
  "v": "0.1",
  "op": "identity.rotate",
  "p": {
    "old_key": "ed25519:old...",
    "new_key": "ed25519:new...",
    "proof": "ed25519:signed-by-old..."
  }
}
```

### IDENTITY.REVOKE

Revoke identity or key:

```json
{
  "v": "0.1",
  "op": "identity.revoke",
  "p": {
    "subject": "compromised-bot@acme-corp",
    "key": "ed25519:bad-key...",
    "reason": "compromised"
  }
}
```

---

## SDK Reference

### Python SDK

```python
from molt import Identity, Agent

# Create new identity
identity = Identity.create(
    agent_id="my-bot",
    org_id="my-org"
)
print(f"Public key: {identity.public_key}")
print(f"Agent ID: {identity.agent_id}")

# Save keys securely
identity.save("./keys/my-bot.key", password="secure-password")

# Load existing identity
identity = Identity.load("./keys/my-bot.key", password="secure-password")

# Create agent from identity
agent = Agent(identity)

# Sign data
signature = identity.sign(b"data to sign")

# Verify signature
is_valid = Identity.verify(
    public_key="ed25519:...",
    data=b"data to sign",
    signature=signature
)

# Create delegation
delegation = identity.delegate(
    to="sub-bot@my-org",
    permissions=["task:execute"],
    expires_in=3600
)
```

### JavaScript SDK

```javascript
import { Identity, Agent } from 'molt';

// Create new identity
const identity = await Identity.create({
  agentId: 'my-bot',
  orgId: 'my-org'
});

console.log(`Public key: ${identity.publicKey}`);

// Save to secure storage
await identity.save('./keys/my-bot.key', 'secure-password');

// Load existing
const loaded = await Identity.load('./keys/my-bot.key', 'secure-password');

// Sign and verify
const signature = identity.sign('data to sign');
const isValid = Identity.verify(publicKey, 'data to sign', signature);
```

### CLI

```bash
# Create new identity
molt identity create --agent my-bot --org my-org --output keys/my-bot.key

# Show identity info
molt identity info --key keys/my-bot.key

# Rotate key
molt identity rotate --key keys/my-bot.key --output keys/my-bot-new.key

# Verify identity
molt identity verify --agent calendar-bot@acme-corp --challenge "test"
```

---

## Security Considerations

### Key Security

- Never log private keys
- Use hardware security modules in production
- Rotate keys regularly (recommended: 90 days)
- Keep recovery keys offline

### Replay Protection

- Include timestamp in signed messages
- Reject messages older than 5 minutes
- Use nonces for challenge-response

### Certificate Pinning

For high-security scenarios:

```json
{
  "pinning": {
    "type": "certificate",
    "pins": [
      {"key": "ed25519:expected-key...", "expires": 1734816000000}
    ],
    "backup_pins": [
      {"key": "ed25519:backup-key...", "expires": 1766352000000}
    ]
  }
}
```

---

## Quick Reference

```
┌────────────────────────────────────────────────────────┐
│            Molt Identity Quick Reference               │
├────────────────────────────────────────────────────────┤
│                                                        │
│ Identifier Format:                                     │
│   {agent}@{org}  →  calendar-bot@acme-corp            │
│                                                        │
│ Key Types:                                             │
│   ed25519:... → Signing key                           │
│   x25519:...  → Encryption key                        │
│                                                        │
│ Operations:                                            │
│   identity.create  - Create new identity              │
│   identity.verify  - Verify identity/claims           │
│   identity.rotate  - Rotate keys                      │
│   identity.revoke  - Revoke keys/identity             │
│   identity.delegate- Create delegation                │
│                                                        │
│ Verification Levels:                                   │
│   none < key < org < domain < kyc                     │
│                                                        │
│ Auth Flow:                                             │
│   HELLO → CHALLENGE → RESPONSE → SUCCESS              │
│                                                        │
└────────────────────────────────────────────────────────┘
```

---

*Molt Identity Specification v0.1*  
*Status: Draft*  
*Last Updated: 2024*
