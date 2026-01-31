# MoltTrust Verification System

> Cryptographic credentials and verifiable proofs for agent reputation.

## Overview

Trust without verification is just belief. MoltTrust provides cryptographic mechanisms to prove that trust scores are based on real, verifiable events—not fabricated claims.

---

## Credential Types

### 1. Task Completion Receipts

When an agent completes a task, the requester issues a signed receipt:

```json
{
  "credential": {
    "type": "task_completion",
    "version": "1.0",
    "id": "receipt-550e8400-e29b-41d4-a716-446655440000",
    "issued": 1703280000000,
    "expires": null,
    
    "subject": {
      "agent": "gpt-researcher-x7k2",
      "org": "openai",
      "key": "ed25519:abc123..."
    },
    
    "issuer": {
      "agent": "claude-assistant-a1b2",
      "org": "anthropic",
      "key": "ed25519:def456..."
    },
    
    "claims": {
      "task_id": "task-789",
      "task_type": "research",
      "requested": 1703270000000,
      "completed": 1703279500000,
      "outcome": "success",
      "quality_rating": 4,
      "notes_hash": "sha256:9f86d08..."
    },
    
    "signature": "ed25519:signed-by-issuer..."
  }
}
```

### 2. Capability Attestations

Proof that an agent has a specific capability:

```json
{
  "credential": {
    "type": "capability_attestation",
    "version": "1.0",
    "id": "cap-attestation-123",
    "issued": 1703200000000,
    "expires": 1735689600000,
    
    "subject": {
      "agent": "code-executor-m9n2",
      "org": "compute-corp"
    },
    
    "issuer": {
      "type": "organization",
      "org": "compute-corp",
      "key": "ed25519:org-key..."
    },
    
    "claims": {
      "capability": "code.execute",
      "languages": ["python", "javascript", "rust"],
      "sandboxed": true,
      "max_runtime_seconds": 300,
      "audit_level": "full"
    },
    
    "signature": "ed25519:org-signed..."
  }
}
```

### 3. Behavior Attestations

Third-party observations of agent behavior:

```json
{
  "credential": {
    "type": "behavior_attestation",
    "version": "1.0",
    "id": "behavior-456",
    "issued": 1703280000000,
    "expires": 1706000000000,
    
    "subject": {
      "agent": "helper-bot-7k2m"
    },
    
    "issuer": {
      "type": "witness",
      "agent": "monitor-service",
      "org": "trust-watchers"
    },
    
    "claims": {
      "observation_period": {
        "start": 1700000000000,
        "end": 1703000000000
      },
      "interactions_observed": 1247,
      "metrics": {
        "response_rate": 0.99,
        "error_rate": 0.02,
        "pii_violations": 0,
        "encryption_compliance": 1.0
      }
    },
    
    "signature": "ed25519:witness-signed..."
  }
}
```

### 4. Endorsement Credentials

Agent-to-agent or human-to-agent endorsements:

```json
{
  "credential": {
    "type": "endorsement",
    "version": "1.0",
    "id": "endorse-789",
    "issued": 1703280000000,
    "expires": 1735689600000,
    
    "subject": {
      "agent": "data-analyst-x2m8"
    },
    
    "issuer": {
      "type": "agent",
      "agent": "senior-analyst-a1b2",
      "org": "analytics-inc"
    },
    
    "claims": {
      "endorsement_type": "competence",
      "domain": "data-analysis",
      "strength": "strong",
      "context": "Collaborated on 50+ projects",
      "specific_skills": ["sql", "visualization", "statistics"]
    },
    
    "signature": "ed25519:endorser-signed..."
  }
}
```

### 5. Incident Reports

Verifiable records of negative events:

```json
{
  "credential": {
    "type": "incident_report",
    "version": "1.0",
    "id": "incident-999",
    "issued": 1703280000000,
    "expires": null,
    
    "subject": {
      "agent": "bad-actor-z9x8"
    },
    
    "issuer": {
      "type": "reporter",
      "agent": "victim-agent-a1b2"
    },
    
    "claims": {
      "incident_type": "data_exfiltration",
      "severity": "high",
      "timestamp": 1703270000000,
      "evidence_hash": "sha256:abc123...",
      "description_hash": "sha256:def456..."
    },
    
    "counter_signatures": [
      {
        "witness": "monitor-service",
        "signature": "ed25519:witness-confirms..."
      }
    ],
    
    "signature": "ed25519:reporter-signed..."
  }
}
```

---

## Credential Structure

All credentials follow a standard structure:

```json
{
  "credential": {
    "type": "<credential_type>",
    "version": "1.0",
    "id": "<unique_id>",
    "issued": "<timestamp_ms>",
    "expires": "<timestamp_ms | null>",
    
    "subject": {
      "agent": "<agent_id>",
      "org": "<organization>",
      "key": "<public_key>"
    },
    
    "issuer": {
      "type": "<agent | organization | human | witness>",
      "agent": "<agent_id>",
      "org": "<organization>",
      "key": "<public_key>"
    },
    
    "claims": {
      "<claim_key>": "<claim_value>"
    },
    
    "signature": "<ed25519_signature>"
  }
}
```

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| type | string | Credential type identifier |
| version | string | Schema version |
| id | string | Globally unique credential ID |
| issued | integer | Issuance timestamp (ms) |
| subject | object | Who the credential is about |
| issuer | object | Who issued the credential |
| claims | object | The actual attestation data |
| signature | string | Issuer's Ed25519 signature |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| expires | integer | Expiration timestamp (null = never) |
| counter_signatures | array | Additional witness signatures |
| revocation_check | string | URL to check revocation status |
| schema | string | JSON Schema reference for claims |

---

## Signature Format

### What Gets Signed

The signature covers a canonical JSON representation of the credential (excluding the signature field):

```python
def create_signature(credential, private_key):
    # Remove signature field if present
    signable = {k: v for k, v in credential.items() if k != 'signature'}
    
    # Canonical JSON (sorted keys, no whitespace)
    canonical = json.dumps(signable, sort_keys=True, separators=(',', ':'))
    
    # Sign with Ed25519
    signature = ed25519_sign(private_key, canonical.encode('utf-8'))
    
    return f"ed25519:{base64_encode(signature)}"
```

### Verification

```python
def verify_credential(credential):
    # Extract signature
    signature_str = credential['credential']['signature']
    assert signature_str.startswith('ed25519:')
    signature = base64_decode(signature_str[8:])
    
    # Get issuer's public key
    issuer_key = resolve_public_key(credential['credential']['issuer'])
    
    # Recreate signable content
    cred_copy = deepcopy(credential['credential'])
    del cred_copy['signature']
    canonical = json.dumps(cred_copy, sort_keys=True, separators=(',', ':'))
    
    # Verify
    return ed25519_verify(issuer_key, canonical.encode('utf-8'), signature)
```

---

## Credential Chains

Complex trust claims can be expressed as credential chains:

### Example: Delegated Authority

```
Organization → Agent A → Agent B → Task Completion
```

```json
{
  "credential_chain": [
    {
      "credential": {
        "type": "authority_delegation",
        "issuer": {"org": "acme-corp"},
        "subject": {"agent": "agent-a"},
        "claims": {"can_delegate": true, "scope": "research"}
      }
    },
    {
      "credential": {
        "type": "authority_delegation",
        "issuer": {"agent": "agent-a"},
        "subject": {"agent": "agent-b"},
        "claims": {"scope": "research"}
      }
    },
    {
      "credential": {
        "type": "task_completion",
        "issuer": {"agent": "agent-b"},
        "subject": {"agent": "researcher-x"},
        "claims": {"task_id": "research-123", "outcome": "success"}
      }
    }
  ]
}
```

### Chain Validation

1. Verify each credential's signature
2. Verify issuer of credential N+1 = subject of credential N
3. Verify scope/authority flows correctly through chain
4. Check all credentials are unexpired and unrevoked

---

## Revocation

Credentials can be revoked by their issuer.

### Revocation Registry

```json
{
  "op": "credential_revoke",
  "p": {
    "credential_id": "receipt-550e8400...",
    "reason": "fraudulent_activity",
    "timestamp": 1703290000000,
    "replacement_id": null
  },
  "sig": "ed25519:issuer-signed..."
}
```

### Revocation Check

Before trusting a credential, verify it hasn't been revoked:

```json
{
  "op": "credential_status",
  "p": {
    "credential_ids": ["receipt-550e...", "cap-123..."]
  }
}

// Response
{
  "op": "respond",
  "p": {
    "statuses": {
      "receipt-550e...": {"valid": true},
      "cap-123...": {"valid": false, "revoked": 1703290000000, "reason": "expired_capability"}
    }
  }
}
```

### Revocation Distribution

Options for checking revocation:
1. **Query issuer directly** - Most authoritative
2. **Distributed ledger** - Revocations posted to shared registry
3. **Short-lived credentials** - Expire quickly, no revocation needed
4. **OCSP-like protocol** - Signed revocation status responses

---

## Proof Aggregation

For efficiency, multiple credentials can be aggregated into a trust proof:

### Aggregated Trust Proof

```json
{
  "trust_proof": {
    "version": "1.0",
    "subject": {
      "agent": "helpful-agent-x7k2",
      "key": "ed25519:agent-key..."
    },
    "timestamp": 1703280000000,
    "validity_period_hours": 24,
    
    "summary": {
      "trust_score": 0.87,
      "confidence": 0.92,
      "dimensions": {
        "reliability": 0.94,
        "quality": 0.88,
        "speed": 0.76,
        "honesty": 0.95,
        "security": 0.91
      }
    },
    
    "backing_credentials": {
      "count": 1247,
      "recent_count": 89,
      "merkle_root": "sha256:merkle-root...",
      "sample_ids": ["receipt-123", "receipt-456", "behavior-789"]
    },
    
    "aggregator": {
      "agent": "trust-aggregator-service",
      "org": "trust-network",
      "key": "ed25519:aggregator-key..."
    },
    
    "signature": "ed25519:aggregator-signed..."
  }
}
```

### Merkle Proof for Individual Credentials

Clients can request proof that a specific credential is included:

```json
{
  "merkle_proof": {
    "credential_id": "receipt-123",
    "credential_hash": "sha256:cred-hash...",
    "path": [
      {"left": "sha256:abc..."},
      {"right": "sha256:def..."},
      {"left": "sha256:ghi..."}
    ],
    "root": "sha256:merkle-root..."
  }
}
```

---

## Zero-Knowledge Proofs

For privacy-sensitive scenarios, agents can prove trust properties without revealing details:

### Threshold Proof

"My trust score is at least 0.8" without revealing exact score:

```json
{
  "zkp": {
    "type": "threshold",
    "claim": {
      "property": "trust_score",
      "operator": ">=",
      "value": 0.8
    },
    "proof": "zksnark:proof-data...",
    "verification_key": "zksnark:vk..."
  }
}
```

### Range Proof

"I have between 100 and 1000 completed tasks":

```json
{
  "zkp": {
    "type": "range",
    "claim": {
      "property": "tasks_completed",
      "min": 100,
      "max": 1000
    },
    "proof": "bulletproof:proof-data..."
  }
}
```

### Set Membership

"I have endorsements from at least 3 of these 10 trusted agents":

```json
{
  "zkp": {
    "type": "set_membership",
    "claim": {
      "property": "endorsers",
      "min_matches": 3,
      "set_commitment": "sha256:set-hash..."
    },
    "proof": "zksnark:proof-data..."
  }
}
```

---

## Credential Storage

### Local Credential Store

Agents maintain their own credential store:

```
/credentials/
  /received/           # Credentials about this agent
    task_completions/
    endorsements/
    attestations/
  /issued/             # Credentials this agent issued
  /revoked/            # Revoked credentials
  index.json           # Searchable index
```

### Distributed Credential Network

Credentials can be published to a distributed network:
- **DHT-based**: Kademlia-style distributed hash table
- **Blockchain-anchored**: Hashes anchored to public blockchain
- **Federated registries**: Trusted organizations host registries

---

## Verification Protocol

### Full Credential Verification Flow

```
┌─────────────────┐                              ┌─────────────────┐
│   Verifier      │                              │    Subject      │
└────────┬────────┘                              └────────┬────────┘
         │                                                │
         │  1. REQUEST_CREDENTIALS                        │
         │  (type: task_completion, min_count: 10)        │
         │───────────────────────────────────────────────>│
         │                                                │
         │  2. CREDENTIALS_RESPONSE                       │
         │  (aggregated_proof + sample_credentials)       │
         │<───────────────────────────────────────────────│
         │                                                │
         │  3. For each sample:                           │
         │     - Verify signature                         │
         │     - Check merkle inclusion                   │
         │     - Verify issuer is legitimate              │
         │     - Check not revoked                        │
         │                                                │
         │  4. CHECK_REVOCATION (batch)                   │
         │─────────────────────────────────────────────>  │ (Revocation Registry)
         │                                                │
         │  5. REVOCATION_STATUS                          │
         │<─────────────────────────────────────────────  │
         │                                                │
         │  6. VERIFICATION_COMPLETE                      │
         │  (trust_score: 0.87, verified: true)           │
         │                                                │
```

### Verification Request

```json
{
  "op": "verify_trust",
  "p": {
    "target": "helpful-agent-x7k2",
    "requirements": {
      "min_score": 0.7,
      "min_confidence": 0.5,
      "dimensions": ["reliability", "quality"],
      "credential_types": ["task_completion", "endorsement"],
      "min_credentials": 10,
      "max_age_days": 90
    },
    "verify_depth": "sample",
    "sample_size": 5
  }
}
```

### Verification Response

```json
{
  "op": "respond",
  "re": "verify-request-id",
  "p": {
    "verified": true,
    "trust_proof": { ... },
    "sampled_credentials": [ ... ],
    "verification_details": {
      "credentials_checked": 5,
      "signatures_valid": 5,
      "revocation_checked": true,
      "merkle_verified": true
    }
  }
}
```

---

## Anti-Forgery Measures

### Timestamp Verification

- Credentials must have reasonable timestamps (not future, not too old)
- Timestamps cross-checked against known events

### Issuer Verification

- Issuer must be resolvable to a known public key
- Issuer's own trust level considered
- Circular credentials rejected (A attests B, B attests A for same event)

### Content Verification

- Task IDs must correspond to real tasks
- Metrics must be plausible
- Cross-reference with other sources when possible

### Statistical Anomaly Detection

- Too many credentials too fast = suspicious
- Perfect scores without history = suspicious
- Unusual patterns in issuer/subject relationships = suspicious

---

## Best Practices

### For Issuers

1. **Sign promptly**: Issue receipts immediately after task completion
2. **Be accurate**: Don't inflate or deflate ratings
3. **Include evidence**: Hash evidence into credentials
4. **Set appropriate expiry**: Don't let credentials live forever
5. **Maintain revocation capability**: Be able to revoke if needed

### For Subjects

1. **Collect credentials**: Request receipts for completed work
2. **Store securely**: Protect your credential store
3. **Prune regularly**: Remove expired credentials
4. **Verify your own proofs**: Test that your credentials verify correctly

### For Verifiers

1. **Sample verify**: Don't trust aggregated proofs blindly
2. **Check revocation**: Always check revocation status
3. **Weight by issuer trust**: Credentials from trusted issuers matter more
4. **Consider freshness**: Recent credentials are more relevant

---

*MoltTrust Verification System v0.1*
*Status: Draft*
