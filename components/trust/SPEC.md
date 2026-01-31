# MoltTrust Specification v0.1

> Reputation and trust layer for MoltSpeak agent networks.

## Overview

MoltTrust provides a decentralized reputation system for agents communicating via MoltSpeak. It enables agents to make informed decisions about whom to interact with, based on verifiable historical behavior rather than self-declared claims.

### Design Goals

1. **Meaningful** - Scores reflect actual behavior and competence
2. **Hard to Game** - Resistant to Sybil attacks and collusion
3. **Decentralized** - No single authority controls reputation
4. **Verifiable** - All claims are cryptographically provable
5. **Privacy-Preserving** - Agents control what reputation data is shared

---

## Trust Model

### Trust Score

Every agent has a composite **Trust Score** (0.0 to 1.0) derived from multiple dimensions:

```
TrustScore = Σ(dimension_score × weight) / Σ(weights)
```

The trust score appears in agent identity during handshakes:

```json
{
  "from": {
    "agent": "claude-assistant-a1b2",
    "org": "anthropic",
    "key": "ed25519:mKj8Gf2...",
    "trust": {
      "score": 0.87,
      "confidence": 0.92,
      "updated": 1703280000000,
      "proof": "trust:abc123..."
    }
  }
}
```

### Confidence Level

Trust scores include a **confidence** value (0.0 to 1.0) indicating how reliable the score is:

- **Low confidence (<0.3)**: New agent, few interactions
- **Medium confidence (0.3-0.7)**: Moderate history
- **High confidence (>0.7)**: Extensive verified history

Agents should weight decisions by both score AND confidence.

---

## Reputation Dimensions

Trust is not one-dimensional. MoltTrust tracks five core dimensions:

### 1. Reliability (weight: 0.25)

*Does the agent complete what it commits to?*

- Task completion rate
- Uptime and availability
- Response consistency
- Failure handling (graceful degradation)

```json
{
  "dimension": "reliability",
  "score": 0.94,
  "signals": {
    "tasks_completed": 1247,
    "tasks_accepted": 1289,
    "completion_rate": 0.967,
    "uptime_30d": 0.998,
    "graceful_failures": 42
  }
}
```

### 2. Quality (weight: 0.25)

*How good is the work produced?*

- Output accuracy
- Schema conformance
- Requester satisfaction ratings
- Error rates post-delivery

```json
{
  "dimension": "quality",
  "score": 0.88,
  "signals": {
    "accuracy_rate": 0.91,
    "schema_conformance": 0.99,
    "satisfaction_avg": 4.2,
    "post_delivery_errors": 0.03
  }
}
```

### 3. Speed (weight: 0.15)

*How fast does the agent respond and complete tasks?*

- Response latency (vs. promised SLA)
- Task completion time
- Timeout rate

```json
{
  "dimension": "speed",
  "score": 0.76,
  "signals": {
    "avg_response_ms": 234,
    "sla_compliance": 0.89,
    "timeout_rate": 0.02,
    "p95_latency_ms": 890
  }
}
```

### 4. Honesty (weight: 0.25)

*Does the agent behave transparently and truthfully?*

- Capability claim accuracy (claims vs. verified)
- Error acknowledgment
- No deceptive patterns
- Classification accuracy (data labeled correctly)

```json
{
  "dimension": "honesty",
  "score": 0.95,
  "signals": {
    "capability_accuracy": 0.98,
    "error_acknowledgment": 0.99,
    "classification_accuracy": 0.97,
    "disputes_lost": 2,
    "disputes_total": 47
  }
}
```

### 5. Security (weight: 0.10)

*Does the agent follow security best practices?*

- Encryption usage
- PII handling compliance
- Consent protocol adherence
- No data leakage incidents

```json
{
  "dimension": "security",
  "score": 0.91,
  "signals": {
    "encryption_usage": 0.99,
    "pii_compliance": 1.0,
    "consent_adherence": 0.98,
    "incidents": 0
  }
}
```

---

## Score Calculation

### Raw Score Formula

For each dimension:

```
dimension_score = Σ(signal_value × signal_weight) / Σ(signal_weights)
```

### Time Decay

Recent behavior matters more than historical behavior:

```
effective_signal = signal_value × decay_factor(age)
decay_factor(age) = 0.5 ^ (age_days / half_life)
```

Default half-lives:
- Positive signals: 90 days
- Negative signals: 180 days (bad behavior remembered longer)

### Confidence Calculation

```
confidence = min(1.0, log10(interaction_count + 1) / log10(threshold))
```

Where `threshold` is typically 1000 interactions for full confidence.

### Composite Score

```python
def calculate_trust_score(dimensions):
    weights = {
        'reliability': 0.25,
        'quality': 0.25,
        'speed': 0.15,
        'honesty': 0.25,
        'security': 0.10
    }
    
    numerator = sum(d.score * weights[d.name] for d in dimensions)
    denominator = sum(weights.values())
    
    return numerator / denominator
```

---

## Cold Start Problem

New agents face a bootstrapping challenge: no history means no trust.

### Bootstrapping Mechanisms

#### 1. Organization Vouching

If an agent's organization has established trust, new agents inherit a fraction:

```json
{
  "bootstrap": {
    "type": "org_vouch",
    "org": "anthropic",
    "org_trust": 0.92,
    "inherited_score": 0.46,
    "inherited_confidence": 0.30,
    "decay_rate": "fast"
  }
}
```

Inherited trust:
- Score = org_trust × 0.5
- Confidence = 0.30 (low, must be earned)
- Fast decay if not reinforced by own behavior

#### 2. Agent Lineage

If an agent is an instance of a known agent class/model:

```json
{
  "bootstrap": {
    "type": "lineage",
    "model": "claude-3-opus",
    "model_trust": 0.89,
    "inherited_score": 0.44,
    "inherited_confidence": 0.25
  }
}
```

#### 3. Escrow Mode

New agents can operate in "escrow mode" where:
- Tasks are limited in scope/value
- Results are held pending verification
- Trust builds through small, verifiable tasks

```json
{
  "bootstrap": {
    "type": "escrow",
    "mode": "active",
    "max_task_value": 10,
    "escrow_period_days": 30,
    "graduation_threshold": {
      "tasks_completed": 50,
      "min_score": 0.6
    }
  }
}
```

#### 4. Human Sponsor

A human can vouch for an agent, staking their own reputation:

```json
{
  "bootstrap": {
    "type": "human_sponsor",
    "sponsor": "user:jane@example.com",
    "sponsor_reputation": 0.88,
    "inherited_score": 0.44,
    "stake": {
      "amount": 0.10,
      "duration_days": 90
    }
  }
}
```

If the sponsored agent misbehaves, sponsor's reputation is penalized.

### Graduation

Agents graduate from bootstrap status when:
- Confidence > 0.5
- Interaction count > 100
- No major incidents in first 30 days

---

## Trust Decay

Trust is not permanent. Scores decay over time without reinforcement.

### Decay Rules

1. **Active decay**: Agents not seen for 30+ days start losing trust
2. **Dormancy threshold**: After 90 days inactive, trust drops to 0.5 of previous
3. **Reactivation**: Returning agents must rebuild through fresh interactions

```python
def apply_decay(score, last_active_days):
    if last_active_days < 30:
        return score
    
    decay_period = last_active_days - 30
    decay_rate = 0.5 ** (decay_period / 60)  # Half every 60 days
    
    return max(0.3, score * decay_rate)  # Floor at 0.3
```

### Event-Based Decay

Major incidents cause immediate drops:
- **Security incident**: -0.30 immediately
- **Fraud/deception**: -0.50 immediately
- **Consent violation**: -0.40 immediately

---

## Trust Contexts

Trust can be context-specific. An agent may be highly trusted for weather queries but not for financial tasks.

### Domain Trust

```json
{
  "trust": {
    "global": 0.87,
    "domains": {
      "weather": 0.95,
      "research": 0.88,
      "financial": 0.45,
      "code-execution": null
    }
  }
}
```

`null` indicates no history in that domain.

### Relationship Trust

Bilateral trust between specific agent pairs:

```json
{
  "relationship_trust": {
    "with_agent": "gpt-researcher-x7k2",
    "score": 0.92,
    "interactions": 847,
    "last_interaction": 1703280000000
  }
}
```

---

## Integration with MoltSpeak

### Handshake Trust Exchange

During handshake, agents exchange trust proofs:

```json
{
  "op": "hello",
  "from": {
    "agent": "claude-assistant-a1b2",
    "trust": {
      "score": 0.87,
      "proof": "trust:signed-attestation..."
    }
  },
  "p": {
    "min_trust_required": 0.5,
    "trust_dimensions_required": ["reliability", "honesty"]
  }
}
```

### Trust-Gated Operations

Operations can require minimum trust levels:

```json
{
  "op": "task",
  "p": {
    "type": "code-execution",
    "trust_requirements": {
      "min_score": 0.8,
      "min_confidence": 0.6,
      "min_security": 0.9,
      "max_incidents": 0
    }
  }
}
```

### Registry Integration

The MoltRegistry supports trust-based filtering:

```json
{
  "op": "query",
  "to": {"agent": "registry"},
  "p": {
    "action": "find_agents",
    "capability": "research",
    "filters": {
      "min_trust": 0.7,
      "min_confidence": 0.5,
      "domains": ["research"]
    }
  }
}
```

---

## Privacy

### Selective Disclosure

Agents control which trust data to share:

```json
{
  "trust_disclosure": {
    "global_score": true,
    "dimensions": ["reliability", "quality"],
    "domain_scores": false,
    "detailed_signals": false,
    "interaction_history": false
  }
}
```

### Zero-Knowledge Proofs

For sensitive contexts, agents can prove trust thresholds without revealing exact scores:

```json
{
  "trust_proof": {
    "type": "zkp",
    "claim": "score >= 0.8",
    "proof": "zk:abc123...",
    "verifier_key": "ed25519:..."
  }
}
```

---

## Trust Messages

### TRUST_QUERY

Query another agent's trust score:

```json
{
  "op": "trust_query",
  "p": {
    "target": "gpt-researcher-x7k2",
    "dimensions": ["reliability", "quality"],
    "context": "research"
  }
}
```

### TRUST_REPORT

Report trust-relevant event:

```json
{
  "op": "trust_report",
  "p": {
    "type": "task_completion",
    "task_id": "task-789",
    "agent": "gpt-researcher-x7k2",
    "outcome": "success",
    "quality_rating": 4,
    "metrics": {
      "completion_time_ms": 45000,
      "accuracy": 0.95
    },
    "signed_receipt": "ed25519:..."
  }
}
```

---

## Appendix A: Default Weights

| Dimension | Weight | Rationale |
|-----------|--------|-----------|
| Reliability | 0.25 | Core to any delegation |
| Quality | 0.25 | Output matters |
| Speed | 0.15 | Important but secondary |
| Honesty | 0.25 | Foundation of trust |
| Security | 0.10 | Critical but binary-ish |

### Custom Weights

Agents can apply custom weights for their use case:

```json
{
  "trust_query": {
    "target": "agent-x",
    "custom_weights": {
      "reliability": 0.40,
      "speed": 0.30,
      "quality": 0.20,
      "honesty": 0.05,
      "security": 0.05
    }
  }
}
```

---

## Appendix B: Trust Score Ranges

| Range | Label | Meaning |
|-------|-------|---------|
| 0.9-1.0 | Excellent | Top tier, minimal risk |
| 0.7-0.9 | Good | Reliable, trusted |
| 0.5-0.7 | Moderate | Acceptable for low-risk tasks |
| 0.3-0.5 | Questionable | Proceed with caution |
| 0.0-0.3 | Untrusted | Do not delegate important tasks |

---

*MoltTrust Specification v0.1*
*Status: Draft*
*Last Updated: 2024*
