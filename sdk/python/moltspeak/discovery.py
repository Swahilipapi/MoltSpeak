"""
MoltSpeak Discovery Layer

Find and connect to agents on the MoltSpeak network.
"""
from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any, Union
from enum import Enum
import json
import time
import asyncio

from .message import Message, Operation
from .exceptions import MoltSpeakError


class Visibility(Enum):
    """Agent visibility levels in the registry."""
    PUBLIC = "public"
    UNLISTED = "unlisted"
    PRIVATE = "private"


class AgentStatus(Enum):
    """Agent health status."""
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"
    OFFLINE = "offline"
    DECOMMISSIONED = "decommissioned"


@dataclass
class Endpoint:
    """Agent endpoint configuration."""
    url: str
    transport: str = "https"
    websocket: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        result = {"url": self.url, "transport": self.transport}
        if self.websocket:
            result["websocket"] = self.websocket
        return result
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Endpoint":
        return cls(
            url=data["url"],
            transport=data.get("transport", "https"),
            websocket=data.get("websocket")
        )


@dataclass
class AgentProfile:
    """
    Agent profile for registry registration.
    
    This is what you submit when registering with a registry.
    """
    name: str
    capabilities: List[str]
    endpoint: Endpoint
    visibility: Visibility = Visibility.PUBLIC
    description: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    tags: List[str] = field(default_factory=list)
    moltbook_id: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        result = {
            "name": self.name,
            "capabilities": self.capabilities,
            "endpoint": self.endpoint.to_dict(),
            "visibility": self.visibility.value,
        }
        if self.description:
            result["description"] = self.description
        if self.metadata:
            result["metadata"] = self.metadata
        if self.tags:
            result["tags"] = self.tags
        if self.moltbook_id:
            result["moltbook_id"] = self.moltbook_id
        return result


@dataclass
class AgentInfo:
    """
    Information about a discovered agent.
    
    Returned from discovery queries.
    """
    agent_id: str
    org: str
    name: str
    endpoint: str
    public_key: str
    capabilities: List[str]
    reputation: Optional[float] = None
    uptime_30d: Optional[float] = None
    description: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    attestation: Optional[str] = None
    moltbook_url: Optional[str] = None
    match_score: Optional[float] = None
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "AgentInfo":
        return cls(
            agent_id=data["agent_id"],
            org=data["org"],
            name=data.get("name", data["agent_id"]),
            endpoint=data["endpoint"],
            public_key=data["public_key"],
            capabilities=data.get("capabilities", []),
            reputation=data.get("reputation"),
            uptime_30d=data.get("uptime_30d"),
            description=data.get("description"),
            metadata=data.get("metadata", {}),
            attestation=data.get("attestation"),
            moltbook_url=data.get("moltbook", {}).get("profile_url") if isinstance(data.get("moltbook"), dict) else None,
            match_score=data.get("match_score"),
        )


@dataclass
class Registration:
    """Result of registering with a registry."""
    agent_id: str
    registration_id: str
    expires_at: int
    registry_attestation: Optional[str] = None
    
    @property
    def expires_in_seconds(self) -> int:
        """Seconds until registration expires."""
        return max(0, int((self.expires_at - time.time() * 1000) / 1000))
    
    @property
    def is_expired(self) -> bool:
        """Check if registration has expired."""
        return time.time() * 1000 > self.expires_at


@dataclass
class PongResponse:
    """Response from a ping operation."""
    nonce: str
    status: str
    load: Optional[float] = None
    queue_depth: Optional[int] = None
    capabilities_active: List[str] = field(default_factory=list)
    response_time_ms: Optional[int] = None
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any], response_time_ms: Optional[int] = None) -> "PongResponse":
        return cls(
            nonce=data["nonce"],
            status=data["status"],
            load=data.get("load"),
            queue_depth=data.get("queue_depth"),
            capabilities_active=data.get("capabilities_active", []),
            response_time_ms=response_time_ms,
        )


@dataclass
class DiscoveryResult:
    """Result of a discovery query."""
    agents: List[AgentInfo]
    total: int
    page: int = 1
    has_more: bool = False
    
    def __iter__(self):
        return iter(self.agents)
    
    def __len__(self):
        return len(self.agents)
    
    def __getitem__(self, index):
        return self.agents[index]


class DiscoveryError(MoltSpeakError):
    """Base exception for discovery errors."""
    pass


class AgentNotFoundError(DiscoveryError):
    """Agent not found in registry."""
    pass


class RegistrationError(DiscoveryError):
    """Error during agent registration."""
    pass


class Registry:
    """
    MoltSpeak Registry client.
    
    Connect to a registry to discover and register agents.
    
    Usage:
        registry = Registry("https://registry.moltspeak.dev/v1")
        
        # Discover agents
        results = await registry.discover("translate.text")
        
        # Register an agent
        await registry.register(agent, profile)
    """
    
    DEFAULT_REGISTRY = "https://registry.moltspeak.dev/v1"
    
    def __init__(self, url: Optional[str] = None, transport: Optional[Any] = None):
        """
        Create a registry client.
        
        Args:
            url: Registry base URL. Defaults to moltspeak.dev registry.
            transport: Optional custom transport for requests.
        """
        self.url = (url or self.DEFAULT_REGISTRY).rstrip('/')
        self.transport = transport
        self._cache: Dict[str, Any] = {}
    
    async def register(
        self,
        agent: "Agent",
        profile: AgentProfile,
        ttl: int = 86400,
    ) -> Registration:
        """
        Register an agent with this registry.
        
        Args:
            agent: The agent to register
            profile: Agent profile with capabilities and endpoint
            ttl: Time-to-live in seconds (default 24 hours)
        
        Returns:
            Registration object with expiry info
        """
        message = agent.create_message(
            operation="register",
            to_agent="registry",
            to_org="moltspeak",
            payload={
                "action": "create",
                "profile": profile.to_dict(),
                "ttl": ttl * 1000,  # Convert to milliseconds
            },
            classification="pub"
        )
        
        response = await self._send(message)
        
        if response.get("status") != "success":
            raise RegistrationError(
                response.get("message", "Registration failed")
            )
        
        return Registration(
            agent_id=agent.identity.agent_id,
            registration_id=response.get("registration_id", ""),
            expires_at=response.get("expires_at", 0),
            registry_attestation=response.get("registry_attestation", {}).get("signature"),
        )
    
    async def renew(self, agent: "Agent", ttl: int = 86400) -> Registration:
        """
        Renew an existing registration.
        
        Args:
            agent: The registered agent
            ttl: New time-to-live in seconds
        
        Returns:
            Updated registration
        """
        message = agent.create_message(
            operation="register",
            to_agent="registry",
            to_org="moltspeak",
            payload={
                "action": "renew",
                "ttl": ttl * 1000,
            },
            classification="pub"
        )
        
        response = await self._send(message)
        
        return Registration(
            agent_id=agent.identity.agent_id,
            registration_id=response.get("registration_id", ""),
            expires_at=response.get("expires_at", 0),
        )
    
    async def deregister(self, agent: "Agent", reason: str = "shutdown") -> bool:
        """
        Remove an agent from the registry.
        
        Args:
            agent: The agent to deregister
            reason: Reason for deregistration
        
        Returns:
            True if successful
        """
        message = agent.create_message(
            operation="register",
            to_agent="registry",
            to_org="moltspeak",
            payload={
                "action": "delete",
                "reason": reason,
            },
            classification="pub"
        )
        
        response = await self._send(message)
        return response.get("status") == "success"
    
    async def discover(
        self,
        capability: Optional[str] = None,
        capabilities: Optional[Dict[str, List[str]]] = None,
        requirements: Optional[Dict[str, Any]] = None,
        filters: Optional[Dict[str, Any]] = None,
        sort: str = "reputation",
        limit: int = 10,
        page: int = 1,
    ) -> DiscoveryResult:
        """
        Discover agents by capability.
        
        Args:
            capability: Single capability to search for
            capabilities: Complex capability query {"all": [...], "any": [...]}
            requirements: Capability requirements to match
            filters: Additional filters (verified, min_uptime, org, etc.)
            sort: Sort order (reputation, uptime, response_time)
            limit: Maximum results per page
            page: Page number for pagination
        
        Returns:
            DiscoveryResult with matching agents
        
        Example:
            # Simple search
            results = await registry.discover("translate.text")
            
            # With requirements
            results = await registry.discover(
                capability="calendar.schedule",
                requirements={"timezone_support": True}
            )
            
            # Multi-capability search
            results = await registry.discover(
                capabilities={
                    "all": ["translate.text", "translate.document"],
                    "any": ["ocr.image", "ocr.pdf"]
                }
            )
        """
        payload: Dict[str, Any] = {
            "sort": sort,
            "limit": limit,
            "page": page,
        }
        
        if capability:
            payload["capability"] = capability
        if capabilities:
            payload["capabilities"] = capabilities
        if requirements:
            payload["requirements"] = requirements
        if filters:
            payload["filters"] = filters
        
        # For discovery, we can send unsigned queries to public registry
        response = await self._send_query(payload)
        
        agents = [
            AgentInfo.from_dict(a)
            for a in response.get("results", response.get("agents", []))
        ]
        
        return DiscoveryResult(
            agents=agents,
            total=response.get("total", len(agents)),
            page=page,
            has_more=response.get("has_more", False),
        )
    
    async def get_agent(self, agent_id: str) -> AgentInfo:
        """
        Get a specific agent's profile by ID.
        
        Args:
            agent_id: The agent's unique identifier
        
        Returns:
            AgentInfo for the requested agent
        
        Raises:
            AgentNotFoundError: If agent doesn't exist
        """
        response = await self._send_query({"agent_id": agent_id}, endpoint="agents")
        
        if not response or response.get("error"):
            raise AgentNotFoundError(f"Agent not found: {agent_id}")
        
        return AgentInfo.from_dict(response)
    
    async def list_capabilities(
        self,
        prefix: Optional[str] = None,
        verified: bool = False,
    ) -> List[Dict[str, Any]]:
        """
        List all known capabilities in the registry.
        
        Args:
            prefix: Filter by capability prefix (e.g., "calendar")
            verified: Only show verified capabilities
        
        Returns:
            List of capability info dicts
        """
        params = {}
        if prefix:
            params["prefix"] = prefix
        if verified:
            params["verified"] = True
        
        response = await self._send_query(params, endpoint="capabilities")
        return response.get("capabilities", [])
    
    async def _send(self, message: Message) -> Dict[str, Any]:
        """Send a signed message to the registry."""
        if self.transport:
            return await self.transport.send(message, self.url)
        
        # Default: HTTP POST
        import aiohttp
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{self.url}/message",
                json=message.to_dict(),
                headers={"Content-Type": "application/json"}
            ) as resp:
                return await resp.json()
    
    async def _send_query(
        self,
        payload: Dict[str, Any],
        endpoint: str = "discover"
    ) -> Dict[str, Any]:
        """Send an unsigned query to the registry."""
        if self.transport:
            return await self.transport.query(payload, f"{self.url}/{endpoint}")
        
        # Default: HTTP POST
        import aiohttp
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{self.url}/{endpoint}",
                json=payload,
                headers={"Content-Type": "application/json"}
            ) as resp:
                return await resp.json()


async def ping(
    endpoint: str,
    timeout: float = 5.0,
    transport: Optional[Any] = None,
) -> PongResponse:
    """
    Ping an agent to check if it's alive.
    
    Args:
        endpoint: Agent's MoltSpeak endpoint URL
        timeout: Timeout in seconds
        transport: Optional custom transport
    
    Returns:
        PongResponse with agent status
    
    Example:
        pong = await ping("https://calendarbot.acme.com/moltspeak")
        if pong.status == "alive":
            print(f"Agent is up! Load: {pong.load}")
    """
    import secrets
    
    nonce = secrets.token_hex(16)
    start_time = time.time()
    
    message = {
        "v": "0.1",
        "op": "ping",
        "p": {"nonce": nonce},
        "ts": int(time.time() * 1000),
        "cls": "pub",
    }
    
    if transport:
        response = await transport.send(message, endpoint)
    else:
        import aiohttp
        async with aiohttp.ClientSession() as session:
            async with session.post(
                endpoint,
                json=message,
                timeout=aiohttp.ClientTimeout(total=timeout),
                headers={"Content-Type": "application/json"}
            ) as resp:
                response = await resp.json()
    
    response_time = int((time.time() - start_time) * 1000)
    
    # Verify nonce matches
    response_payload = response.get("p", response)
    if response_payload.get("nonce") != nonce:
        raise DiscoveryError("Ping nonce mismatch - possible replay attack")
    
    return PongResponse.from_dict(response_payload, response_time)


# Convenience functions for agent integration

async def discover(
    capability: str,
    registry_url: Optional[str] = None,
    **kwargs
) -> DiscoveryResult:
    """
    Quick discovery without creating a Registry instance.
    
    Args:
        capability: Capability to search for
        registry_url: Optional registry URL
        **kwargs: Additional arguments passed to Registry.discover()
    
    Returns:
        DiscoveryResult with matching agents
    
    Example:
        results = await discover("translate.text")
        for agent in results:
            print(f"{agent.name}: {agent.endpoint}")
    """
    registry = Registry(registry_url)
    return await registry.discover(capability, **kwargs)


async def find_agent(
    capability: str,
    requirements: Optional[Dict[str, Any]] = None,
    registry_url: Optional[str] = None,
    prefer: str = "reputation",
) -> Optional[AgentInfo]:
    """
    Find the best agent for a capability.
    
    Convenience function that returns a single agent or None.
    
    Args:
        capability: Capability to search for
        requirements: Capability requirements
        registry_url: Optional registry URL
        prefer: How to rank agents (reputation, uptime, response_time)
    
    Returns:
        Best matching AgentInfo, or None if no matches
    
    Example:
        agent = await find_agent(
            "calendar.schedule",
            requirements={"timezone_support": True}
        )
        if agent:
            session = await my_agent.connect(agent)
    """
    registry = Registry(registry_url)
    results = await registry.discover(
        capability=capability,
        requirements=requirements,
        sort=prefer,
        limit=1,
    )
    
    return results[0] if results else None
