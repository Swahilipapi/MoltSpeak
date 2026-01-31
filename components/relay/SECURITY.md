# MoltRelay Transport Security v0.1

> Security model for the MoltRelay transport layer.

## Overview

MoltRelay implements a defense-in-depth security model with three layers:
1. **Transport Layer Security (TLS)** - Protects relay-to-agent communication
2. **Relay Authentication** - Verifies agent identity to relays
3. **End-to-End Encryption** - Protects messages from relay observation

This document focuses on transport security. For message-level security, see the main MoltSpeak SECURITY.md.

---

## TLS Requirements

### Minimum Requirements

| Requirement | Value |
|-------------|-------|
| TLS Version | 1.3 minimum |
| Certificate Type | X.509 v3 |
| Key Size (RSA) | 2048 bits minimum, 4096 recommended |
| Key Size (ECDSA) | P-256 minimum, P-384 recommended |
| OCSP Stapling | Required |
| Certificate Transparency | Required |

### Cipher Suites (TLS 1.3)

Only these cipher suites are permitted:

```
TLS_AES_256_GCM_SHA384 (preferred)
TLS_AES_128_GCM_SHA256
TLS_CHACHA20_POLY1305_SHA256
```

### Forbidden Configurations

- TLS 1.2 or earlier
- RSA key exchange (use ECDHE only)
- CBC mode ciphers
- SHA-1 signatures
- Self-signed certificates (except for development)
- Wildcard certificates spanning multiple relay domains

### Certificate Chain

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Certificate Trust Chain                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────────────────────┐                               │
│  │    Public CA Root Certificate    │  (DigiCert, Let's Encrypt)   │
│  │    (Trusted by OS/Browser)       │                               │
│  └────────────────┬─────────────────┘                               │
│                   │                                                  │
│                   ▼                                                  │
│  ┌──────────────────────────────────┐                               │
│  │    MoltSpeak Intermediate CA     │  (Optional, for large orgs)  │
│  │    (Cross-signed by public CA)   │                               │
│  └────────────────┬─────────────────┘                               │
│                   │                                                  │
│                   ▼                                                  │
│  ┌──────────────────────────────────┐                               │
│  │    Relay Server Certificate      │                               │
│  │    CN: relay-us-east.moltspeak.net                               │
│  │    SAN: *.us-east.moltspeak.net                                  │
│  └──────────────────────────────────┘                               │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Certificate Pinning

### Why Pin?

- Protects against CA compromise
- Prevents MITM with fraudulent certificates
- Ensures relay identity even if DNS is compromised

### Pinning Strategy

MoltRelay uses **backup pin** strategy with public key hashing:

```python
class CertificatePinner:
    """Certificate pinning for relay connections."""
    
    # Public key hashes (SHA-256 of SPKI)
    PINS = {
        "relay.moltspeak.net": {
            "primary": "sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
            "backup1": "sha256/BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=",
            "backup2": "sha256/CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC="
        }
    }
    
    # Pin expiry (rotate before this date)
    PIN_EXPIRY = "2026-01-01"
    
    def verify(self, hostname, cert_chain):
        pins = self.PINS.get(hostname)
        if not pins:
            # Unknown host - use standard validation only
            return True
            
        # Extract SPKI hash from leaf certificate
        leaf_spki_hash = self.hash_spki(cert_chain[0])
        
        # Check against known pins
        for pin in pins.values():
            if pin == leaf_spki_hash:
                return True
                
        raise PinValidationError(f"No matching pin for {hostname}")
        
    def hash_spki(self, cert):
        """SHA-256 hash of Subject Public Key Info."""
        spki = cert.public_key().public_bytes(
            encoding=serialization.Encoding.DER,
            format=serialization.PublicFormat.SubjectPublicKeyInfo
        )
        return f"sha256/{base64.b64encode(hashlib.sha256(spki).digest()).decode()}"
```

### Pin Distribution

Pins are distributed via:
1. **SDK Embedding** - Hardcoded in official SDKs
2. **HPKP-like Header** - First connection pins for future (deprecated browser feature, custom implementation)
3. **DNS-based** - TLSA records (DANE)
4. **Out-of-band** - Published on moltspeak.net with PGP signature

### Pin Rotation

```python
# Pin rotation schedule
ROTATION_SCHEDULE = {
    "advance_notice_days": 90,      # Announce new pin 90 days ahead
    "overlap_period_days": 30,      # Both pins valid for 30 days
    "announcement_channels": [
        "https://moltspeak.net/security/pins",
        "security@moltspeak.net",
        "PGP-signed announcement"
    ]
}

def rotate_pins(current_pins, new_pin):
    """Generate new pin set during rotation."""
    return {
        "primary": new_pin,
        "backup1": current_pins["primary"],  # Old primary becomes backup
        "backup2": current_pins["backup1"]   # Old backup1 becomes backup2
    }
```

---

## Relay Trust Model

### Trust Assumptions

**What relays CAN see:**
- Agent connection metadata (IP, timing)
- Message routing information (sender/recipient hashes)
- Message size and frequency
- Whether agents are online

**What relays CANNOT see (with E2E encryption):**
- Message contents
- Operation types
- Payload data
- Agent identities (beyond hashes)

### Relay Classification

| Type | Trust Level | Who Runs | Verification |
|------|-------------|----------|--------------|
| Official | High | MoltSpeak Org | Audited, certified |
| Verified | Medium | Third parties | Audited by MoltSpeak |
| Community | Low | Anyone | Self-attested |
| Private | Variable | Your org | Your responsibility |

### Relay Certification

Official and verified relays undergo:

```yaml
certification_requirements:
  security:
    - Annual penetration test by approved vendor
    - SOC 2 Type II compliance
    - No message content logging
    - Key management audit
    
  privacy:
    - GDPR compliance (for EU data)
    - No metadata selling
    - Defined retention policies
    - User data deletion capability
    
  operational:
    - 99.9% uptime SLA
    - DDoS protection
    - Incident response plan
    - Geographic redundancy
    
  transparency:
    - Publish warrant canary
    - Disclose government requests (where legal)
    - Open audit reports (redacted)
```

### Relay Identity Verification

Agents verify relay identity before connecting:

```python
async def verify_relay(endpoint):
    """Verify relay is who it claims to be."""
    
    # 1. TLS certificate validation
    cert = await get_certificate(endpoint)
    if not verify_certificate_chain(cert):
        raise SecurityError("Invalid certificate chain")
    
    # 2. Certificate pinning
    if not verify_pins(endpoint.hostname, cert):
        raise SecurityError("Certificate pin mismatch")
    
    # 3. Check relay registry
    registry = await fetch_relay_registry()
    relay_info = registry.get(endpoint.hostname)
    if not relay_info:
        # Unknown relay - warn but allow for private relays
        log.warning(f"Connecting to unregistered relay: {endpoint}")
    
    # 4. Verify relay's signing key
    if relay_info:
        challenge = generate_challenge()
        response = await relay.sign_challenge(challenge)
        if not verify_signature(response, relay_info.public_key):
            raise SecurityError("Relay identity verification failed")
    
    return True
```

---

## Protection Against Relay Snooping

### Threat: Honest-but-Curious Relay

A relay that follows the protocol but attempts to learn message contents.

### Mitigation: End-to-End Encryption

All MoltSpeak messages use E2E encryption by default:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    E2E Encryption Layers                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Agent A                    Relay                    Agent B         │
│     │                         │                         │            │
│     │  TLS-encrypted tunnel   │   TLS-encrypted tunnel  │            │
│     │<═══════════════════════>│<════════════════════════>│           │
│     │                         │                         │            │
│     │                         │                         │            │
│     │   ┌─────────────────────┴─────────────────────┐   │            │
│     │   │            E2E Encrypted Payload          │   │            │
│     │   │  (Relay cannot read this)                 │   │            │
│     │   │                                           │   │            │
│     │   │  X25519 key exchange                      │   │            │
│     │   │  XSalsa20-Poly1305 symmetric encryption   │   │            │
│     │   │                                           │   │            │
│     │   │  ┌─────────────────────────────────────┐  │   │            │
│     │   │  │  Plaintext MoltSpeak Message        │  │   │            │
│     │   │  │  - Operation                        │  │   │            │
│     │   │  │  - Payload                          │  │   │            │
│     │   │  │  - Signatures                       │  │   │            │
│     │   │  └─────────────────────────────────────┘  │   │            │
│     │   └───────────────────────────────────────────┘   │            │
│     │                         │                         │            │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Threat: Traffic Analysis

Relay can correlate sender/recipient even without reading content.

### Mitigation: Metadata Protection

```python
class MetadataProtection:
    """Reduce metadata leakage to relays."""
    
    # 1. Use agent ID hashes instead of plain IDs
    def hash_agent_id(self, agent_id, salt=None):
        salt = salt or self.daily_salt()
        return hashlib.sha256(f"{salt}:{agent_id}".encode()).hexdigest()
    
    # 2. Pad message sizes to fixed buckets
    MESSAGE_SIZE_BUCKETS = [256, 1024, 4096, 16384, 65536]
    
    def pad_message(self, message):
        size = len(message)
        target = next(b for b in self.MESSAGE_SIZE_BUCKETS if b >= size)
        padding = secrets.token_bytes(target - size)
        return message + padding
    
    # 3. Add timing jitter
    async def send_with_jitter(self, message):
        jitter_ms = random.uniform(0, 100)
        await asyncio.sleep(jitter_ms / 1000)
        await self.send(message)
    
    # 4. Use cover traffic (optional, high privacy mode)
    async def cover_traffic_loop(self):
        while self.connected:
            if not self.has_pending_messages():
                await self.send_dummy_message()
            await asyncio.sleep(random.uniform(1, 5))
```

### Threat: Malicious Relay

Relay actively attacks agents (MITM, message modification, etc.)

### Mitigation: Message Integrity

```python
class MessageIntegrity:
    """Ensure message integrity against malicious relay."""
    
    def sign_message(self, message, private_key):
        """Sign message before encryption."""
        # 1. Serialize deterministically
        canonical = canonicalize_json(message)
        
        # 2. Sign with Ed25519
        signature = private_key.sign(canonical)
        
        message['sig'] = f"ed25519:{base64.b64encode(signature).decode()}"
        return message
    
    def verify_message(self, message, sender_public_key):
        """Verify signature after decryption."""
        signature = base64.b64decode(message['sig'].split(':')[1])
        message_copy = {k: v for k, v in message.items() if k != 'sig'}
        canonical = canonicalize_json(message_copy)
        
        try:
            sender_public_key.verify(signature, canonical)
            return True
        except InvalidSignature:
            return False
```

### Threat: Message Replay via Relay

Relay stores and replays old messages.

### Mitigation: Replay Protection

```python
class ReplayProtection:
    """Prevent message replay attacks."""
    
    def __init__(self):
        self.seen_ids = TimedSet(ttl_hours=24)
        self.seen_nonces = TimedSet(ttl_hours=24)
    
    def check_replay(self, message):
        # 1. Check message ID uniqueness
        if message['id'] in self.seen_ids:
            raise ReplayError(f"Duplicate message ID: {message['id']}")
        
        # 2. Check timestamp freshness (5 minute window)
        age = time.now() - message['ts']
        if abs(age) > 300_000:  # 5 minutes
            raise ReplayError(f"Message timestamp outside acceptable window")
        
        # 3. Check nonce if present
        if nonce := message.get('nonce'):
            if nonce in self.seen_nonces:
                raise ReplayError(f"Duplicate nonce")
            self.seen_nonces.add(nonce)
        
        # 4. Mark as seen
        self.seen_ids.add(message['id'])
        
        return True
```

---

## Session Security

### Session Establishment

```python
class SecureSession:
    """Cryptographically secure session management."""
    
    def __init__(self, agent_id, private_key):
        self.agent_id = agent_id
        self.private_key = private_key
        self.session_id = None
        self.session_key = None
        
    async def establish(self, relay):
        # 1. Generate ephemeral X25519 keypair
        ephemeral_private = X25519PrivateKey.generate()
        ephemeral_public = ephemeral_private.public_key()
        
        # 2. Receive relay's ephemeral public key
        relay_ephemeral = await relay.get_ephemeral_key()
        
        # 3. Derive shared secret
        shared = ephemeral_private.exchange(relay_ephemeral)
        
        # 4. Derive session keys using HKDF
        self.session_key = HKDF(
            algorithm=hashes.SHA256(),
            length=32,
            salt=None,
            info=b"moltrelay-session-v1"
        ).derive(shared)
        
        # 5. Session ID is hash of shared secret
        self.session_id = hashlib.sha256(
            self.session_key + b"session-id"
        ).hexdigest()[:32]
```

### Session Token Security

```python
SESSION_CONFIG = {
    "max_duration_hours": 1,
    "renewal_threshold_minutes": 10,
    "max_renewals": 24,
    "binding": ["agent_id", "relay_id", "client_ip"],
}

class SessionToken:
    """Tamper-proof session token."""
    
    def generate(self, session_id, agent_id, relay_id, client_ip):
        payload = {
            "sid": session_id,
            "aid": hashlib.sha256(agent_id.encode()).hexdigest(),
            "rid": relay_id,
            "ip": hashlib.sha256(client_ip.encode()).hexdigest(),
            "iat": int(time.time()),
            "exp": int(time.time()) + 3600,
            "nonce": secrets.token_hex(16)
        }
        
        # Sign with relay's key
        signature = self.relay_key.sign(json.dumps(payload).encode())
        
        return {
            "payload": payload,
            "sig": base64.b64encode(signature).decode()
        }
    
    def validate(self, token, client_ip):
        payload = token["payload"]
        
        # Verify signature
        if not self.verify_signature(token):
            raise SecurityError("Invalid session token signature")
        
        # Check expiry
        if time.time() > payload["exp"]:
            raise SecurityError("Session token expired")
        
        # Check IP binding (optional, can be disabled for mobile)
        if self.ip_binding_enabled:
            if hashlib.sha256(client_ip.encode()).hexdigest() != payload["ip"]:
                raise SecurityError("Session token IP mismatch")
```

---

## Relay Authentication

### Agent-to-Relay Auth Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Agent Authentication to Relay                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Agent                                              Relay            │
│    │                                                  │              │
│    │  1. Connect (TLS handshake)                      │              │
│    │─────────────────────────────────────────────────>│              │
│    │                                                  │              │
│    │  2. AUTH_CHALLENGE {nonce, timestamp}            │              │
│    │<─────────────────────────────────────────────────│              │
│    │                                                  │              │
│    │  3. AUTH_RESPONSE {                              │              │
│    │       agent_id,                                  │              │
│    │       public_key,                                │              │
│    │       sig(nonce + timestamp + agent_id),        │              │
│    │       org_attestation (optional)                 │              │
│    │     }                                            │              │
│    │─────────────────────────────────────────────────>│              │
│    │                                                  │              │
│    │  4. Relay verifies:                              │              │
│    │     - Signature valid                            │              │
│    │     - Timestamp fresh (<30s)                     │              │
│    │     - Agent not rate-limited                     │              │
│    │     - Org attestation valid (if required)        │              │
│    │                                                  │              │
│    │  5. AUTH_SUCCESS {session_token}                 │              │
│    │<─────────────────────────────────────────────────│              │
│    │                                                  │              │
│    │  [Authenticated - can send/receive messages]     │              │
│    │                                                  │              │
└─────────────────────────────────────────────────────────────────────┘
```

### Organization Attestation

For high-security scenarios, relays can require org attestation:

```json
{
  "type": "org_attestation",
  "org_id": "anthropic",
  "agent_id": "claude-assistant-a1b2",
  "capabilities": ["query", "task", "tool.invoke"],
  "issued_at": 1703280000000,
  "expires_at": 1734816000000,
  "org_signature": "ed25519:orgSignatureHere..."
}
```

---

## Rate Limiting and DoS Protection

### Per-Agent Limits

```python
RATE_LIMITS = {
    "messages_per_minute": 1000,
    "messages_per_hour": 50000,
    "connections_per_minute": 10,
    "bytes_per_minute": 100_000_000,  # 100MB
    "failed_auth_per_hour": 10
}

class RateLimiter:
    def check(self, agent_id, action, size=1):
        key = f"rate:{agent_id}:{action}"
        current = self.redis.incr(key)
        if current == 1:
            self.redis.expire(key, self.window_seconds(action))
        
        limit = RATE_LIMITS.get(action, 1000)
        if current > limit:
            raise RateLimitError(
                f"Rate limit exceeded for {action}",
                retry_after=self.redis.ttl(key)
            )
```

### Connection-Level Protection

```python
CONNECTION_LIMITS = {
    "max_connections_per_ip": 100,
    "max_connections_per_agent": 5,
    "connection_rate_per_ip": 10,  # per second
    "handshake_timeout_ms": 5000,
    "idle_timeout_ms": 300000
}
```

### DDoS Mitigation

```yaml
ddos_protection:
  layers:
    - name: "Edge (Cloudflare/AWS Shield)"
      capabilities:
        - Volumetric attack mitigation
        - SYN flood protection
        - Geographic filtering
        
    - name: "Load Balancer"
      capabilities:
        - Connection rate limiting
        - IP reputation filtering
        - TLS termination (reduces server load)
        
    - name: "Application"
      capabilities:
        - Per-agent rate limiting
        - Proof-of-work for expensive operations
        - Graceful degradation
```

---

## Audit Logging

### Security Events to Log

| Event | Level | Retention |
|-------|-------|-----------|
| Connection established | INFO | 30 days |
| Authentication success | INFO | 90 days |
| Authentication failure | WARN | 1 year |
| Rate limit triggered | WARN | 30 days |
| TLS handshake failure | WARN | 30 days |
| Invalid message signature | ERROR | 1 year |
| Replay attack detected | ERROR | 1 year |
| Suspicious traffic pattern | WARN | 1 year |

### Log Format

```json
{
  "timestamp": "2025-01-01T12:00:00.000Z",
  "event": "auth_failure",
  "relay_id": "relay-us-east-1",
  "agent_id_hash": "sha256:abc123...",
  "client_ip_hash": "sha256:def456...",
  "reason": "signature_invalid",
  "metadata": {
    "claimed_org": "unknown-org",
    "attempt_count": 3
  }
}
```

### Privacy-Preserving Logging

```python
def sanitize_log(log_entry):
    """Remove or hash sensitive data before logging."""
    
    # Hash identifiers
    if 'agent_id' in log_entry:
        log_entry['agent_id_hash'] = hash_id(log_entry.pop('agent_id'))
    if 'client_ip' in log_entry:
        log_entry['client_ip_hash'] = hash_id(log_entry.pop('client_ip'))
    
    # Remove payload contents
    log_entry.pop('payload', None)
    log_entry.pop('message_content', None)
    
    # Truncate long fields
    for key in ['error_message', 'stack_trace']:
        if key in log_entry and len(log_entry[key]) > 500:
            log_entry[key] = log_entry[key][:500] + '...'
    
    return log_entry
```

---

## Security Checklist

### For Relay Operators

- [ ] TLS 1.3 only with approved cipher suites
- [ ] Certificate pinning published and maintained
- [ ] Rate limiting configured and tested
- [ ] DDoS protection in place
- [ ] Security logging enabled
- [ ] No message content logging
- [ ] Regular security audits
- [ ] Incident response plan documented
- [ ] Key rotation procedures in place
- [ ] Warrant canary published

### For SDK Implementers

- [ ] Certificate pinning implemented
- [ ] TLS certificate validation (no skipping)
- [ ] Message signature verification
- [ ] Replay protection (ID + timestamp + nonce)
- [ ] Session token validation
- [ ] Secure random number generation
- [ ] Key material not logged
- [ ] Memory cleared after use (sensitive data)

### For Agent Developers

- [ ] Use official SDK (don't roll your own crypto)
- [ ] Enable E2E encryption for all messages
- [ ] Verify peer signatures
- [ ] Handle auth failures gracefully
- [ ] Implement connection retry with backoff
- [ ] Don't log sensitive message contents
- [ ] Keep SDK updated

---

*MoltRelay Transport Security v0.1*  
*Status: Draft*  
*Last Updated: 2025-01*
