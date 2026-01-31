"""
MoltSpeak Agent identity and management
"""
from dataclasses import dataclass
from typing import Optional, List, Dict, Any
import json
import hashlib

from .crypto import generate_keypair, sign_message, verify_signature


@dataclass
class AgentIdentity:
    """
    Cryptographic identity for an MoltSpeak agent.
    """
    agent_id: str
    org: str
    signing_key: str  # Ed25519 private key (base64)
    public_key: str   # Ed25519 public key (base64)
    encryption_key: Optional[str] = None  # X25519 private key
    encryption_public: Optional[str] = None  # X25519 public key
    capabilities: Optional[List[str]] = None
    
    @classmethod
    def generate(cls, agent_id: str, org: str, capabilities: Optional[List[str]] = None) -> "AgentIdentity":
        """Generate a new agent identity with fresh keypair"""
        signing_private, signing_public = generate_keypair()
        # Note: In production, also generate X25519 keys for encryption
        return cls(
            agent_id=agent_id,
            org=org,
            signing_key=signing_private,
            public_key=signing_public,
            capabilities=capabilities or [],
        )
    
    @classmethod
    def from_file(cls, path: str) -> "AgentIdentity":
        """Load identity from JSON file"""
        with open(path, 'r') as f:
            data = json.load(f)
        return cls(
            agent_id=data["agent_id"],
            org=data["org"],
            signing_key=data["signing_key"],
            public_key=data["public_key"],
            encryption_key=data.get("encryption_key"),
            encryption_public=data.get("encryption_public"),
            capabilities=data.get("capabilities"),
        )
    
    def save(self, path: str) -> None:
        """Save identity to JSON file (KEEP SECRET!)"""
        data = {
            "agent_id": self.agent_id,
            "org": self.org,
            "signing_key": self.signing_key,
            "public_key": self.public_key,
            "capabilities": self.capabilities,
        }
        if self.encryption_key:
            data["encryption_key"] = self.encryption_key
        if self.encryption_public:
            data["encryption_public"] = self.encryption_public
        with open(path, 'w') as f:
            json.dump(data, f, indent=2)
    
    def public_identity(self) -> Dict[str, Any]:
        """Return only public information (safe to share)"""
        return {
            "agent": self.agent_id,
            "org": self.org,
            "key": f"ed25519:{self.public_key}",
            "enc_key": f"x25519:{self.encryption_public}" if self.encryption_public else None,
        }
    
    def fingerprint(self) -> str:
        """Return a short fingerprint of the public key"""
        h = hashlib.sha256(self.public_key.encode()).hexdigest()
        return h[:16]


class Agent:
    """
    Main MoltSpeak agent class.
    
    Handles message creation, signing, verification, and transport.
    """
    
    def __init__(self, identity: AgentIdentity, transport: Optional[Any] = None):
        """
        Create an agent.
        
        Args:
            identity: The agent's cryptographic identity
            transport: Optional transport layer for sending messages
        """
        self.identity = identity
        self.transport = transport
        self._sessions: Dict[str, Any] = {}
    
    @classmethod
    def create(cls, agent_id: str, org: str, capabilities: Optional[List[str]] = None) -> "Agent":
        """Create a new agent with fresh identity"""
        identity = AgentIdentity.generate(agent_id, org, capabilities)
        return cls(identity)
    
    @classmethod
    def load(cls, identity_path: str) -> "Agent":
        """Load agent from saved identity file"""
        identity = AgentIdentity.from_file(identity_path)
        return cls(identity)
    
    def sign(self, message: "Message") -> "Message":
        """Sign a message with this agent's key"""
        from .message import Message
        # Get message dict without signature
        msg_dict = message.to_dict()
        msg_dict.pop("sig", None)
        
        # Sign the canonical JSON
        canonical = json.dumps(msg_dict, sort_keys=True, separators=(',', ':'))
        signature = sign_message(canonical, self.identity.signing_key)
        
        message.signature = f"ed25519:{signature}"
        return message
    
    def verify(self, message: "Message", sender_public_key: str) -> bool:
        """Verify a message signature"""
        if not message.signature:
            return False
        
        # Strip signature prefix if present
        sig = message.signature
        if sig.startswith("ed25519:"):
            sig = sig[8:]
        
        # Get message dict without signature
        msg_dict = message.to_dict()
        msg_dict.pop("sig", None)
        
        # Verify against canonical JSON
        canonical = json.dumps(msg_dict, sort_keys=True, separators=(',', ':'))
        
        # Strip key prefix if present
        pub_key = sender_public_key
        if pub_key.startswith("ed25519:"):
            pub_key = pub_key[8:]
        
        return verify_signature(canonical, sig, pub_key)
    
    def create_message(
        self,
        operation: str,
        to_agent: str,
        to_org: str,
        payload: Dict[str, Any],
        **kwargs
    ) -> "Message":
        """Create and sign a new message"""
        from .message import Message, Operation, AgentRef
        
        message = Message(
            operation=Operation(operation),
            sender=AgentRef(
                agent=self.identity.agent_id,
                org=self.identity.org,
                key=f"ed25519:{self.identity.public_key}",
            ),
            recipient=AgentRef(agent=to_agent, org=to_org),
            payload=payload,
            **kwargs
        )
        
        return self.sign(message)
    
    async def send(self, message: "Message") -> Optional["Message"]:
        """Send a message via configured transport"""
        if not self.transport:
            raise RuntimeError("No transport configured")
        return await self.transport.send(message)
    
    def query(
        self,
        to_agent: str,
        to_org: str,
        domain: str,
        intent: str,
        params: Optional[Dict[str, Any]] = None,
        **kwargs
    ) -> "Message":
        """Create a query message"""
        from .message import query as make_query
        return self.create_message(
            operation="query",
            to_agent=to_agent,
            to_org=to_org,
            payload=make_query(domain, intent, params),
            **kwargs
        )
    
    def respond_to(
        self,
        original: "Message",
        status: str,
        data: Any,
        **kwargs
    ) -> "Message":
        """Create a response to a message"""
        from .message import respond as make_respond
        return self.create_message(
            operation="respond",
            to_agent=original.sender.agent,
            to_org=original.sender.org,
            payload=make_respond(status, data),
            reply_to=original.message_id,
            **kwargs
        )
    
    def error_to(
        self,
        original: "Message",
        code: str,
        category: str,
        message: str,
        recoverable: bool = False,
        **kwargs
    ) -> "Message":
        """Create an error response"""
        from .message import error as make_error
        return self.create_message(
            operation="error",
            to_agent=original.sender.agent,
            to_org=original.sender.org,
            payload=make_error(code, category, message, recoverable),
            reply_to=original.message_id,
            **kwargs
        )
