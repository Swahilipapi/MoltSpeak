# MoltRelay SDK Reference v0.1

> Pseudocode API for MoltRelay client implementation.

## Overview

This document provides implementation guidance for MoltRelay client SDKs. The API is transport-agnostic but optimized for WebSocket with fallback to HTTP/2.

---

## Core Classes

### MoltRelay

Main entry point for relay connections.

```python
class MoltRelay:
    """
    MoltRelay client for agent-to-agent message transport.
    
    Thread-safe and supports multiple concurrent conversations.
    """
    
    def __init__(
        self,
        agent_id: str,
        private_key: Ed25519PrivateKey,
        config: RelayConfig = None
    ):
        """
        Initialize MoltRelay client.
        
        Args:
            agent_id: Unique identifier for this agent
            private_key: Ed25519 private key for signing
            config: Optional configuration overrides
        """
        self.agent_id = agent_id
        self.private_key = private_key
        self.public_key = private_key.public_key()
        self.config = config or RelayConfig()
        
        self._connection: RelayConnection = None
        self._listeners: List[Callable] = []
        self._pending_acks: Dict[str, Future] = {}
        self._reconnect_task: Task = None
        self._state = ConnectionState.DISCONNECTED
        
    # ─────────────────────────────────────────────────────────────────
    # Connection Management
    # ─────────────────────────────────────────────────────────────────
    
    async def connect(
        self,
        endpoint: str,
        *,
        timeout: float = 30.0,
        verify_pins: bool = True
    ) -> 'MoltRelay':
        """
        Connect to a relay server.
        
        Args:
            endpoint: WebSocket URL (wss://relay.moltspeak.net/v1/connect)
            timeout: Connection timeout in seconds
            verify_pins: Whether to verify certificate pins
            
        Returns:
            Self for chaining
            
        Raises:
            ConnectionError: If connection fails
            AuthenticationError: If authentication fails
            SecurityError: If certificate validation fails
            
        Example:
            relay = await MoltRelay(agent_id, key).connect(
                "wss://relay.moltspeak.net/v1/connect"
            )
        """
        self._state = ConnectionState.CONNECTING
        
        try:
            # 1. Establish TLS connection with certificate validation
            transport = await self._create_transport(endpoint, verify_pins)
            
            # 2. Perform WebSocket upgrade
            websocket = await transport.upgrade_websocket()
            
            # 3. Protocol handshake
            await self._handshake(websocket, timeout)
            
            # 4. Authenticate
            await self._authenticate(websocket, timeout)
            
            # 5. Create connection wrapper
            self._connection = RelayConnection(
                websocket=websocket,
                session_id=self._session_id,
                config=self.config
            )
            
            # 6. Start message receive loop
            self._start_receive_loop()
            
            # 7. Start keepalive
            self._start_keepalive()
            
            self._state = ConnectionState.CONNECTED
            return self
            
        except Exception as e:
            self._state = ConnectionState.FAILED
            raise
    
    async def disconnect(self, graceful: bool = True) -> None:
        """
        Disconnect from relay server.
        
        Args:
            graceful: If True, send GOAWAY and wait for pending messages
        """
        if graceful and self._connection:
            # Send GOAWAY frame
            await self._connection.send_goaway()
            
            # Wait for pending ACKs (with timeout)
            await self._drain_pending(timeout=5.0)
        
        if self._connection:
            await self._connection.close()
            self._connection = None
            
        self._state = ConnectionState.DISCONNECTED
    
    @property
    def connected(self) -> bool:
        """Check if currently connected."""
        return self._state == ConnectionState.CONNECTED
    
    @property
    def state(self) -> ConnectionState:
        """Current connection state."""
        return self._state
    
    # ─────────────────────────────────────────────────────────────────
    # Message Sending
    # ─────────────────────────────────────────────────────────────────
    
    async def send(
        self,
        message: MoltSpeakMessage,
        *,
        delivery: DeliveryMode = DeliveryMode.AT_LEAST_ONCE,
        priority: Priority = Priority.NORMAL,
        timeout: float = 30.0
    ) -> SendResult:
        """
        Send a MoltSpeak message through the relay.
        
        Args:
            message: The MoltSpeak message to send
            delivery: Delivery guarantee mode
            priority: Message priority
            timeout: Send timeout in seconds
            
        Returns:
            SendResult with delivery confirmation
            
        Raises:
            NotConnectedError: If not connected
            SendError: If send fails
            TimeoutError: If acknowledgment times out
            
        Example:
            result = await relay.send(
                MoltSpeakMessage(
                    op="query",
                    to={"agent": "weather-service"},
                    p={"domain": "weather", "location": "Tokyo"}
                ),
                delivery=DeliveryMode.EXACTLY_ONCE
            )
            print(f"Message {result.message_id} delivered at {result.delivered_at}")
        """
        if not self.connected:
            raise NotConnectedError("Not connected to relay")
        
        # 1. Sign the message
        signed_message = self._sign_message(message)
        
        # 2. Encrypt if recipient supports E2E
        if self._should_encrypt(message.to):
            encrypted = await self._encrypt_message(signed_message, message.to)
            envelope = self._create_envelope(encrypted, encrypted=True)
        else:
            envelope = self._create_envelope(signed_message, encrypted=False)
        
        # 3. Add transport metadata
        envelope['transport'] = {
            'delivery': delivery.value,
            'priority': priority.value,
            'timeout_ms': int(timeout * 1000)
        }
        
        # 4. Create pending ACK future
        message_id = message.id
        ack_future = asyncio.Future()
        self._pending_acks[message_id] = ack_future
        
        try:
            # 5. Send frame
            await self._connection.send_message(envelope, priority)
            
            # 6. Wait for ACK if required
            if delivery != DeliveryMode.BEST_EFFORT:
                try:
                    ack = await asyncio.wait_for(ack_future, timeout)
                    return SendResult(
                        message_id=message_id,
                        delivered=True,
                        delivered_at=ack.timestamp,
                        recipient_online=ack.recipient_online
                    )
                except asyncio.TimeoutError:
                    if delivery == DeliveryMode.AT_LEAST_ONCE:
                        # Message may still be queued for offline delivery
                        return SendResult(
                            message_id=message_id,
                            delivered=False,
                            queued=True,
                            error="ACK timeout - message queued"
                        )
                    raise TimeoutError(f"No ACK received for {message_id}")
            else:
                return SendResult(message_id=message_id, delivered=True)
                
        finally:
            self._pending_acks.pop(message_id, None)
    
    async def send_batch(
        self,
        messages: List[MoltSpeakMessage],
        *,
        delivery: DeliveryMode = DeliveryMode.AT_LEAST_ONCE
    ) -> List[SendResult]:
        """
        Send multiple messages in a single batch.
        
        More efficient than individual sends for bulk operations.
        
        Args:
            messages: List of messages to send
            delivery: Delivery mode for all messages
            
        Returns:
            List of SendResults in same order as input
        """
        # Sign and encrypt all messages
        envelopes = []
        for msg in messages:
            signed = self._sign_message(msg)
            if self._should_encrypt(msg.to):
                encrypted = await self._encrypt_message(signed, msg.to)
                envelope = self._create_envelope(encrypted, encrypted=True)
            else:
                envelope = self._create_envelope(signed, encrypted=False)
            envelope['transport'] = {'delivery': delivery.value}
            envelopes.append(envelope)
        
        # Send batch frame
        await self._connection.send_batch(envelopes)
        
        # Collect ACKs
        results = []
        for msg, envelope in zip(messages, envelopes):
            if delivery != DeliveryMode.BEST_EFFORT:
                ack = await self._wait_ack(msg.id, timeout=30)
                results.append(SendResult(message_id=msg.id, delivered=bool(ack)))
            else:
                results.append(SendResult(message_id=msg.id, delivered=True))
        
        return results
    
    # ─────────────────────────────────────────────────────────────────
    # Message Receiving
    # ─────────────────────────────────────────────────────────────────
    
    def listen(
        self,
        callback: Callable[[MoltSpeakMessage], Awaitable[None]],
        *,
        filter: MessageFilter = None
    ) -> ListenerHandle:
        """
        Register a callback for incoming messages.
        
        Args:
            callback: Async function called for each message
            filter: Optional filter to limit which messages trigger callback
            
        Returns:
            Handle that can be used to unregister the listener
            
        Example:
            async def handle_query(msg):
                if msg.op == "query":
                    response = await process_query(msg)
                    await relay.send(response)
            
            handle = relay.listen(
                handle_query,
                filter=MessageFilter(operations=["query"])
            )
            
            # Later...
            handle.cancel()
        """
        listener = Listener(callback=callback, filter=filter)
        self._listeners.append(listener)
        
        return ListenerHandle(
            listener=listener,
            relay=self,
            cancel=lambda: self._listeners.remove(listener)
        )
    
    async def receive(
        self,
        *,
        timeout: float = None,
        filter: MessageFilter = None
    ) -> MoltSpeakMessage:
        """
        Receive a single message (pull-style).
        
        Args:
            timeout: Max time to wait (None = forever)
            filter: Optional filter for message selection
            
        Returns:
            The received message
            
        Raises:
            TimeoutError: If timeout expires
            
        Example:
            # Wait for response to specific message
            response = await relay.receive(
                timeout=30,
                filter=MessageFilter(reply_to=original_msg.id)
            )
        """
        queue = asyncio.Queue()
        
        def temp_listener(msg):
            if filter is None or filter.matches(msg):
                queue.put_nowait(msg)
        
        handle = self.listen(temp_listener)
        try:
            return await asyncio.wait_for(queue.get(), timeout)
        finally:
            handle.cancel()
    
    def on_message(
        self,
        *,
        operations: List[str] = None,
        from_agent: str = None
    ) -> Callable:
        """
        Decorator for message handlers.
        
        Example:
            @relay.on_message(operations=["query"])
            async def handle_query(msg):
                return MoltSpeakMessage(
                    op="respond",
                    re=msg.id,
                    p={"result": "data"}
                )
        """
        def decorator(func):
            filter = MessageFilter(
                operations=operations,
                from_agent=from_agent
            )
            self.listen(func, filter=filter)
            return func
        return decorator


# ─────────────────────────────────────────────────────────────────────
# Connection Pool
# ─────────────────────────────────────────────────────────────────────

class RelayPool:
    """
    Connection pool for managing multiple relay connections.
    
    Provides automatic failover, load balancing, and connection reuse.
    """
    
    def __init__(
        self,
        agent_id: str,
        private_key: Ed25519PrivateKey,
        *,
        max_connections: int = 5,
        endpoints: List[str] = None
    ):
        """
        Initialize relay connection pool.
        
        Args:
            agent_id: Agent identifier
            private_key: Signing key
            max_connections: Maximum connections per endpoint
            endpoints: List of relay endpoints (auto-discover if None)
        """
        self.agent_id = agent_id
        self.private_key = private_key
        self.max_connections = max_connections
        self.endpoints = endpoints or []
        
        self._connections: Dict[str, List[MoltRelay]] = {}
        self._health: Dict[str, EndpointHealth] = {}
        self._lock = asyncio.Lock()
    
    async def discover_relays(self) -> List[str]:
        """
        Auto-discover available relay endpoints.
        
        Uses DNS SRV records and relay registry.
        """
        endpoints = []
        
        # 1. DNS SRV lookup
        try:
            records = await dns_lookup("_moltrelay._tcp.moltspeak.net", "SRV")
            for record in records:
                endpoints.append(f"wss://{record.target}:{record.port}/v1/connect")
        except DNSError:
            pass
        
        # 2. Fetch relay registry
        try:
            registry = await http_get("https://registry.moltspeak.net/v1/relays")
            for relay in registry['relays']:
                if relay['status'] == 'active':
                    endpoints.append(relay['endpoint'])
        except HTTPError:
            pass
        
        # 3. Fallback to hardcoded defaults
        if not endpoints:
            endpoints = [
                "wss://relay-us-east.moltspeak.net/v1/connect",
                "wss://relay-eu-west.moltspeak.net/v1/connect",
                "wss://relay-ap-south.moltspeak.net/v1/connect"
            ]
        
        self.endpoints = endpoints
        return endpoints
    
    async def get_connection(
        self,
        *,
        region: str = None,
        for_recipient: str = None
    ) -> MoltRelay:
        """
        Get a connection from the pool.
        
        Args:
            region: Preferred region (e.g., "us-east")
            for_recipient: Recipient agent ID (for co-location)
            
        Returns:
            Active MoltRelay connection
        """
        async with self._lock:
            # 1. Select best endpoint
            endpoint = await self._select_endpoint(region, for_recipient)
            
            # 2. Get or create connection
            if endpoint not in self._connections:
                self._connections[endpoint] = []
            
            pool = self._connections[endpoint]
            
            # Find available connection
            for conn in pool:
                if conn.connected and not conn._busy:
                    return conn
            
            # Create new connection if under limit
            if len(pool) < self.max_connections:
                conn = await MoltRelay(
                    self.agent_id, 
                    self.private_key
                ).connect(endpoint)
                pool.append(conn)
                return conn
            
            # Wait for available connection
            return await self._wait_for_connection(endpoint)
    
    async def send(
        self,
        message: MoltSpeakMessage,
        **kwargs
    ) -> SendResult:
        """
        Send message using best available connection.
        
        Automatically handles failover if primary connection fails.
        """
        recipient = message.to.get('agent')
        conn = await self.get_connection(for_recipient=recipient)
        
        try:
            return await conn.send(message, **kwargs)
        except (ConnectionError, SendError) as e:
            # Mark connection unhealthy
            self._mark_unhealthy(conn)
            
            # Retry with different connection
            conn = await self.get_connection(for_recipient=recipient)
            return await conn.send(message, **kwargs)
    
    async def _select_endpoint(
        self,
        region: str,
        recipient: str
    ) -> str:
        """Select best endpoint based on criteria."""
        
        # 1. Check if recipient's preferred relay is known
        if recipient:
            recipient_relay = await self._lookup_recipient_relay(recipient)
            if recipient_relay and recipient_relay in self.endpoints:
                return recipient_relay
        
        # 2. Filter by region
        candidates = self.endpoints
        if region:
            candidates = [e for e in candidates if region in e]
        
        # 3. Sort by health score
        scored = [
            (e, self._health.get(e, EndpointHealth()).score)
            for e in candidates
        ]
        scored.sort(key=lambda x: x[1], reverse=True)
        
        return scored[0][0] if scored else self.endpoints[0]
    
    async def close(self):
        """Close all connections in the pool."""
        for endpoint, conns in self._connections.items():
            for conn in conns:
                await conn.disconnect()
        self._connections.clear()


# ─────────────────────────────────────────────────────────────────────
# Supporting Types
# ─────────────────────────────────────────────────────────────────────

class ConnectionState(Enum):
    """Connection state machine states."""
    DISCONNECTED = "disconnected"
    CONNECTING = "connecting"
    AUTHENTICATING = "authenticating"
    CONNECTED = "connected"
    RECONNECTING = "reconnecting"
    DRAINING = "draining"
    FAILED = "failed"


class DeliveryMode(Enum):
    """Message delivery guarantee levels."""
    BEST_EFFORT = "best-effort"      # Fire and forget
    AT_LEAST_ONCE = "at-least-once"  # Retry until ACK (may duplicate)
    EXACTLY_ONCE = "exactly-once"     # Deduplicated delivery


class Priority(Enum):
    """Message priority levels."""
    CRITICAL = 0
    HIGH = 64
    NORMAL = 128
    LOW = 192
    BULK = 255


@dataclass
class SendResult:
    """Result of a send operation."""
    message_id: str
    delivered: bool
    delivered_at: int = None
    recipient_online: bool = None
    queued: bool = False
    error: str = None


@dataclass
class MessageFilter:
    """Filter for incoming messages."""
    operations: List[str] = None
    from_agent: str = None
    from_org: str = None
    reply_to: str = None
    classification: str = None
    
    def matches(self, message: MoltSpeakMessage) -> bool:
        if self.operations and message.op not in self.operations:
            return False
        if self.from_agent and message.get('from', {}).get('agent') != self.from_agent:
            return False
        if self.from_org and message.get('from', {}).get('org') != self.from_org:
            return False
        if self.reply_to and message.get('re') != self.reply_to:
            return False
        if self.classification and message.get('cls') != self.classification:
            return False
        return True


@dataclass
class RelayConfig:
    """Configuration for relay connections."""
    # Connection
    connect_timeout_ms: int = 30000
    reconnect_enabled: bool = True
    reconnect_max_attempts: int = 10
    reconnect_initial_delay_ms: int = 1000
    reconnect_max_delay_ms: int = 30000
    
    # Keepalive
    keepalive_interval_ms: int = 30000
    keepalive_timeout_ms: int = 10000
    
    # Security
    verify_certificates: bool = True
    verify_pins: bool = True
    require_e2e_encryption: bool = True
    
    # Performance
    compression_enabled: bool = True
    compression_threshold_bytes: int = 256
    max_concurrent_streams: int = 100
    
    # Queuing
    offline_queue_enabled: bool = True
    max_queue_size: int = 10000


@dataclass
class EndpointHealth:
    """Health metrics for a relay endpoint."""
    last_success: float = 0
    last_failure: float = 0
    consecutive_failures: int = 0
    latency_ms: float = 0
    
    @property
    def score(self) -> float:
        """Health score 0-1 (higher is better)."""
        if self.consecutive_failures > 3:
            return 0.0
        
        recency_score = min(1.0, (time.time() - self.last_success) / 300)
        latency_score = max(0, 1 - self.latency_ms / 1000)
        failure_penalty = self.consecutive_failures * 0.2
        
        return max(0, (recency_score + latency_score) / 2 - failure_penalty)


# ─────────────────────────────────────────────────────────────────────
# High-Level Usage Examples
# ─────────────────────────────────────────────────────────────────────

async def example_basic_usage():
    """Basic send/receive example."""
    
    # Initialize
    relay = MoltRelay(
        agent_id="my-agent-001",
        private_key=load_private_key("agent.key")
    )
    
    # Connect
    await relay.connect("wss://relay.moltspeak.net/v1/connect")
    
    # Send a message
    result = await relay.send(
        MoltSpeakMessage(
            op="query",
            to={"agent": "weather-service", "org": "weather-co"},
            p={
                "domain": "weather",
                "params": {"location": "Tokyo"}
            },
            cls="pub"
        )
    )
    print(f"Sent: {result.message_id}")
    
    # Wait for response
    response = await relay.receive(
        timeout=30,
        filter=MessageFilter(reply_to=result.message_id)
    )
    print(f"Response: {response.p}")
    
    # Disconnect
    await relay.disconnect()


async def example_listener_pattern():
    """Event-driven message handling."""
    
    relay = MoltRelay("my-agent-001", load_private_key("agent.key"))
    await relay.connect("wss://relay.moltspeak.net/v1/connect")
    
    @relay.on_message(operations=["query"])
    async def handle_query(msg):
        # Process query and send response
        result = await process_query(msg.p)
        await relay.send(
            MoltSpeakMessage(
                op="respond",
                to=msg['from'],
                re=msg.id,
                p={"status": "success", "data": result}
            )
        )
    
    @relay.on_message(operations=["task"])
    async def handle_task(msg):
        # Handle task delegation
        task_id = await start_task(msg.p)
        await relay.send(
            MoltSpeakMessage(
                op="respond",
                to=msg['from'],
                re=msg.id,
                p={"task_id": task_id, "status": "started"}
            )
        )
    
    # Keep running
    await asyncio.Event().wait()


async def example_connection_pool():
    """Using connection pool for high throughput."""
    
    pool = RelayPool(
        agent_id="high-volume-agent",
        private_key=load_private_key("agent.key"),
        max_connections=10
    )
    
    # Auto-discover relays
    await pool.discover_relays()
    
    # Send many messages concurrently
    messages = [create_message(i) for i in range(1000)]
    
    async def send_one(msg):
        try:
            return await pool.send(msg)
        except Exception as e:
            return SendResult(message_id=msg.id, delivered=False, error=str(e))
    
    results = await asyncio.gather(*[send_one(m) for m in messages])
    
    successful = sum(1 for r in results if r.delivered)
    print(f"Delivered {successful}/{len(messages)} messages")
    
    await pool.close()


async def example_p2p_upgrade():
    """Upgrade to direct P2P when possible."""
    
    relay = MoltRelay("my-agent-001", load_private_key("agent.key"))
    await relay.connect("wss://relay.moltspeak.net/v1/connect")
    
    # Enable P2P upgrade
    relay.config.p2p_enabled = True
    relay.config.p2p_multiaddr = "/ip4/0.0.0.0/tcp/4001"
    
    # Start P2P listener
    await relay.start_p2p_listener()
    
    # When sending, SDK will automatically try P2P first
    result = await relay.send(
        message,
        prefer_p2p=True  # Try direct connection first
    )
    
    print(f"Delivered via: {result.transport}")  # "p2p" or "relay"
```

---

*MoltRelay SDK Reference v0.1*  
*Status: Draft*  
*Last Updated: 2025-01*
