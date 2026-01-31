# MoltRelay Specification v0.1

> Transport layer for MoltSpeak agent-to-agent communication.

## Overview

MoltRelay provides the transport infrastructure for MoltSpeak messages, enabling agents to communicate regardless of network topology, NAT boundaries, or availability. It supports direct peer-to-peer connections when possible and relayed communication when necessary.

---

## Design Goals

1. **Universal Reachability**: Any agent can reach any other agent
2. **Low Latency**: Direct paths when possible, efficient relays when not
3. **High Availability**: Messages delivered even when recipient is offline
4. **Scale**: Support millions of concurrent agents
5. **Privacy**: Relays cannot read message contents
6. **Resilience**: No single point of failure

---

## Transport Options

### Primary: WebSocket

WebSocket is the primary transport for real-time bidirectional communication.

```
wss://www.moltspeak.xyz/relay/v1/connect
```

**Why WebSocket:**
- Persistent connections reduce handshake overhead
- Full-duplex enables request/response and push patterns
- Wide platform support (browsers, mobile, servers)
- Proxies and firewalls generally allow WebSocket traffic

### Secondary: HTTP/2

For environments where WebSocket is unavailable or for request-response patterns.

```
POST https://www.moltspeak.xyz/relay/v1/send
GET  https://www.moltspeak.xyz/relay/v1/receive (long-poll or SSE)
```

**Use cases:**
- Serverless/Lambda environments
- Strict corporate proxies
- Batch message submission
- REST API integrations

### Tertiary: libp2p (P2P)

For direct agent-to-agent communication bypassing relays entirely.

```
/dns4/peer.example.com/tcp/4001/p2p/QmPeerId...
```

**Use cases:**
- Agents on same network
- Privacy-sensitive communications
- Reduced latency requirements
- Decentralized deployments

---

## Connection Lifecycle

### WebSocket Connection

```
┌─────────────┐                           ┌─────────────┐
│    Agent    │                           │    Relay    │
└──────┬──────┘                           └──────┬──────┘
       │                                         │
       │  1. WSS CONNECT                         │
       │────────────────────────────────────────>│
       │                                         │
       │  2. TLS HANDSHAKE                       │
       │<───────────────────────────────────────>│
       │                                         │
       │  3. WS UPGRADE                          │
       │<───────────────────────────────────────>│
       │                                         │
       │  4. RELAY_AUTH {agent_id, sig, caps}    │
       │────────────────────────────────────────>│
       │                                         │
       │  5. RELAY_AUTH_OK {session_id}          │
       │<────────────────────────────────────────│
       │                                         │
       │  6. CONNECTED (ready for messages)      │
       │<───────────────────────────────────────>│
       │                                         │
```

### Connection States

```
┌────────────────────────────────────────────────────────────────┐
│                      Connection State Machine                   │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────────┐                                               │
│   │ DISCONNECTED│◄──────────────────────────────────────────┐   │
│   └──────┬──────┘                                           │   │
│          │ connect()                                        │   │
│          ▼                                                  │   │
│   ┌─────────────┐                                           │   │
│   │ CONNECTING  │───────────────────────────────────────┐   │   │
│   └──────┬──────┘  timeout/error                        │   │   │
│          │ websocket open                               │   │   │
│          ▼                                              │   │   │
│   ┌─────────────┐                                       │   │   │
│   │AUTHENTICATING────────────────────────────────────┐  │   │   │
│   └──────┬──────┘  auth failed                       │  │   │   │
│          │ auth success                              │  │   │   │
│          ▼                                           ▼  ▼   │   │
│   ┌─────────────┐                               ┌────────┐  │   │
│   │  CONNECTED  │                               │ FAILED │──┘   │
│   └──────┬──────┘                               └────────┘      │
│          │                                                      │
│          ├── send/receive messages ──►                          │
│          │                                                      │
│          │ connection lost                                      │
│          ▼                                                      │
│   ┌─────────────┐                                               │
│   │ RECONNECTING│───────────────────────────────────────────────┘
│   └─────────────┘  max retries exceeded                         │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

### Reconnection Strategy

```python
reconnect_config = {
    "initial_delay_ms": 1000,
    "max_delay_ms": 30000,
    "multiplier": 2.0,
    "jitter": 0.3,  # ±30% randomization
    "max_attempts": 10
}

def calculate_delay(attempt):
    delay = min(
        initial_delay * (multiplier ** attempt),
        max_delay
    )
    jitter_range = delay * jitter
    return delay + random.uniform(-jitter_range, jitter_range)
```

---

## Message Delivery Guarantees

### At-Least-Once Delivery (Default)

Messages are guaranteed to be delivered at least once. Duplicates may occur.

**Implementation:**
1. Sender transmits message
2. Relay persists to durable store
3. Relay forwards to recipient
4. Recipient sends ACK
5. Relay removes from store
6. If no ACK within timeout, retry

```json
{
  "type": "message",
  "id": "msg-123",
  "requires_ack": true,
  "retry_policy": {
    "max_attempts": 5,
    "timeout_ms": 30000
  }
}
```

### Exactly-Once Delivery (Optional)

For critical operations, deduplicate on recipient side.

**Implementation:**
1. Sender includes unique message ID
2. Recipient tracks seen IDs (sliding window)
3. Duplicate IDs are acknowledged but not processed

```json
{
  "type": "message",
  "id": "msg-123",
  "delivery": "exactly-once",
  "idempotency_key": "tx-abc-123"
}
```

**Recipient deduplication:**
```python
class DeduplicationStore:
    def __init__(self, window_size=100000, ttl_hours=24):
        self.seen = LRUCache(window_size)
        self.ttl = timedelta(hours=ttl_hours)
    
    def check_and_mark(self, msg_id):
        if msg_id in self.seen:
            return True  # Duplicate
        self.seen[msg_id] = datetime.now()
        return False
```

### Best-Effort Delivery

For non-critical messages (metrics, telemetry).

```json
{
  "type": "message",
  "delivery": "best-effort",
  "ttl_ms": 5000
}
```

---

## Offline Message Queuing

When a recipient is offline, messages are queued for later delivery.

### Queue Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Message Queue                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐    ┌──────────────────┐                   │
│  │ Incoming Message │───>│   Queue Router   │                   │
│  └──────────────────┘    └────────┬─────────┘                   │
│                                   │                              │
│           ┌───────────────────────┼───────────────────────┐     │
│           │                       │                       │     │
│           ▼                       ▼                       ▼     │
│  ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐│
│  │  Agent A Queue  │   │  Agent B Queue  │   │  Agent C Queue  ││
│  │  ┌───────────┐  │   │  ┌───────────┐  │   │  ┌───────────┐  ││
│  │  │ msg-001   │  │   │  │ msg-003   │  │   │  │ (empty)   │  ││
│  │  │ msg-002   │  │   │  └───────────┘  │   │  └───────────┘  ││
│  │  │ msg-007   │  │   │       │         │   │       │         ││
│  │  └───────────┘  │   │       │         │   │       │         ││
│  │       │         │   │       ▼         │   │       ▼         ││
│  │       │         │   │   CONNECTED     │   │   OFFLINE       ││
│  │       ▼         │   │   (draining)    │   │   (waiting)     ││
│  │   OFFLINE       │   └─────────────────┘   └─────────────────┘│
│  │   (queuing)     │                                            │
│  └─────────────────┘                                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Queue Limits

| Parameter | Default | Max |
|-----------|---------|-----|
| Messages per agent | 10,000 | 100,000 |
| Total queue size | 100 MB | 1 GB |
| Message retention | 7 days | 30 days |
| Max message size | 1 MB | 10 MB |

### Queue Priorities

```python
class QueuePriority(Enum):
    CRITICAL = 0    # System messages, errors
    HIGH = 1        # Time-sensitive operations
    NORMAL = 2      # Standard messages
    LOW = 3         # Background sync, telemetry
    BULK = 4        # Large transfers, non-urgent
```

### Queue Delivery on Reconnect

```python
async def deliver_queued_messages(agent_id, connection):
    queue = await get_queue(agent_id)
    
    # Deliver in priority order, oldest first within priority
    for priority in QueuePriority:
        messages = await queue.get_by_priority(priority)
        for msg in messages:
            try:
                await connection.send(msg)
                ack = await connection.wait_ack(msg.id, timeout=30)
                if ack:
                    await queue.remove(msg.id)
            except Timeout:
                break  # Stop if agent goes offline again
```

---

## Relay Server Architecture

### Single Relay Deployment

```
                         ┌─────────────────┐
                         │  Load Balancer  │
                         │  (HAProxy/NGINX)│
                         └────────┬────────┘
                                  │
          ┌───────────────────────┼───────────────────────┐
          │                       │                       │
          ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Relay Node 1  │    │   Relay Node 2  │    │   Relay Node 3  │
│  (WebSocket)    │    │  (WebSocket)    │    │  (WebSocket)    │
└────────┬────────┘    └────────┬────────┘    └────────┬────────┘
         │                      │                      │
         └──────────────────────┼──────────────────────┘
                                │
                    ┌───────────┴───────────┐
                    │                       │
                    ▼                       ▼
          ┌─────────────────┐    ┌─────────────────┐
          │     Redis       │    │   PostgreSQL    │
          │  (pub/sub,      │    │   (queues,      │
          │   sessions)     │    │   audit logs)   │
          └─────────────────┘    └─────────────────┘
```

### Geo-Distributed Deployment

```
┌────────────────────────────────────────────────────────────────────┐
│                                                                    │
│                      GeoDNS (Cloudflare/Route53)                   │
│                                                                    │
└─────────────────────────────┬──────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│   US-EAST     │     │   EU-WEST     │     │   AP-SOUTH    │
│   Cluster     │     │   Cluster     │     │   Cluster     │
│               │     │               │     │               │
│ ┌───────────┐ │     │ ┌───────────┐ │     │ ┌───────────┐ │
│ │ Relay x3  │ │     │ │ Relay x3  │ │     │ │ Relay x3  │ │
│ └───────────┘ │     │ └───────────┘ │     │ └───────────┘ │
│ ┌───────────┐ │     │ ┌───────────┐ │     │ ┌───────────┐ │
│ │ Redis     │ │     │ │ Redis     │ │     │ │ Redis     │ │
│ └───────────┘ │     │ └───────────┘ │     │ └───────────┘ │
│ ┌───────────┐ │     │ ┌───────────┐ │     │ ┌───────────┐ │
│ │ Postgres  │ │     │ │ Postgres  │ │     │ │ Postgres  │ │
│ └───────────┘ │     │ └───────────┘ │     │ └───────────┘ │
└───────┬───────┘     └───────┬───────┘     └───────┬───────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │  Inter-Region     │
                    │  Message Bus      │
                    │  (Kafka/NATS)     │
                    └───────────────────┘
```

### Relay Node Components

```python
class RelayNode:
    """Single relay server instance."""
    
    def __init__(self, config):
        self.connection_manager = ConnectionManager(max_connections=100_000)
        self.message_router = MessageRouter()
        self.queue_manager = QueueManager()
        self.session_store = SessionStore()
        self.rate_limiter = RateLimiter()
        self.metrics = MetricsCollector()
        
    async def handle_connection(self, websocket):
        conn = await self.connection_manager.accept(websocket)
        try:
            auth = await self.authenticate(conn)
            session = await self.session_store.create(auth.agent_id, conn)
            
            # Deliver queued messages
            await self.deliver_queued(auth.agent_id, conn)
            
            # Handle messages
            async for message in conn:
                await self.route_message(message, session)
        finally:
            await self.connection_manager.remove(conn)
            
    async def route_message(self, message, sender_session):
        recipient = message.to.agent
        
        # Check if recipient is connected to this relay
        if recipient_conn := self.connection_manager.get(recipient):
            await recipient_conn.send(message)
        # Check if recipient is connected to another relay
        elif recipient_relay := await self.session_store.find_relay(recipient):
            await self.message_router.forward(message, recipient_relay)
        # Queue for offline delivery
        else:
            await self.queue_manager.enqueue(recipient, message)
```

### Scaling Considerations

| Scale | Agents | Relay Nodes | Redis | Postgres | Message Bus |
|-------|--------|-------------|-------|----------|-------------|
| Small | <10K | 2 | 1 | 1 | - |
| Medium | 10K-100K | 5-10 | 3 (cluster) | 2 (primary/replica) | - |
| Large | 100K-1M | 20-50 | 6 (cluster) | 4 (sharded) | Kafka 3-node |
| Massive | 1M+ | 100+ | 12+ (geo) | 8+ (geo) | Kafka 9+ node |

---

## Direct P2P vs Relayed Communication

### Connection Decision Tree

```
┌────────────────────────────────────────────────────────────────────┐
│                   Connection Type Selection                         │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Start: Agent A wants to message Agent B                           │
│           │                                                         │
│           ▼                                                         │
│  ┌───────────────────────────┐                                      │
│  │ Is B on same local network│                                      │
│  │ (mDNS/local discovery)?   │                                      │
│  └────────────┬──────────────┘                                      │
│               │                                                     │
│       ┌───────┴───────┐                                             │
│       │Yes            │No                                           │
│       ▼               ▼                                             │
│  ┌─────────┐   ┌───────────────────────────┐                        │
│  │ Direct  │   │ Does A have B's libp2p    │                        │
│  │  TCP    │   │ multiaddr from directory? │                        │
│  └─────────┘   └────────────┬──────────────┘                        │
│                             │                                       │
│                     ┌───────┴───────┐                               │
│                     │Yes            │No                             │
│                     ▼               ▼                               │
│              ┌───────────────┐ ┌──────────────────┐                 │
│              │ Try direct    │ │  Use relay       │                 │
│              │ P2P connection│ │  connection      │                 │
│              └───────┬───────┘ └──────────────────┘                 │
│                      │                                              │
│          ┌───────────┴───────────┐                                  │
│          │Success                │Fail (NAT/firewall)               │
│          ▼                       ▼                                  │
│     ┌─────────┐            ┌───────────────────┐                    │
│     │ Direct  │            │ Relay via TURN or │                    │
│     │  P2P    │            │ MoltRelay server  │                    │
│     └─────────┘            └───────────────────┘                    │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘
```

### Hybrid Mode

Agents can maintain both P2P and relay connections simultaneously:

```python
class HybridTransport:
    """Manages both P2P and relay connections."""
    
    def __init__(self, agent_id, relay_endpoint, p2p_config):
        self.relay = RelayConnection(relay_endpoint)
        self.p2p = P2PManager(p2p_config)
        self.route_table = {}  # agent_id -> preferred transport
        
    async def send(self, message):
        recipient = message.to.agent
        
        # Check if we have a direct P2P connection
        if p2p_conn := self.p2p.get_connection(recipient):
            try:
                return await p2p_conn.send(message)
            except P2PError:
                # Fall back to relay
                pass
        
        # Use relay
        return await self.relay.send(message)
        
    async def discover_p2p(self, agent_id):
        """Try to establish P2P connection to agent."""
        # Get agent's P2P address from directory
        info = await self.relay.get_agent_info(agent_id)
        if p2p_addr := info.get('p2p_multiaddr'):
            try:
                conn = await self.p2p.connect(p2p_addr)
                self.route_table[agent_id] = 'p2p'
                return conn
            except (NATError, TimeoutError):
                self.route_table[agent_id] = 'relay'
                return None
```

---

## NAT Traversal

### Strategies

1. **STUN**: Discover public IP and port mapping
2. **TURN**: Relay through a TURN server when direct fails
3. **ICE**: Combine STUN + TURN for optimal path
4. **libp2p Relay**: Use libp2p circuit relay protocol

### NAT Traversal Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                        NAT Traversal (ICE)                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Agent A                 STUN/TURN              Agent B              │
│  (behind NAT)            Servers               (behind NAT)          │
│      │                      │                      │                 │
│      │  1. STUN request     │                      │                 │
│      │─────────────────────>│                      │                 │
│      │                      │                      │                 │
│      │  2. Your public      │                      │                 │
│      │     addr is X:Y      │                      │                 │
│      │<─────────────────────│                      │                 │
│      │                      │                      │                 │
│      │  3. Candidate X:Y    │  4. Candidate W:Z   │                 │
│      │─────────────────────────────────────────────│                 │
│      │  (via relay/signaling server)               │                 │
│      │                      │                      │                 │
│      │  5. Try direct connection X:Y <-> W:Z       │                 │
│      │<═══════════════════════════════════════════>│                 │
│      │                      │                      │                 │
│      │          ┌───────────┴───────────┐          │                 │
│      │          │ Direct works?         │          │                 │
│      │          └───────────┬───────────┘          │                 │
│      │                      │                      │                 │
│      │    ┌─────────────────┼─────────────────┐    │                 │
│      │    │Yes              │No               │    │                 │
│      │    ▼                 ▼                 │    │                 │
│      │  Direct P2P      TURN relay            │    │                 │
│      │  connection      through server        │    │                 │
│      │                      │                      │                 │
└──────┴──────────────────────┴──────────────────────┴─────────────────┘
```

### libp2p Integration

```python
from libp2p import Libp2p
from libp2p.relay import CircuitRelayClient

class P2PManager:
    """libp2p-based P2P connection manager."""
    
    def __init__(self, config):
        self.node = Libp2p()
        self.relay_client = CircuitRelayClient(self.node)
        
        # Bootstrap with known relays
        for relay in config.bootstrap_relays:
            await self.relay_client.add_relay(relay)
            
    async def connect(self, multiaddr):
        """Connect to peer, using relay if direct fails."""
        try:
            # Try direct connection
            return await self.node.connect(multiaddr, timeout=5)
        except ConnectionError:
            # Try via relay
            peer_id = extract_peer_id(multiaddr)
            return await self.relay_client.connect(peer_id)
            
    def get_multiaddr(self):
        """Get our multiaddr for sharing with peers."""
        addrs = self.node.get_addrs()
        # Return most reachable address
        return prioritize_addrs(addrs)[0]
```

---

## Agent Discovery

### Discovery Methods

| Method | Use Case | Latency | Privacy |
|--------|----------|---------|---------|
| mDNS | Local network | <10ms | High |
| DHT | Global P2P | 100-500ms | Medium |
| Relay Directory | Relay users | <50ms | Medium |
| Explicit | Pre-shared | 0ms | High |

### mDNS for Local Discovery

```python
async def local_discovery():
    """Discover agents on local network."""
    mdns = MDNSService("_moltspeak._tcp.local")
    
    async for agent in mdns.browse():
        yield {
            'agent_id': agent.name,
            'address': f"{agent.host}:{agent.port}",
            'properties': agent.txt_records
        }
```

### Relay Directory Service

```python
class AgentDirectory:
    """Central directory for agent discovery."""
    
    async def register(self, agent_info):
        """Register agent's connection info."""
        await self.store.set(
            f"agent:{agent_info.id}",
            {
                'relay': agent_info.connected_relay,
                'p2p_multiaddr': agent_info.multiaddr,
                'capabilities': agent_info.caps,
                'last_seen': time.now(),
                'ttl': 3600
            }
        )
        
    async def lookup(self, agent_id):
        """Find agent's connection info."""
        return await self.store.get(f"agent:{agent_id}")
        
    async def search(self, capability=None, org=None):
        """Search for agents by criteria."""
        query = {}
        if capability:
            query['capabilities'] = capability
        if org:
            query['org'] = org
        return await self.store.search(query)
```

---

## Performance Targets

| Metric | Target | Notes |
|--------|--------|-------|
| Connection setup | <200ms | Including TLS and auth |
| Message latency (same relay) | <10ms | P99 |
| Message latency (cross-relay) | <50ms | P99 |
| Message latency (P2P direct) | <5ms | P99, same region |
| Throughput per connection | 10K msg/s | Small messages |
| Connections per relay | 100K | With connection pooling |
| Message delivery rate | 99.99% | At-least-once |

---

## Appendix A: Message Format Extensions

MoltRelay adds transport-specific fields to MoltSpeak envelopes:

```json
{
  "moltspeak": "0.1",
  "envelope": {
    "encrypted": true,
    "algorithm": "x25519-xsalsa20-poly1305"
  },
  "transport": {
    "via": "relay",
    "relay_id": "relay-us-east-1",
    "hop_count": 1,
    "queued_at": null,
    "delivery": "at-least-once"
  },
  "ciphertext": "base64:..."
}
```

---

*MoltRelay Specification v0.1*  
*Status: Draft*  
*Last Updated: 2025-01*
