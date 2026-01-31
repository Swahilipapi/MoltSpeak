"""
MoltSpeak Message handling
"""
import json
import uuid
import time
from dataclasses import dataclass, field, asdict
from typing import Optional, Dict, Any, List
from enum import Enum


class Operation(str, Enum):
    """Core MoltSpeak operations"""
    HELLO = "hello"
    VERIFY = "verify"
    QUERY = "query"
    RESPOND = "respond"
    TASK = "task"
    STREAM = "stream"
    TOOL = "tool"
    CONSENT = "consent"
    ERROR = "error"


@dataclass
class AgentRef:
    """Reference to an agent"""
    agent: str
    org: str
    key: Optional[str] = None
    enc_key: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        d = {"agent": self.agent, "org": self.org}
        if self.key:
            d["key"] = self.key
        if self.enc_key:
            d["enc_key"] = self.enc_key
        return d
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "AgentRef":
        return cls(
            agent=data["agent"],
            org=data["org"],
            key=data.get("key"),
            enc_key=data.get("enc_key")
        )


@dataclass
class Message:
    """
    Core MoltSpeak message structure.
    
    Uses compact field names for wire format, but provides
    full property names for code readability.
    """
    operation: Operation
    sender: AgentRef
    recipient: AgentRef
    payload: Dict[str, Any]
    classification: str = "int"  # pub, int, conf, pii, sec
    version: str = "0.1"
    message_id: Optional[str] = None
    timestamp: Optional[int] = None
    signature: Optional[str] = None
    reply_to: Optional[str] = None
    expires: Optional[int] = None
    capabilities_required: Optional[List[str]] = None
    pii_meta: Optional[Dict[str, Any]] = None
    extensions: Optional[Dict[str, Any]] = None
    
    def __post_init__(self):
        if self.message_id is None:
            self.message_id = str(uuid.uuid4())
        if self.timestamp is None:
            self.timestamp = int(time.time() * 1000)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to compact wire format"""
        msg = {
            "v": self.version,
            "id": self.message_id,
            "ts": self.timestamp,
            "op": self.operation.value if isinstance(self.operation, Operation) else self.operation,
            "from": self.sender.to_dict() if isinstance(self.sender, AgentRef) else self.sender,
            "to": self.recipient.to_dict() if isinstance(self.recipient, AgentRef) else self.recipient,
            "p": self.payload,
            "cls": self.classification,
        }
        
        if self.signature:
            msg["sig"] = self.signature
        if self.reply_to:
            msg["re"] = self.reply_to
        if self.expires:
            msg["exp"] = self.expires
        if self.capabilities_required:
            msg["cap"] = self.capabilities_required
        if self.pii_meta:
            msg["pii_meta"] = self.pii_meta
        if self.extensions:
            msg["ext"] = self.extensions
            
        return msg
    
    def to_json(self, indent: Optional[int] = None) -> str:
        """Serialize to JSON string"""
        return json.dumps(self.to_dict(), indent=indent)
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Message":
        """Parse from compact wire format"""
        return cls(
            version=data["v"],
            message_id=data["id"],
            timestamp=data["ts"],
            operation=Operation(data["op"]),
            sender=AgentRef.from_dict(data["from"]),
            recipient=AgentRef.from_dict(data["to"]),
            payload=data["p"],
            classification=data.get("cls", "int"),
            signature=data.get("sig"),
            reply_to=data.get("re"),
            expires=data.get("exp"),
            capabilities_required=data.get("cap"),
            pii_meta=data.get("pii_meta"),
            extensions=data.get("ext"),
        )
    
    @classmethod
    def from_json(cls, json_str: str) -> "Message":
        """Parse from JSON string"""
        return cls.from_dict(json.loads(json_str))
    
    def validate(self) -> List[str]:
        """
        Validate message structure.
        Returns list of validation errors (empty if valid).
        """
        errors = []
        
        if not self.message_id:
            errors.append("Message ID required")
        if not self.timestamp:
            errors.append("Timestamp required")
        if not self.operation:
            errors.append("Operation required")
        if not self.sender:
            errors.append("Sender required")
        if not self.recipient:
            errors.append("Recipient required")
        if self.classification not in ["pub", "int", "conf", "pii", "sec"]:
            errors.append(f"Invalid classification: {self.classification}")
        if self.classification == "pii" and not self.pii_meta:
            errors.append("PII classification requires pii_meta")
            
        return errors


class MessageBuilder:
    """Fluent builder for constructing messages"""
    
    def __init__(self, operation: Operation):
        self._operation = operation
        self._sender: Optional[AgentRef] = None
        self._recipient: Optional[AgentRef] = None
        self._payload: Dict[str, Any] = {}
        self._classification: str = "int"
        self._reply_to: Optional[str] = None
        self._expires: Optional[int] = None
        self._capabilities: Optional[List[str]] = None
        self._pii_meta: Optional[Dict[str, Any]] = None
        self._extensions: Optional[Dict[str, Any]] = None
    
    def from_agent(self, agent: str, org: str, key: Optional[str] = None) -> "MessageBuilder":
        """Set sender agent"""
        self._sender = AgentRef(agent=agent, org=org, key=key)
        return self
    
    def to_agent(self, agent: str, org: str) -> "MessageBuilder":
        """Set recipient agent"""
        self._recipient = AgentRef(agent=agent, org=org)
        return self
    
    def with_payload(self, payload: Dict[str, Any]) -> "MessageBuilder":
        """Set message payload"""
        self._payload = payload
        return self
    
    def classified_as(self, classification: str) -> "MessageBuilder":
        """Set data classification"""
        self._classification = classification
        return self
    
    def reply_to(self, message_id: str) -> "MessageBuilder":
        """Set reply-to reference"""
        self._reply_to = message_id
        return self
    
    def expires_at(self, timestamp_ms: int) -> "MessageBuilder":
        """Set expiration time"""
        self._expires = timestamp_ms
        return self
    
    def expires_in(self, seconds: int) -> "MessageBuilder":
        """Set expiration relative to now"""
        self._expires = int(time.time() * 1000) + (seconds * 1000)
        return self
    
    def requires_capabilities(self, caps: List[str]) -> "MessageBuilder":
        """Set required capabilities"""
        self._capabilities = caps
        return self
    
    def with_pii(self, types: List[str], consent_token: str, purpose: str) -> "MessageBuilder":
        """Add PII metadata with consent"""
        self._classification = "pii"
        self._pii_meta = {
            "types": types,
            "consent": {
                "proof": consent_token,
                "purpose": purpose,
            }
        }
        return self
    
    def with_extension(self, namespace: str, data: Dict[str, Any]) -> "MessageBuilder":
        """Add a protocol extension"""
        if self._extensions is None:
            self._extensions = {}
        self._extensions[namespace] = data
        return self
    
    def build(self) -> Message:
        """Build the message"""
        if not self._sender:
            raise ValueError("Sender is required")
        if not self._recipient:
            raise ValueError("Recipient is required")
            
        return Message(
            operation=self._operation,
            sender=self._sender,
            recipient=self._recipient,
            payload=self._payload,
            classification=self._classification,
            reply_to=self._reply_to,
            expires=self._expires,
            capabilities_required=self._capabilities,
            pii_meta=self._pii_meta,
            extensions=self._extensions,
        )


# Convenience factory functions
def query(domain: str, intent: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Create a query payload"""
    return {
        "domain": domain,
        "intent": intent,
        "params": params or {},
    }


def respond(status: str, data: Any, schema: Optional[str] = None) -> Dict[str, Any]:
    """Create a response payload"""
    payload = {"status": status, "data": data}
    if schema:
        payload["schema"] = schema
    return payload


def task_create(
    task_id: str,
    task_type: str,
    description: Optional[str] = None,
    params: Optional[Dict[str, Any]] = None,
    deadline: Optional[int] = None
) -> Dict[str, Any]:
    """Create a task creation payload"""
    payload = {
        "action": "create",
        "task_id": task_id,
        "type": task_type,
    }
    if description:
        payload["description"] = description
    if params:
        payload["params"] = params
    if deadline:
        payload["deadline"] = deadline
    return payload


def error(
    code: str,
    category: str,
    message: str,
    recoverable: bool = False,
    suggestion: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """Create an error payload"""
    payload = {
        "code": code,
        "category": category,
        "message": message,
        "recoverable": recoverable,
    }
    if suggestion:
        payload["suggestion"] = suggestion
    return payload
