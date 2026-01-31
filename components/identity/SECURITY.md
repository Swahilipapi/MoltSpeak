# MoltID Security: Threat Model & Mitigations

> Security analysis of the MoltID identity system, including attack vectors, threat scenarios, and defense mechanisms.

## Table of Contents
1. [Overview](#overview)
2. [Threat Actors](#threat-actors)
3. [Asset Inventory](#asset-inventory)
4. [Key Compromise Scenarios](#key-compromise-scenarios)
5. [Identity Theft Protection](#identity-theft-protection)
6. [Impersonation Attacks](#impersonation-attacks)
7. [Delegation Security](#delegation-security)
8. [Attestation Security](#attestation-security)
9. [Operational Security](#operational-security)
10. [Incident Response](#incident-response)

---

## Overview

This document analyzes security threats specific to MoltID and the identity layer of MoltSpeak. It complements the main [MoltSpeak Security Model](../../SECURITY.md) with identity-specific concerns.

### Security Principles

1. **Key Sovereignty**: Agents control their own keys; no central authority
2. **Cryptographic Proof**: All identity claims are mathematically verifiable
3. **Defense in Depth**: Multiple layers of protection
4. **Fail Secure**: Ambiguous situations result in denial
5. **Minimal Trust**: Verify everything, assume compromise possible

### Threat Landscape

```
┌─────────────────────────────────────────────────────────────────┐
│                    MoltID Threat Landscape                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  EXTERNAL THREATS                 INTERNAL THREATS               │
│  ├─ Key theft                     ├─ Rogue operator              │
│  ├─ Identity spoofing             ├─ Compromised agent           │
│  ├─ Attestation forgery           ├─ Malicious delegate          │
│  ├─ Delegation abuse              └─ Configuration errors        │
│  └─ Recovery exploit                                             │
│                                                                  │
│  SYSTEMIC THREATS                 PROTOCOL THREATS               │
│  ├─ Cryptographic breaks          ├─ Replay attacks              │
│  ├─ Registry compromise           ├─ Timing attacks              │
│  ├─ Network attacks               └─ Proof chain manipulation    │
│  └─ Social engineering                                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Threat Actors

### Actor 1: External Attacker

**Profile:** Individual or group attempting to compromise agent identities for profit or disruption.

**Capabilities:**
- Network access (passive or active)
- Publicly available information
- Standard hacking tools and techniques
- May control some agents

**Goals:**
- Steal valuable agent identities
- Impersonate high-value agents
- Exfiltrate data via compromised agents
- Disrupt agent-to-agent communication

### Actor 2: Rogue Operator

**Profile:** Insider with administrative access to agent infrastructure.

**Capabilities:**
- Access to key storage systems
- Ability to deploy/modify agents
- Knowledge of internal systems
- May have backup key access

**Goals:**
- Theft of key material
- Creating unauthorized delegations
- Covering tracks
- Long-term persistent access

### Actor 3: Compromised Agent

**Profile:** Previously legitimate agent that has been taken over.

**Capabilities:**
- Valid identity credentials
- Existing sessions and relationships
- Established trust with other agents
- Access to delegation tokens

**Goals:**
- Pivot to other agents
- Create malicious delegations
- Exfiltrate data
- Maintain persistence

### Actor 4: Nation-State Actor

**Profile:** Well-resourced adversary with advanced capabilities.

**Capabilities:**
- Zero-day exploits
- Quantum computing (future)
- Legal compulsion (warrants)
- Supply chain attacks

**Goals:**
- Surveillance
- Strategic disruption
- Intelligence gathering
- Infrastructure control

---

## Asset Inventory

### Critical Assets

| Asset | Description | Impact if Compromised |
|-------|-------------|----------------------|
| **Identity Private Key** | Ed25519 signing key | Complete identity takeover |
| **Encryption Private Key** | X25519 key agreement key | Historical message decryption |
| **Recovery Keys** | Threshold keys for recovery | Permanent identity loss or takeover |
| **Delegation Tokens** | Active authorization tokens | Unauthorized actions |
| **Attestation Proofs** | Human-agent binding | Impersonation of human |
| **DID Document** | Public identity information | Misdirection, phishing |
| **Key Storage Backend** | HSM, file system, etc. | Mass key compromise |

### Asset Sensitivity Matrix

```
┌─────────────────────────────────────────────────────────────────┐
│              Asset Sensitivity Matrix                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  CONFIDENTIALITY         INTEGRITY            AVAILABILITY       │
│                                                                  │
│  Identity Key: CRITICAL  Identity Key: CRIT   Identity: HIGH     │
│  Encryption: CRITICAL    Encryption: HIGH     Encryption: MED    │
│  Recovery: CRITICAL      Recovery: CRITICAL   Recovery: LOW      │
│  Delegation: HIGH        Delegation: HIGH     Delegation: MED    │
│  Attestation: MEDIUM     Attestation: HIGH    Attestation: MED   │
│  DID Doc: LOW            DID Doc: HIGH        DID Doc: HIGH      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Compromise Scenarios

### Scenario 1: Identity Key Theft

**Description:** Attacker obtains the Ed25519 identity private key.

**Impact:** 
- Complete identity takeover
- Can sign messages as the agent
- Can create delegations
- Can modify DID document (if web-based)

**Attack Vectors:**
1. Memory dump from running agent
2. Key file theft from disk
3. HSM vulnerability exploitation
4. Backup key exposure
5. Supply chain compromise

**Detection:**
- Multiple signatures from different locations
- Unusual message patterns
- Delegation creation anomalies
- DID document changes without owner action

**Response:**
1. Immediately rotate to recovery keys
2. Revoke old identity key
3. Notify all known contacts
4. Audit all actions since compromise
5. Investigate root cause

**Mitigation:**
```yaml
preventive:
  - Store keys in HSM/secure enclave
  - Never export private keys in plaintext
  - Use hardware-bound keys where possible
  - Implement key access auditing
  - Minimize key copies

detective:
  - Monitor for key usage anomalies
  - Alert on DID document changes
  - Track geographic usage patterns
  - Implement canary delegations
  
responsive:
  - Pre-staged recovery keys
  - Automated revocation on detection
  - Contact notification system
```

### Scenario 2: Encryption Key Theft

**Description:** Attacker obtains the X25519 encryption private key.

**Impact:**
- Can decrypt past messages (no forward secrecy at identity level)
- Can decrypt future messages if not rotated
- Can impersonate in encrypted channels

**Attack Vectors:**
- Same as identity key theft
- Additionally: cryptographic side-channel attacks

**Response:**
1. Rotate encryption key immediately
2. Notify contacts of new encryption key
3. Assess scope of exposed messages
4. Consider all past encrypted content exposed

**Mitigation:**
```yaml
preventive:
  - Use ephemeral session keys (provides forward secrecy)
  - Rotate encryption keys more frequently than identity keys
  - Implement key separation (different storage for different keys)
  
detective:
  - Monitor decryption failures (others using old key)
  - Track message timing patterns
```

### Scenario 3: Recovery Key Theft

**Description:** Attacker obtains threshold of recovery keys.

**Impact:**
- Can take over identity permanently
- Can lock out legitimate owner
- Can revoke all existing keys

**Attack Vectors:**
1. Social engineering recovery key holders
2. Compromising multiple storage locations
3. Backup key exposure
4. Insider collusion

**Response:**
1. If detected early: rotate recovery keys immediately
2. If too late: identity may be unrecoverable
3. Create new identity
4. Notify network of compromise

**Mitigation:**
```yaml
preventive:
  - Geographic distribution of recovery keys
  - Different security domains for each key
  - Time-lock on recovery operations
  - Multi-factor before recovery key use
  - Regular verification that recovery keys are secure
  
detective:
  - Alert on any recovery key access attempt
  - Monitor for recovery procedure initiation
```

### Scenario 4: Session Key Compromise

**Description:** Attacker obtains a session key derived via HKDF.

**Impact:**
- Can read/write in specific session only
- Limited scope (session expires)
- No access to identity keys

**Response:**
1. Terminate affected session
2. Establish new session with fresh key exchange
3. Limited cleanup needed

**Mitigation:**
- Short session lifetimes
- Perfect forward secrecy via ephemeral keys
- Session key never leaves memory

---

## Identity Theft Protection

### Attack: Identity Cloning

**Description:** Attacker creates a copy of an identity and uses both.

**Detection Mechanisms:**

```python
def detect_identity_cloning(agent_did):
    """Detect potential identity cloning."""
    
    # Check for concurrent sessions from different IPs
    sessions = get_active_sessions(agent_did)
    ip_addresses = set(s.ip_address for s in sessions)
    if len(ip_addresses) > expected_for_agent(agent_did):
        alert("Multiple locations detected", agent_did)
    
    # Check for message timestamp anomalies
    recent_messages = get_recent_messages(agent_did)
    for m1, m2 in pairwise(recent_messages):
        if m1.timestamp > m2.timestamp:  # Out of order
            alert("Timestamp anomaly", agent_did)
        if abs(m1.timestamp - m2.timestamp) < 100:  # Too fast
            if m1.location != m2.location:
                alert("Geographic impossibility", agent_did)
    
    # Check for conflicting DID document versions
    check_did_document_conflicts(agent_did)
```

### Attack: Sybil Attack

**Description:** Attacker creates many fake identities.

**Detection:**
- No single mechanism (by design - identities are permissionless)
- Rely on attestation and trust networks
- Rate limiting on directory registration
- Proof-of-work for bulk creation (optional)

**Mitigation:**
- Require attestation for trusted operations
- Build trust gradually (no instant high trust)
- Reputation systems for repeat interactions

### Attack: Identity Squatting

**Description:** Attacker registers handles similar to known entities.

**Examples:**
- `@clawd.anthropic.molt` vs `@claude.anthropic.molt`
- `@assistant.g00gle.molt` vs `@assistant.google.molt`

**Mitigation:**
```yaml
handle_policy:
  - Trademark holders can claim handles
  - Confusable character detection
  - Display warnings for unverified handles
  - Attestation requirement for organizational handles
```

---

## Impersonation Attacks

### Attack: Message Forgery

**Description:** Attacker creates messages appearing to be from another agent.

**Why It Fails:**
1. All messages signed by identity key
2. Signature verification is mandatory
3. Without private key, forgery is computationally infeasible

**Residual Risk:**
- Compromised key (see Key Compromise)
- Protocol implementation bugs
- Cryptographic breaks (future)

### Attack: Relay Manipulation

**Description:** Attacker controls a relay and modifies messages.

**Why It Fails:**
1. End-to-end signatures
2. Message hash in signature covers all content
3. Modification invalidates signature

**Residual Risk:**
- Relay can drop messages (DoS)
- Relay can observe metadata
- Traffic analysis possible

### Attack: DID Document Manipulation

**Description:** Attacker modifies an agent's DID document.

**Scenarios by DID Method:**

| Method | Attack Vector | Protection |
|--------|--------------|------------|
| `did:molt:key` | None (self-certifying) | Inherently secure |
| `did:molt:web` | Web server compromise | DNSSEC, monitoring |
| `did:molt:plc` | PLC directory compromise | Signed operations, audit log |

**For web-based DIDs:**
```yaml
protections:
  - DNSSEC on domain
  - CAA records restricting certificate issuance
  - DID document signature (self-signed)
  - Version history and audit log
  - Monitoring for unauthorized changes
  - Pinning in known clients
```

### Attack: Handle Hijacking

**Description:** Attacker takes over a handle's DNS or platform account.

**Mitigation:**
```yaml
multi_factor_verification:
  - Require multiple platform verifications
  - Alert if any single verification fails
  - Grace period before handle changes take effect
  - Notification to known contacts on changes
  
resilience:
  - did:molt:key is the canonical identifier
  - Handle is just a convenience alias
  - Agents should pin DID, not handle
```

---

## Delegation Security

### Attack: Delegation Forgery

**Description:** Attacker creates fake delegation claiming authority.

**Why It Fails:**
1. Delegations cryptographically signed by issuer
2. Proof chain verification required
3. Capabilities must trace back to valid root

### Attack: Delegation Replay

**Description:** Attacker reuses valid delegation after revocation or expiry.

**Mitigations:**
```python
def validate_delegation(delegation):
    # Check expiration
    if delegation.expires < now():
        raise DelegationExpired()
    
    # Check revocation
    if check_revocation_registry(delegation.id):
        raise DelegationRevoked()
    
    # Check usage limits
    if delegation.max_uses:
        uses = get_usage_count(delegation.id)
        if uses >= delegation.max_uses:
            raise DelegationExhausted()
    
    # Check proof chain (recursive)
    for parent_id in delegation.proof_chain:
        parent = fetch_delegation(parent_id)
        validate_delegation(parent)
```

### Attack: Chain Injection

**Description:** Attacker inserts fake delegation into proof chain.

**Why It Fails:**
1. Each chain link has cryptographic signature
2. Signature from actual issuer required
3. Audience must match next issuer

### Attack: Privilege Escalation

**Description:** Delegate creates delegation exceeding their authority.

**Validation:**
```python
def validate_scope_narrowing(child, parent):
    """Ensure child delegation is subset of parent."""
    
    for child_cap in child.capabilities:
        # Find matching parent capability
        parent_cap = find_covering_capability(parent.capabilities, child_cap)
        
        if not parent_cap:
            raise PrivilegeEscalation(f"No parent cap for {child_cap}")
        
        # Check resource is subset
        if not is_resource_subset(child_cap.resource, parent_cap.resource):
            raise PrivilegeEscalation("Resource scope exceeds parent")
        
        # Check actions are subset
        if not set(child_cap.actions).issubset(set(parent_cap.actions)):
            raise PrivilegeEscalation("Actions exceed parent")
        
        # Check constraints are stricter or equal
        if not constraints_stricter(child_cap.constraints, parent_cap.constraints):
            raise PrivilegeEscalation("Constraints looser than parent")
```

---

## Attestation Security

### Attack: Fake Attestation

**Description:** Attacker creates attestation claiming agent speaks for victim.

**Why It Fails:**
1. Attestation requires proof from verified platform
2. Proof involves action by actual account owner (tweet, DNS record)
3. Multi-platform verification increases confidence

### Attack: Attestation Theft

**Description:** Attacker compromises platform account and creates attestation.

**Mitigation:**
```yaml
multi_platform:
  - Require 2+ platform verifications for high trust
  - Alert if one verification fails while others succeed
  - Time-limited attestations require renewal
  
monitoring:
  - Notify via alternative channels on attestation creation
  - Allow quick revocation
  - Watchdog for unexpected attestation changes
```

### Attack: Stale Attestation

**Description:** Human loses platform access but attestation persists.

**Mitigation:**
```python
def verify_attestation_freshness(attestation):
    """Re-verify that attestation proofs still exist."""
    
    for platform_proof in attestation.proofs:
        if platform_proof.type == "twitter":
            # Check tweet still exists (or bio still has content)
            if not tweet_exists(platform_proof.tweet_id):
                if not bio_contains_verification(platform_proof.handle):
                    mark_attestation_stale(attestation)
        
        elif platform_proof.type == "dns":
            # Check DNS record still exists
            record = query_dns_txt(f"_moltid.{platform_proof.domain}")
            if attestation.agent_did not in record:
                mark_attestation_stale(attestation)
    
    return attestation.status == "active"
```

---

## Operational Security

### Key Storage Requirements

| Environment | Recommended Storage | Minimum Security |
|-------------|--------------------|--------------------|
| Development | Encrypted file | Password-protected |
| Staging | OS keychain | Access-controlled |
| Production | HSM / Secure Enclave | Hardware-backed |
| High-value | Distributed HSM + MPC | Geographic distribution |

### Access Control

```yaml
key_access_policy:
  identity_key:
    who: Agent runtime only
    when: Message signing only
    how: In-memory, never exported
    audit: Every use logged
    
  recovery_key:
    who: Human operators (2-of-3 quorum)
    when: Recovery procedures only
    how: Offline, air-gapped ceremony
    audit: Video recorded, witnessed
    
  delegation_key:
    who: Agent with delegation capability
    when: Creating delegations
    how: Rate-limited, approval workflows
    audit: All delegations logged
```

### Deployment Security

```yaml
agent_deployment:
  container_security:
    - Read-only root filesystem
    - Drop all capabilities except needed
    - No privileged mode
    - Resource limits enforced
    
  secret_management:
    - Keys injected at runtime, not in images
    - Use secret manager (Vault, AWS Secrets Manager)
    - Rotate secrets regularly
    - No secrets in environment variables
    
  network_security:
    - Egress filtering
    - mTLS for service-to-service
    - No direct internet exposure
```

### Monitoring & Alerting

```yaml
alerts:
  critical:
    - DID document modified
    - Recovery procedure initiated
    - Key access from unexpected source
    - Multiple location usage
    
  high:
    - Delegation to unknown agent
    - Attestation changes
    - Session establishment failures spike
    - Signature verification failures
    
  medium:
    - New agent registration
    - Rate limit approaches
    - Unusual message patterns
```

---

## Incident Response

### Incident Severity Levels

| Level | Criteria | Response Time |
|-------|----------|---------------|
| **P1** | Active identity compromise | Immediate |
| **P2** | Suspected key theft | 1 hour |
| **P3** | Attestation compromise | 4 hours |
| **P4** | Delegation abuse | 24 hours |

### Response Playbooks

#### Playbook: Identity Key Compromised

```markdown
## Immediate (0-15 minutes)
1. Activate recovery keys (if available)
2. Rotate identity key
3. Revoke old key via DID document and broadcast
4. Terminate all active sessions

## Short-term (15 min - 4 hours)
1. Notify all known contacts via secure channels
2. Audit all actions since estimated compromise time
3. Revoke all delegations issued by old key
4. Update attestations with new key

## Long-term (4 hours - 1 week)
1. Full forensic investigation
2. Root cause analysis
3. Implement additional controls
4. Update incident response procedures
5. External notification if required
```

#### Playbook: Attestation Compromise

```markdown
## Immediate (0-1 hour)
1. Revoke affected attestation
2. Secure compromised platform accounts
3. Notify affected human via alternative channels

## Short-term (1-24 hours)
1. Re-verify through uncompromised platforms
2. Issue new attestation
3. Notify known relying parties

## Long-term (1-7 days)
1. Investigate how platform was compromised
2. Add additional verification methods
3. Update monitoring for this scenario
```

### Communication Templates

```markdown
## Key Compromise Notification

SECURITY NOTICE: MoltID Key Rotation

Agent: did:molt:key:z6MkOLD...
Status: COMPROMISED - DO NOT TRUST

New Identity: did:molt:key:z6MkNEW...
Effective: 2024-01-15T15:30:00Z

Actions Required:
1. Remove old key from trusted contacts
2. Verify new key via [attestation link]
3. Report any suspicious activity from old key

Signed: [recovery key signature]
```

---

## Future Considerations

### Quantum Resistance

Current Ed25519/X25519 are not quantum-resistant. Migration path:

```yaml
quantum_migration:
  timeline: Begin preparation by 2027
  
  approach:
    - Hybrid signatures (classical + post-quantum)
    - SPHINCS+ for signatures
    - Kyber for key exchange
    - Backward compatibility period
    
  challenges:
    - Larger signatures (impacts message size)
    - Slower operations
    - Key size increases
```

### Threshold Signatures

For high-value identities:

```yaml
threshold_identity:
  description: "Identity key split across multiple parties"
  use_case: "Organization-controlled agents"
  
  implementation:
    - FROST threshold signatures (Ed25519-based)
    - 2-of-3 or 3-of-5 threshold
    - Geographic distribution of key shares
    - No single point of compromise
```

---

*MoltID Security Specification v1.0*
*Status: Draft*
*Last Updated: 2025-01-31*
