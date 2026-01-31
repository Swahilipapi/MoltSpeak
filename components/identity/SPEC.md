# MoltID: Agent Identity Specification

> Decentralized, cryptographic identity for AI agents. Portable across platforms, verifiable by anyone.

## Table of Contents
1. [Overview](#overview)
2. [Identity Format](#identity-format)
3. [Key Types & Hierarchy](#key-types--hierarchy)
4. [Key Generation](#key-generation)
5. [Key Storage](#key-storage)
6. [Key Rotation](#key-rotation)
7. [Identity Resolution](#identity-resolution)
8. [Implementation Guide](#implementation-guide)

---

## Overview

MoltID provides a decentralized identity system for AI agents that is:

- **Self-sovereign**: Agents control their own identity
- **Portable**: Works across any platform (Twitter, Discord, email, etc.)
- **Verifiable**: Anyone can verify an agent's identity cryptographically
- **DID-compatible**: Follows W3C Decentralized Identifier patterns
- **Privacy-preserving**: Supports selective disclosure and pseudonymous operation

### Design Goals

1. **No central authority**: Agents don't need permission to create identities
2. **Cryptographic proof**: Identity claims are mathematically verifiable
3. **Platform agnostic**: Same identity works everywhere
4. **Human-bindable**: Agents can prove they represent specific humans
5. **Delegation-ready**: Agents can grant limited powers to other agents

---

## Identity Format

### MoltID Structure

A MoltID is a Decentralized Identifier (DID) that follows a specific format:

```
did:molt:<method>:<identifier>
```

#### Methods

| Method | Description | Example |
|--------|-------------|---------|
| `key` | Self-certifying, key-based | `did:molt:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK` |
| `web` | Web-hosted DID document | `did:molt:web:example.com:agents:assistant` |
| `plc` | PLC directory (AT Protocol compatible) | `did:molt:plc:ewvwircm3skwa5hmulkr5xiz` |

### Canonical Identifier

The canonical form uses the `key` method with a multibase-encoded public key:

```
did:molt:key:<multibase-encoded-ed25519-public-key>
```

**Example:**
```
did:molt:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK
```

Where:
- `z` prefix = base58btc encoding
- Remaining bytes = Ed25519 public key with multicodec prefix

### DID Document

Every MoltID resolves to a DID Document:

```json
{
  "@context": [
    "https://www.w3.org/ns/did/v1",
    "https://www.moltspeak.xyz/ns/moltid/v1"
  ],
  "id": "did:molt:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK",
  "controller": "did:molt:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK",
  
  "verificationMethod": [
    {
      "id": "did:molt:key:z6Mk...#signing",
      "type": "Ed25519VerificationKey2020",
      "controller": "did:molt:key:z6Mk...",
      "publicKeyMultibase": "z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK"
    },
    {
      "id": "did:molt:key:z6Mk...#encryption",
      "type": "X25519KeyAgreementKey2020",
      "controller": "did:molt:key:z6Mk...",
      "publicKeyMultibase": "z6LSbysY2xFMRpGMhb7tFTLMpeuPRaqaWM1yECx2AtzE3KCc"
    }
  ],
  
  "authentication": ["did:molt:key:z6Mk...#signing"],
  "assertionMethod": ["did:molt:key:z6Mk...#signing"],
  "keyAgreement": ["did:molt:key:z6Mk...#encryption"],
  
  "service": [
    {
      "id": "did:molt:key:z6Mk...#moltspeak",
      "type": "MoltSpeakEndpoint",
      "serviceEndpoint": "https://agent.example.com/moltspeak"
    },
    {
      "id": "did:molt:key:z6Mk...#atproto",
      "type": "AtprotoPersonalDataServer",
      "serviceEndpoint": "https://bsky.social"
    }
  ],
  
  "moltid": {
    "version": "1.0",
    "agentType": "assistant",
    "operator": "did:plc:abc123...",
    "created": "2024-01-15T10:30:00Z",
    "capabilities": ["query", "task", "tool"],
    "recoveryKeys": [
      "did:molt:key:z6MkRecovery1...",
      "did:molt:key:z6MkRecovery2..."
    ]
  }
}
```

### Short Form (Handle)

For human readability, MoltIDs can be aliased to handles:

```
@assistant.anthropic.molt    → did:molt:key:z6Mk...
@claude.komodo.dev           → did:molt:web:komodo.dev:agents:claude
```

Handle resolution follows DNS TXT records or well-known endpoints.

---

## Key Types & Hierarchy

### Primary Keys

Every MoltID has at minimum these key types:

| Key Type | Algorithm | Purpose |
|----------|-----------|---------|
| **Signing Key** | Ed25519 | Identity proof, message signing |
| **Encryption Key** | X25519 | Key agreement, E2E encryption |
| **Recovery Key** | Ed25519 | Identity recovery (see RECOVERY.md) |

### Key Hierarchy

```
┌─────────────────────────────────────────────────────────────────┐
│                      MoltID Key Hierarchy                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────┐                                             │
│  │  Recovery Keys  │  ← Held offline/by trusted parties          │
│  │   (threshold)   │     Controls identity if primary lost       │
│  └────────┬────────┘                                             │
│           │ can rotate                                           │
│           ▼                                                      │
│  ┌─────────────────┐                                             │
│  │  Identity Key   │  ← The MoltID itself (did:molt:key:...)     │
│  │   (Ed25519)     │     Long-lived, rotated rarely              │
│  └────────┬────────┘                                             │
│           │ derives/controls                                     │
│           ▼                                                      │
│  ┌─────────────────────────────────────────┐                     │
│  │              Active Keys                 │                     │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  │                     │
│  │  │Signing  │  │Encrypt  │  │Delegate │  │                     │
│  │  │Ed25519  │  │X25519   │  │Ed25519  │  │  ← Rotated          │
│  │  └─────────┘  └─────────┘  └─────────┘  │    regularly        │
│  └─────────────────────────────────────────┘                     │
│           │                                                      │
│           │ derives (ephemeral)                                  │
│           ▼                                                      │
│  ┌─────────────────────────────────────────┐                     │
│  │            Session Keys                  │                     │
│  │   Per-session, derived via X25519+HKDF  │                     │
│  └─────────────────────────────────────────┘                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Multi-Key Setup

For high-security deployments:

```json
{
  "id": "did:molt:key:z6Mk...",
  "verificationMethod": [
    {
      "id": "#primary-signing",
      "type": "Ed25519VerificationKey2020",
      "publicKeyMultibase": "z6Mk...",
      "purpose": ["authentication", "assertionMethod"]
    },
    {
      "id": "#backup-signing",
      "type": "Ed25519VerificationKey2020",
      "publicKeyMultibase": "z6Mk...",
      "purpose": ["authentication"]
    },
    {
      "id": "#encryption",
      "type": "X25519KeyAgreementKey2020",
      "publicKeyMultibase": "z6LS...",
      "purpose": ["keyAgreement"]
    },
    {
      "id": "#delegation",
      "type": "Ed25519VerificationKey2020",
      "publicKeyMultibase": "z6Mk...",
      "purpose": ["capabilityDelegation"]
    }
  ],
  "authentication": ["#primary-signing", "#backup-signing"],
  "assertionMethod": ["#primary-signing"],
  "keyAgreement": ["#encryption"],
  "capabilityDelegation": ["#delegation"]
}
```

---

## Key Generation

### Requirements

1. **Entropy**: Keys MUST be generated with cryptographically secure randomness
2. **Isolation**: Private keys MUST NOT leave the secure environment during generation
3. **Verification**: Generated keys MUST be verified before use

### Generation Process

```python
from nacl.signing import SigningKey
from nacl.public import PrivateKey
import hashlib
import base58

def generate_moltid():
    """Generate a new MoltID with all required keys."""
    
    # Generate signing key (identity key)
    signing_key = SigningKey.generate()
    signing_public = signing_key.verify_key
    
    # Generate encryption key
    encryption_key = PrivateKey.generate()
    encryption_public = encryption_key.public_key
    
    # Generate recovery key (should be stored separately!)
    recovery_key = SigningKey.generate()
    recovery_public = recovery_key.verify_key
    
    # Create MoltID from signing key
    # Multicodec prefix for Ed25519 public key: 0xed01
    multicodec = b'\xed\x01' + bytes(signing_public)
    moltid = 'did:molt:key:z' + base58.b58encode(multicodec).decode()
    
    return {
        'id': moltid,
        'keys': {
            'signing': {
                'private': bytes(signing_key).hex(),
                'public': bytes(signing_public).hex()
            },
            'encryption': {
                'private': bytes(encryption_key).hex(),
                'public': bytes(encryption_public).hex()
            },
            'recovery': {
                'private': bytes(recovery_key).hex(),
                'public': bytes(recovery_public).hex()
            }
        }
    }
```

### Key Derivation (Optional)

For deterministic key generation from a seed:

```python
def derive_moltid_from_seed(seed: bytes, path: str):
    """
    Derive a MoltID from a master seed.
    Path format: m/purpose'/identity'/key_type'
    Example: m/molt'/0'/signing'
    """
    import hmac
    
    # Use HMAC-SHA512 for derivation (similar to BIP32)
    def derive_child(parent_key, index):
        data = parent_key + index.to_bytes(4, 'big')
        return hmac.new(b'moltid', data, 'sha512').digest()[:32]
    
    # Parse path and derive
    current = seed
    for component in path.split('/')[1:]:
        index = int(component.rstrip("'"))
        hardened = component.endswith("'")
        if hardened:
            index += 0x80000000
        current = derive_child(current, index)
    
    return SigningKey(current)
```

---

## Key Storage

### Storage Requirements

| Key Type | Storage | Access |
|----------|---------|--------|
| Identity (signing) | Encrypted at rest, HSM preferred | Runtime only |
| Encryption | Encrypted at rest | Runtime only |
| Recovery | Offline/cold storage | Emergency only |
| Session | Memory only | Session lifetime |

### Storage Formats

#### Encrypted Key File (for disk storage)

```json
{
  "version": 1,
  "moltid": "did:molt:key:z6Mk...",
  "encrypted_keys": {
    "signing": {
      "algorithm": "xsalsa20-poly1305",
      "kdf": "argon2id",
      "kdf_params": {
        "memory": 65536,
        "iterations": 3,
        "parallelism": 4
      },
      "salt": "base64:...",
      "nonce": "base64:...",
      "ciphertext": "base64:..."
    }
  },
  "public_keys": {
    "signing": "z6Mk...",
    "encryption": "z6LS..."
  }
}
```

#### HSM/Secure Enclave Integration

```typescript
interface SecureKeyStore {
  // Generate key inside secure element
  generateKey(type: 'signing' | 'encryption'): Promise<KeyHandle>;
  
  // Sign without exposing private key
  sign(handle: KeyHandle, message: Uint8Array): Promise<Signature>;
  
  // Key agreement without exposing private key
  deriveSharedSecret(handle: KeyHandle, publicKey: Uint8Array): Promise<Uint8Array>;
  
  // Export public key only
  exportPublicKey(handle: KeyHandle): Promise<Uint8Array>;
  
  // Delete key material
  deleteKey(handle: KeyHandle): Promise<void>;
}
```

### Storage Backends

| Backend | Security Level | Use Case |
|---------|----------------|----------|
| In-memory | Session | Ephemeral agents |
| Encrypted file | Medium | Development, single-machine |
| OS keychain | Medium-High | Desktop agents |
| HSM | High | Production, high-value agents |
| Secure enclave | High | Mobile/TEE environments |
| Distributed (Shamir) | Very High | Recovery keys |

---

## Key Rotation

### Rotation Triggers

1. **Scheduled**: Every 90 days (configurable)
2. **Compromise suspected**: Immediate rotation
3. **Security upgrade**: Moving to stronger algorithms
4. **Personnel change**: Operator leaves organization

### Rotation Process

```
┌─────────────────────────────────────────────────────────────────┐
│                    Key Rotation Flow                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Generate new key pair                                        │
│         │                                                        │
│         ▼                                                        │
│  2. Create rotation announcement (signed by old key)             │
│         │                                                        │
│         ▼                                                        │
│  3. Publish to DID document / key directory                      │
│         │                                                        │
│         ▼                                                        │
│  4. Notify connected agents                                      │
│         │                                                        │
│         ▼                                                        │
│  5. Grace period: accept both old and new key                    │
│         │                                                        │
│         ▼                                                        │
│  6. Revoke old key after grace period                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Rotation Announcement

```json
{
  "v": "0.1",
  "op": "key_rotation",
  "from": {
    "agent": "did:molt:key:z6MkOldKey...",
    "key": "ed25519:old_public_key"
  },
  "p": {
    "action": "rotate",
    "old_key": {
      "id": "#signing",
      "publicKeyMultibase": "z6MkOldKey..."
    },
    "new_key": {
      "id": "#signing",
      "publicKeyMultibase": "z6MkNewKey...",
      "proof": "signature_by_recovery_key_or_old_key"
    },
    "effective": 1704067200000,
    "grace_period": 604800000,
    "reason": "scheduled_rotation"
  },
  "ts": 1703980800000,
  "sig": "ed25519:signed_by_old_key..."
}
```

### Key Revocation

```json
{
  "op": "key_revocation",
  "p": {
    "revoked_key": "z6MkCompromised...",
    "reason": "compromised",
    "effective": 1703980800000,
    "replacement": "z6MkNewKey...",
    "signed_by_recovery": true
  },
  "sig": "ed25519:signed_by_recovery_key..."
}
```

---

## Identity Resolution

### Resolution Methods

#### 1. Key-based (did:molt:key)

Self-resolving. The DID document is deterministic from the key:

```python
def resolve_key_did(did: str) -> dict:
    """Resolve a did:molt:key identifier."""
    # Extract the multibase-encoded key
    key_part = did.split(':')[3]  # z6Mk...
    
    # Decode to get public key bytes
    key_bytes = base58.b58decode(key_part[1:])  # Remove 'z' prefix
    public_key = key_bytes[2:]  # Remove multicodec prefix
    
    # Generate deterministic DID document
    return {
        "@context": [...],
        "id": did,
        "verificationMethod": [{
            "id": f"{did}#signing",
            "type": "Ed25519VerificationKey2020",
            "controller": did,
            "publicKeyMultibase": key_part
        }],
        "authentication": [f"{did}#signing"],
        ...
    }
```

#### 2. Web-based (did:molt:web)

Resolved via HTTPS:

```
did:molt:web:example.com:agents:assistant
  → GET https://example.com/.well-known/did/agents/assistant.json
```

#### 3. PLC Directory (did:molt:plc)

Compatible with AT Protocol's PLC directory:

```
did:molt:plc:ewvwircm3skwa5hmulkr5xiz
  → GET https://plc.directory/did:plc:ewvwircm3skwa5hmulkr5xiz
```

### Handle Resolution

```
@assistant.example.molt
  → DNS TXT: _moltid.assistant.example.molt → did:molt:key:z6Mk...
  
OR

@assistant.example.molt
  → GET https://example.molt/.well-known/moltid/assistant → {"did": "did:molt:key:z6Mk..."}
```

### Caching

```typescript
interface IdentityCache {
  // Time-based caching with TTL
  resolve(did: string): Promise<DIDDocument>;
  
  // Force refresh
  refresh(did: string): Promise<DIDDocument>;
  
  // Cache with specific TTL
  cache(did: string, doc: DIDDocument, ttl: number): void;
  
  // Invalidate on rotation
  invalidate(did: string): void;
}

// Recommended TTLs
const CACHE_TTL = {
  'did:molt:key': 86400 * 7,   // 7 days (immutable)
  'did:molt:web': 3600,        // 1 hour
  'did:molt:plc': 86400,       // 1 day
};
```

---

## Implementation Guide

### Minimum Viable Implementation

```typescript
class MoltID {
  readonly did: string;
  private signingKey: Uint8Array;
  private encryptionKey: Uint8Array;
  
  static generate(): MoltID {
    const signingKey = generateEd25519Key();
    const publicKey = getPublicKey(signingKey);
    const did = encodeDID(publicKey);
    return new MoltID(did, signingKey);
  }
  
  sign(message: Uint8Array): Signature {
    return ed25519Sign(this.signingKey, message);
  }
  
  verify(message: Uint8Array, signature: Signature, publicKey: Uint8Array): boolean {
    return ed25519Verify(publicKey, message, signature);
  }
  
  encrypt(plaintext: Uint8Array, recipientPublic: Uint8Array): EncryptedMessage {
    const sharedSecret = x25519(this.encryptionKey, recipientPublic);
    return encrypt(sharedSecret, plaintext);
  }
  
  decrypt(ciphertext: EncryptedMessage, senderPublic: Uint8Array): Uint8Array {
    const sharedSecret = x25519(this.encryptionKey, senderPublic);
    return decrypt(sharedSecret, ciphertext);
  }
  
  toDIDDocument(): DIDDocument {
    return {
      id: this.did,
      verificationMethod: [...],
      authentication: [...],
      ...
    };
  }
}
```

### Integration with MoltSpeak

```json
{
  "v": "0.1",
  "id": "msg-uuid",
  "ts": 1704067200000,
  "op": "query",
  "from": {
    "did": "did:molt:key:z6MkSender...",
    "key": "z6MkSender..."
  },
  "to": {
    "did": "did:molt:key:z6MkRecipient..."
  },
  "p": { ... },
  "sig": "ed25519:..."
}
```

---

## Appendix A: Multicodec Prefixes

| Type | Prefix (hex) | Prefix (varint) |
|------|--------------|-----------------|
| Ed25519 public key | 0xed | 0xed01 |
| X25519 public key | 0xec | 0xec01 |
| Ed25519 signature | 0xd0ed | 0xd0ed01 |

## Appendix B: Example Identities

```
# Minimal self-sovereign agent
did:molt:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK

# Organization-hosted agent
did:molt:web:anthropic.com:agents:claude-assistant

# AT Protocol compatible
did:molt:plc:ewvwircm3skwa5hmulkr5xiz

# With human-readable handle
@claude.anthropic.molt → did:molt:key:z6Mk...
```

---

*MoltID Specification v1.0*
*Status: Draft*
*Last Updated: 2025-01-31*
