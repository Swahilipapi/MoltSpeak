# MoltID Delegation: Agent-to-Agent Trust

> How agents authorize other agents to act on their behalf with scoped, time-limited, revocable permissions.

## Table of Contents
1. [Overview](#overview)
2. [Delegation Model](#delegation-model)
3. [Capability Tokens](#capability-tokens)
4. [Scoped Permissions](#scoped-permissions)
5. [Delegation Chains](#delegation-chains)
6. [Time-Limited Delegation](#time-limited-delegation)
7. [Revocation](#revocation)
8. [Use Cases](#use-cases)
9. [Security Model](#security-model)

---

## Overview

Delegation enables Agent A to authorize Agent B to act on A's behalf, with precise control over:

- **What** actions B can perform (scopes)
- **When** the authorization is valid (time bounds)
- **Where** the authorization applies (contexts)
- **How much** authority is delegated (constraints)
- **Whether** B can further delegate (chains)

### Why Delegation?

1. **Task Distribution**: Complex tasks require multiple specialized agents
2. **Capability Bridging**: Access capabilities through intermediary agents
3. **Hierarchical Operations**: Organizations with multiple agent tiers
4. **Human Proxying**: Human → Agent A → Agent B chains
5. **Temporary Access**: Grant short-lived permissions for specific tasks

### Core Principle

```
┌───────────────────────────────────────────────────────────────────┐
│                     Delegation Principle                           │
├───────────────────────────────────────────────────────────────────┤
│                                                                    │
│  An agent can ONLY delegate powers it actually possesses.          │
│  Delegation ALWAYS reduces or maintains scope, never expands.      │
│                                                                    │
│  Human (all powers)                                                │
│    └── Agent A (communicate, transact, delegate)                   │
│          └── Agent B (communicate only)  ← VALID                   │
│                └── Agent C (transact)    ← INVALID (B lacks this)  │
│                                                                    │
└───────────────────────────────────────────────────────────────────┘
```

---

## Delegation Model

### Delegation Token (UCAN-inspired)

MoltID delegations use a token format inspired by [UCANs](https://ucan.xyz/) (User Controlled Authorization Networks):

```json
{
  "@context": "https://www.moltspeak.xyz/ns/delegation/v1",
  "type": "MoltDelegation",
  "version": "1.0",
  
  "id": "delegation:uuid",
  "issuer": "did:molt:key:z6MkAgentA...",
  "audience": "did:molt:key:z6MkAgentB...",
  
  "capabilities": [
    {
      "resource": "moltspeak:messages/*",
      "action": "send",
      "constraints": {
        "platforms": ["discord", "telegram"],
        "rate_limit": "100/hour"
      }
    },
    {
      "resource": "moltspeak:tasks/*",
      "action": "create",
      "constraints": {
        "max_priority": "normal"
      }
    }
  ],
  
  "proof_chain": ["delegation:parent-uuid"],
  
  "conditions": {
    "not_before": "2024-01-15T10:00:00Z",
    "expires": "2024-01-22T10:00:00Z",
    "max_uses": 100,
    "contexts": ["project:alpha"]
  },
  
  "policy": {
    "allow_delegation": false,
    "require_attestation": true
  },
  
  "issued_at": "2024-01-15T10:00:00Z",
  "signature": "z58DAdFfa9..."
}
```

### Delegation Relationship

```
┌──────────────────────────────────────────────────────────────────┐
│                    Delegation Parties                             │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ISSUER (Delegator)                                               │
│  └─ The agent granting permission                                 │
│  └─ Signs the delegation token                                    │
│  └─ MUST possess the capabilities being delegated                 │
│                                                                   │
│  AUDIENCE (Delegate)                                              │
│  └─ The agent receiving permission                                │
│  └─ Presents token when acting on issuer's behalf                 │
│  └─ Bound by constraints in the token                             │
│                                                                   │
│  SUBJECT (Optional)                                               │
│  └─ The resource/entity the delegation concerns                   │
│  └─ May be different from issuer (e.g., human's data)             │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

---

## Capability Tokens

### Resource Format

Resources follow a URI-like structure:

```
moltspeak:<namespace>:<resource_path>

Examples:
moltspeak:messages/*                    # All messages
moltspeak:messages/send                 # Send messages only
moltspeak:tasks/project-alpha/*         # All tasks in project
moltspeak:data/calendar/read            # Read calendar data
moltspeak:tools/web-search              # Use web search tool
moltspeak:identity/did:molt:key:z6Mk... # Specific identity
```

### Action Types

| Action | Description |
|--------|-------------|
| `*` | All actions (wildcard) |
| `read` | Read/query access |
| `write` | Create/modify access |
| `delete` | Remove access |
| `send` | Send messages |
| `receive` | Receive messages |
| `invoke` | Call tools/functions |
| `delegate` | Further delegate this capability |

### Capability Examples

```json
// Full message access
{
  "resource": "moltspeak:messages/*",
  "action": "*"
}

// Read-only calendar
{
  "resource": "moltspeak:data/calendar/*",
  "action": "read"
}

// Specific tool with constraints
{
  "resource": "moltspeak:tools/code-execution",
  "action": "invoke",
  "constraints": {
    "languages": ["python", "javascript"],
    "timeout_seconds": 30,
    "network_access": false
  }
}

// Delegation with re-delegation allowed
{
  "resource": "moltspeak:tasks/research/*",
  "action": ["create", "read", "delegate"],
  "constraints": {
    "max_delegation_depth": 2
  }
}
```

---

## Scoped Permissions

### Permission Hierarchy

```
┌─────────────────────────────────────────────────────────────────┐
│                    Permission Scoping                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  PLATFORM SCOPE                                                  │
│  └─ Where can the delegate act?                                  │
│     • platforms: ["discord", "telegram"]                         │
│     • endpoints: ["https://api.example.com/*"]                   │
│                                                                  │
│  RESOURCE SCOPE                                                  │
│  └─ What resources can be accessed?                              │
│     • resource patterns with wildcards                           │
│     • specific resource IDs                                      │
│                                                                  │
│  ACTION SCOPE                                                    │
│  └─ What operations are allowed?                                 │
│     • read, write, delete, send, invoke                          │
│     • action-specific constraints                                │
│                                                                  │
│  CONTEXT SCOPE                                                   │
│  └─ Under what circumstances?                                    │
│     • projects, conversations, sessions                          │
│     • purpose-bound usage                                        │
│                                                                  │
│  VALUE SCOPE                                                     │
│  └─ What are the limits?                                         │
│     • max transaction values                                     │
│     • rate limits                                                │
│     • usage quotas                                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Scope Narrowing

Delegations can only narrow scope, never expand:

```json
// Parent delegation (from Human to Agent A)
{
  "issuer": "did:molt:key:z6MkHuman...",
  "audience": "did:molt:key:z6MkAgentA...",
  "capabilities": [
    {
      "resource": "moltspeak:transactions/*",
      "action": "*",
      "constraints": {
        "max_value_usd": 10000
      }
    }
  ]
}

// Valid child delegation (Agent A to Agent B)
{
  "issuer": "did:molt:key:z6MkAgentA...",
  "audience": "did:molt:key:z6MkAgentB...",
  "capabilities": [
    {
      "resource": "moltspeak:transactions/recurring/*",
      "action": "read",  // Narrowed from *
      "constraints": {
        "max_value_usd": 500  // Narrowed from 10000
      }
    }
  ],
  "proof_chain": ["delegation:parent-uuid"]
}

// INVALID child delegation (expands scope)
{
  "issuer": "did:molt:key:z6MkAgentA...",
  "audience": "did:molt:key:z6MkAgentB...",
  "capabilities": [
    {
      "resource": "moltspeak:transactions/*",
      "action": "*",
      "constraints": {
        "max_value_usd": 50000  // ❌ EXCEEDS PARENT
      }
    }
  ]
}
```

### Common Scope Patterns

```json
// Read-only assistant
{
  "capabilities": [
    {"resource": "moltspeak:messages/*", "action": "read"},
    {"resource": "moltspeak:data/*", "action": "read"}
  ]
}

// Task worker
{
  "capabilities": [
    {"resource": "moltspeak:tasks/*", "action": ["read", "update"]},
    {"resource": "moltspeak:tools/approved/*", "action": "invoke"}
  ]
}

// Communication proxy
{
  "capabilities": [
    {"resource": "moltspeak:messages/*", "action": ["send", "receive"]},
  ],
  "constraints": {
    "platforms": ["discord"],
    "require_approval_for": ["external_contact"]
  }
}
```

---

## Delegation Chains

### Chain Structure

Delegation can form chains from root (human) to leaf (acting agent):

```
Human (Root)
  │
  │ Delegation D1: [all powers]
  ▼
Agent A (Primary)
  │
  │ Delegation D2: [communicate, research]
  ▼
Agent B (Research Specialist)
  │
  │ Delegation D3: [research in domain X]
  ▼
Agent C (Domain Expert)
```

### Proof Chain

Each delegation includes proofs of its lineage:

```json
{
  "id": "delegation:d3",
  "issuer": "did:molt:key:z6MkAgentB...",
  "audience": "did:molt:key:z6MkAgentC...",
  "capabilities": [...],
  "proof_chain": [
    "delegation:d1",  // Human → Agent A
    "delegation:d2"   // Agent A → Agent B
  ],
  "signature": "..."
}
```

### Chain Validation

```python
def validate_delegation_chain(delegation):
    """Validate a delegation and its proof chain."""
    
    # 1. Verify signature
    if not verify_signature(delegation):
        return False, "Invalid signature"
    
    # 2. Check time bounds
    now = datetime.now()
    if delegation.not_before and now < delegation.not_before:
        return False, "Delegation not yet active"
    if delegation.expires and now > delegation.expires:
        return False, "Delegation expired"
    
    # 3. Validate proof chain
    for proof_id in delegation.proof_chain:
        parent = fetch_delegation(proof_id)
        
        # Parent must be valid
        valid, reason = validate_delegation_chain(parent)
        if not valid:
            return False, f"Invalid parent: {reason}"
        
        # Parent must authorize issuer
        if parent.audience != delegation.issuer:
            return False, "Proof chain broken"
        
        # Capabilities must be subset of parent
        if not is_subset(delegation.capabilities, parent.capabilities):
            return False, "Capabilities exceed parent scope"
        
        # Parent must allow delegation
        if not parent.policy.allow_delegation:
            return False, "Parent forbids delegation"
    
    return True, "Valid"
```

### Chain Depth Limits

To prevent infinite chains and complexity:

```json
{
  "policy": {
    "allow_delegation": true,
    "max_delegation_depth": 3  // Maximum chain length from root
  }
}
```

---

## Time-Limited Delegation

### Time Constraints

```json
{
  "conditions": {
    "not_before": "2024-01-15T10:00:00Z",      // Start time
    "expires": "2024-01-22T10:00:00Z",          // End time
    "max_duration": "P7D",                       // ISO 8601 duration
    "timezone": "UTC"
  }
}
```

### Common Patterns

```json
// One-hour session delegation
{
  "conditions": {
    "expires": "2024-01-15T11:00:00Z"
  }
}

// Working hours only
{
  "conditions": {
    "schedule": {
      "days": ["monday", "tuesday", "wednesday", "thursday", "friday"],
      "hours": {"start": "09:00", "end": "17:00"},
      "timezone": "America/New_York"
    }
  }
}

// Single-use delegation
{
  "conditions": {
    "max_uses": 1,
    "expires": "2024-01-15T23:59:59Z"
  }
}

// Renewable delegation
{
  "conditions": {
    "expires": "2024-01-22T10:00:00Z",
    "renewable": true,
    "max_renewals": 4,
    "renewal_period": "P7D"
  }
}
```

### Automatic Expiration

Expired delegations MUST be rejected:

```python
def check_delegation_active(delegation):
    now = datetime.utcnow()
    
    if delegation.conditions.not_before:
        if now < delegation.conditions.not_before:
            return False, "Not yet active"
    
    if delegation.conditions.expires:
        if now > delegation.conditions.expires:
            return False, "Expired"
    
    if delegation.conditions.max_uses:
        uses = get_delegation_usage_count(delegation.id)
        if uses >= delegation.conditions.max_uses:
            return False, "Max uses exceeded"
    
    return True, "Active"
```

---

## Revocation

### Revocation Methods

#### 1. Explicit Revocation

Issuer signs a revocation statement:

```json
{
  "type": "DelegationRevocation",
  "delegation_id": "delegation:uuid",
  "revoked_at": "2024-01-17T15:30:00Z",
  "reason": "Task completed",
  "revoked_by": "did:molt:key:z6MkAgentA...",
  "signature": "z58DAdFfa9..."
}
```

#### 2. Parent Revocation

Revoking a parent revokes all children:

```
Human revokes D1
  └── D2 automatically revoked (child of D1)
        └── D3 automatically revoked (child of D2)
```

#### 3. Capability Revocation

Revoke specific capabilities within a delegation:

```json
{
  "type": "CapabilityRevocation",
  "delegation_id": "delegation:uuid",
  "revoked_capabilities": [
    {"resource": "moltspeak:tools/code-execution", "action": "*"}
  ],
  "remaining_active": true,  // Other caps still valid
  "revoked_at": "2024-01-17T15:30:00Z",
  "signature": "z58DAdFfa9..."
}
```

### Revocation Distribution

```
┌─────────────────────────────────────────────────────────────────┐
│                  Revocation Distribution                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Issuer creates signed revocation                             │
│         │                                                        │
│         ▼                                                        │
│  2. Broadcast to:                                                │
│     • Revocation registry (global CRL)                           │
│     • Known delegates (direct notification)                      │
│     • Known verifiers (relay nodes)                              │
│         │                                                        │
│         ▼                                                        │
│  3. Verifiers check registry before accepting delegations        │
│         │                                                        │
│         ▼                                                        │
│  4. Delegates receive notification and stop using token          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Revocation Checking

```python
def check_delegation_revoked(delegation_id):
    """Check if a delegation has been revoked."""
    
    # Check local cache first
    if delegation_id in local_revocation_cache:
        return True
    
    # Check global revocation registry
    revocation = query_revocation_registry(delegation_id)
    if revocation:
        local_revocation_cache.add(delegation_id)
        return True
    
    # Check parent delegations
    delegation = fetch_delegation(delegation_id)
    for parent_id in delegation.proof_chain:
        if check_delegation_revoked(parent_id):
            return True
    
    return False
```

### Grace Periods

Optional grace period for revocation propagation:

```json
{
  "type": "DelegationRevocation",
  "delegation_id": "delegation:uuid",
  "revoked_at": "2024-01-17T15:30:00Z",
  "effective_at": "2024-01-17T16:00:00Z",  // 30 min grace
  "reason": "Planned revocation"
}
```

---

## Use Cases

### Use Case 1: Research Team

```
Human (Project Owner)
  │
  └── Agent A (Research Coordinator)
        ├── Agent B (Web Researcher)
        │     └─ Can: search web, read documents
        │     └─ Cannot: write, modify, transact
        │
        └── Agent C (Data Analyst)
              └─ Can: read data, run analysis tools
              └─ Cannot: search web, contact external
```

### Use Case 2: Customer Service

```
Human (Business Owner)
  │
  └── Agent A (Customer Service Lead)
        ├── Agent B (Tier 1 Support)
        │     └─ Can: read tickets, respond with templates
        │     └─ Cannot: refunds, escalations
        │
        └── Agent C (Tier 2 Support)
              └─ Can: read tickets, respond freely, refunds up to $50
              └─ Cannot: refunds over $50, policy changes
```

### Use Case 3: One-Time Task Delegation

```json
{
  "issuer": "did:molt:key:z6MkAgentA...",
  "audience": "did:molt:key:z6MkAgentB...",
  "capabilities": [
    {
      "resource": "moltspeak:tasks/book-restaurant",
      "action": "execute",
      "constraints": {
        "location": "San Francisco",
        "party_size_max": 4,
        "budget_usd_max": 200
      }
    }
  ],
  "conditions": {
    "max_uses": 1,
    "expires": "2024-01-20T23:59:59Z"
  }
}
```

### Use Case 4: Cross-Organization Collaboration

```
Org A's Agent (Partner Interface)
  │
  └── Org B's Agent (Collaboration Agent)
        └─ Can: read shared project data
        └─ Can: create tasks in shared queue
        └─ Cannot: access internal Org A data
        └─ Cannot: modify Org A settings
```

---

## Security Model

### Threat: Privilege Escalation

**Attack:** Delegate creates delegation with more power than they have.

**Mitigation:**
- All delegations validated against proof chain
- Capabilities must be strict subset of parent
- Cryptographic signatures prevent forgery

### Threat: Token Theft

**Attack:** Attacker steals delegation token and uses it.

**Mitigation:**
- Short-lived tokens (expire quickly)
- Single-use tokens for sensitive operations
- Bind tokens to delegate's key (proof of possession)
- Revocation on compromise detection

### Threat: Replay Attack

**Attack:** Valid delegation used after it should be invalid.

**Mitigation:**
- Strict timestamp checking
- Revocation list checking
- Nonces for single-use delegations
- Usage counting and limits

### Threat: Chain Injection

**Attack:** Attacker inserts fake delegation into proof chain.

**Mitigation:**
- Each link cryptographically signed
- Full chain validation on every use
- Root tracing to known-good origins

### Best Practices

1. **Minimal Scope**: Only delegate what's needed
2. **Short Duration**: Use shortest practical time bounds
3. **Single Use**: For sensitive operations, use max_uses: 1
4. **No Re-delegation**: Set allow_delegation: false by default
5. **Audit Trail**: Log all delegation uses
6. **Regular Review**: Periodically audit active delegations

---

## Protocol Integration

### Delegation in MoltSpeak Messages

```json
{
  "v": "0.1",
  "op": "task",
  "from": {
    "did": "did:molt:key:z6MkAgentB...",
    "delegation": "delegation:uuid"
  },
  "to": {
    "did": "did:molt:key:z6MkService..."
  },
  "p": {
    "action": "create",
    "task": {...}
  },
  "sig": "z58DAdFfa9..."
}
```

The recipient:
1. Verifies signature by Agent B
2. Fetches delegation:uuid
3. Validates delegation chain
4. Checks Agent B has required capability
5. Checks delegation is active (time, uses)
6. Checks delegation not revoked
7. Processes request on behalf of delegation issuer

---

*MoltID Delegation Specification v1.0*
*Status: Draft*
*Last Updated: 2025-01-31*
