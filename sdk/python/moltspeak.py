"""
MoltSpeak SDK for Python

A reference implementation of the MoltSpeak protocol for agent-to-agent communication.
Zero external dependencies. Works with Python 3.7+.

Version: 0.1.0
License: MIT
"""

import json
import re
import time
import uuid
from dataclasses import dataclass, field, asdict
from typing import Any, Dict, List, Optional, Set, Tuple, Union
from enum import Enum
import copy

# ============================================================================
# Constants
# ============================================================================

PROTOCOL_VERSION = "0.1"


class Operations(str, Enum):
    """Valid operation types"""
    HELLO = "hello"
    VERIFY = "verify"
    QUERY = "query"
    RESPOND = "respond"
    TASK = "task"
    STREAM = "stream"
    TOOL = "tool"
    CONSENT = "consent"
    ERROR = "error"


class Classifications(str, Enum):
    """Data classification levels"""
    PUBLIC = "pub"
    INTERNAL = "int"
    CONFIDENTIAL = "conf"
    PII = "pii"
    SECRET = "sec"


class ErrorCodes(str, Enum):
    """Error codes"""
    E_PARSE = "E_PARSE"
    E_VERSION = "E_VERSION"
    E_SCHEMA = "E_SCHEMA"
    E_MISSING_FIELD = "E_MISSING_FIELD"
    E_INVALID_PARAM = "E_INVALID_PARAM"
    E_AUTH_FAILED = "E_AUTH_FAILED"
    E_SIGNATURE = "E_SIGNATURE"
    E_CAPABILITY = "E_CAPABILITY"
    E_CONSENT = "E_CONSENT"
    E_CLASSIFICATION = "E_CLASSIFICATION"
    E_RATE_LIMIT = "E_RATE_LIMIT"
    E_TIMEOUT = "E_TIMEOUT"
    E_TASK_FAILED = "E_TASK_FAILED"
    E_INTERNAL = "E_INTERNAL"


class SizeLimits:
    """Message size limits"""
    SINGLE_MESSAGE = 1 * 1024 * 1024      # 1 MB
    BATCH_MESSAGE = 10 * 1024 * 1024      # 10 MB
    STREAM_CHUNK = 64 * 1024              # 64 KB
    SESSION_TOTAL = 100 * 1024 * 1024     # 100 MB


# ============================================================================
# PII Detection Patterns
# ============================================================================

PII_PATTERNS: Dict[str, re.Pattern] = {
    "email": re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}"),
    "phone": re.compile(r"(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}"),
    "ssn": re.compile(r"\b\d{3}[-]?\d{2}[-]?\d{4}\b"),
    "credit_card": re.compile(r"\b(?:\d{4}[-\s]?){3}\d{4}\b"),
    "ipv4": re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b"),
    "address": re.compile(
        r"\b\d{1,5}\s+(?:[A-Za-z]+\s+){1,4}"
        r"(?:Street|St|Avenue|Ave|Boulevard|Blvd|Road|Rd|Lane|Ln|Drive|Dr|Court|Ct|Way|Place|Pl)\b",
        re.IGNORECASE
    ),
    "dob": re.compile(r"\b(?:0?[1-9]|1[0-2])[-/](?:0?[1-9]|[12]\d|3[01])[-/](?:19|20)\d{2}\b"),
}


# ============================================================================
# Data Classes
# ============================================================================

@dataclass
class AgentIdentity:
    """Agent identity object"""
    agent: str
    org: Optional[str] = None
    key: Optional[str] = None
    enc_key: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary, excluding None values"""
        return {k: v for k, v in asdict(self).items() if v is not None}


@dataclass
class ValidationResult:
    """Validation result object"""
    valid: bool
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)


@dataclass
class PIIDetectionResult:
    """PII detection result"""
    has_pii: bool
    findings: List[Dict[str, Any]] = field(default_factory=list)
    types: List[str] = field(default_factory=list)


# ============================================================================
# Utility Functions
# ============================================================================

def generate_uuid() -> str:
    """Generate a UUID v4."""
    return str(uuid.uuid4())


def now() -> int:
    """Get current timestamp in milliseconds."""
    return int(time.time() * 1000)


def deep_clone(obj: Any) -> Any:
    """Deep clone an object."""
    return copy.deepcopy(obj)


def byte_size(text: str) -> int:
    """Calculate byte size of a string (UTF-8)."""
    return len(text.encode("utf-8"))


# ============================================================================
# PII Detection
# ============================================================================

def detect_pii(data: Union[str, Dict[str, Any]]) -> PIIDetectionResult:
    """
    Detect PII in a string or object.
    
    Args:
        data: Data to scan for PII
        
    Returns:
        PIIDetectionResult with found PII types and locations
    """
    result = PIIDetectionResult(has_pii=False)
    types_found: Set[str] = set()
    
    # Convert to string if needed
    text_to_scan = data if isinstance(data, str) else json.dumps(data)
    
    for pii_type, pattern in PII_PATTERNS.items():
        matches = pattern.findall(text_to_scan)
        if matches:
            result.has_pii = True
            types_found.add(pii_type)
            result.findings.append({
                "type": pii_type,
                "count": len(matches),
                "preview": f"{len(matches)} potential {pii_type} pattern(s) found"
            })
    
    result.types = list(types_found)
    return result


def mask_pii(
    text: str,
    types: Optional[List[str]] = None,
    mask_char: str = "*"
) -> str:
    """
    Mask PII in a string.
    
    Args:
        text: Text containing potential PII
        types: PII types to mask (default: all)
        mask_char: Character to use for masking
        
    Returns:
        Text with PII masked
    """
    types_to_mask = types or list(PII_PATTERNS.keys())
    masked = text
    
    for pii_type in types_to_mask:
        pattern = PII_PATTERNS.get(pii_type)
        if pattern:
            def mask_match(match: re.Match) -> str:
                value = match.group()
                if len(value) <= 4:
                    return mask_char * len(value)
                return value[0] + mask_char * (len(value) - 2) + value[-1]
            
            masked = pattern.sub(mask_match, masked)
    
    return masked


# ============================================================================
# Message Validation
# ============================================================================

def validate_message(
    message: Dict[str, Any],
    strict: bool = True,
    check_pii: bool = True
) -> ValidationResult:
    """
    Validate an MoltSpeak message.
    
    Args:
        message: Message to validate
        strict: Strict mode (all required fields)
        check_pii: Check for untagged PII
        
    Returns:
        ValidationResult with errors and warnings
    """
    result = ValidationResult(valid=True)
    
    # Must be a dict
    if not isinstance(message, dict):
        result.valid = False
        result.errors.append("Message must be a dictionary")
        return result
    
    # Required fields
    required_fields = ["v", "id", "ts", "op"]
    if strict:
        required_fields.extend(["from", "cls"])
    
    for field_name in required_fields:
        if field_name not in message or message[field_name] is None:
            result.valid = False
            result.errors.append(f"Missing required field: {field_name}")
    
    # Version check
    if "v" in message and message["v"] != PROTOCOL_VERSION:
        result.warnings.append(
            f"Protocol version mismatch: expected {PROTOCOL_VERSION}, got {message['v']}"
        )
    
    # Operation check
    if "op" in message:
        valid_ops = [op.value for op in Operations]
        if message["op"] not in valid_ops:
            result.warnings.append(f"Unknown operation: {message['op']}")
    
    # Classification check
    if "cls" in message:
        valid_cls = [c.value for c in Classifications]
        if message["cls"] not in valid_cls:
            result.valid = False
            result.errors.append(
                f"Invalid classification: {message['cls']}. "
                f"Must be one of: {', '.join(valid_cls)}"
            )
    
    # Timestamp validation
    if "ts" in message:
        if not isinstance(message["ts"], (int, float)):
            result.valid = False
            result.errors.append("Timestamp (ts) must be a number")
        elif message["ts"] < 0:
            result.valid = False
            result.errors.append("Timestamp (ts) must be positive")
        else:
            # Check message age (prevent replay attacks)
            MAX_AGE_MS = 5 * 60 * 1000  # 5 minutes
            message_age = now() - message["ts"]
            if message_age > MAX_AGE_MS:
                result.valid = False
                result.errors.append(
                    f"Message timestamp too old: {message_age / 1000:.1f}s ago "
                    f"(max allowed: {MAX_AGE_MS / 1000}s). Possible replay attack."
                )
    
    # ID format check
    if "id" in message and isinstance(message["id"], str):
        uuid_pattern = re.compile(
            r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
            re.IGNORECASE
        )
        if not uuid_pattern.match(message["id"]):
            result.warnings.append("Message ID should be a valid UUID format")
    
    # From field structure
    if "from" in message and isinstance(message["from"], dict):
        if "agent" not in message["from"]:
            result.warnings.append("from.agent is recommended")
    
    # To field structure
    if "to" in message and isinstance(message["to"], dict):
        if "agent" not in message["to"]:
            result.warnings.append("to.agent is recommended")
    
    # Size check
    message_str = json.dumps(message)
    size = byte_size(message_str)
    if size > SizeLimits.SINGLE_MESSAGE:
        result.valid = False
        result.errors.append(
            f"Message exceeds size limit: {size} bytes > {SizeLimits.SINGLE_MESSAGE} bytes"
        )
    
    # PII check
    if check_pii and message.get("cls") != Classifications.PII.value:
        payload = message.get("p", {})
        pii_result = detect_pii(payload)
        if pii_result.has_pii:
            result.valid = False
            result.errors.append(
                f"PII detected without consent: {', '.join(pii_result.types)}. "
                "Set cls to 'pii' with consent metadata."
            )
    
    # Expiry check
    if "exp" in message:
        if not isinstance(message["exp"], (int, float)):
            result.valid = False
            result.errors.append("Expiry (exp) must be a number")
        elif message["exp"] < now():
            result.warnings.append("Message has expired")
    
    return result


def validate_envelope(envelope: Dict[str, Any]) -> ValidationResult:
    """
    Validate an envelope.
    
    Args:
        envelope: Envelope to validate
        
    Returns:
        ValidationResult with errors and warnings
    """
    result = ValidationResult(valid=True)
    
    if not isinstance(envelope, dict):
        result.valid = False
        result.errors.append("Envelope must be a dictionary")
        return result
    
    # Check moltspeak version
    if "moltspeak" not in envelope:
        result.valid = False
        result.errors.append("Missing moltspeak version in envelope")
    
    # Check envelope metadata
    if "envelope" not in envelope and "ciphertext" not in envelope:
        result.valid = False
        result.errors.append("Envelope must contain either envelope metadata or ciphertext")
    
    # If encrypted, check required fields
    env_meta = envelope.get("envelope", {})
    if env_meta.get("encrypted"):
        if "ciphertext" not in envelope:
            result.valid = False
            result.errors.append("Encrypted envelope missing ciphertext")
        if "algorithm" not in env_meta:
            result.valid = False
            result.errors.append("Encrypted envelope missing algorithm")
    
    # If not encrypted, check for message
    if env_meta and not env_meta.get("encrypted") and "message" not in envelope:
        result.valid = False
        result.errors.append("Unencrypted envelope missing message")
    
    return result


# ============================================================================
# Message Builder
# ============================================================================

class MessageBuilder:
    """Message builder class for fluent message construction."""
    
    def __init__(self, operation: str):
        """
        Create a new MessageBuilder.
        
        Args:
            operation: The operation type
        """
        self._message: Dict[str, Any] = {
            "v": PROTOCOL_VERSION,
            "id": generate_uuid(),
            "ts": now(),
            "op": operation,
            "cls": Classifications.INTERNAL.value
        }
    
    def from_agent(self, from_identity: Union[AgentIdentity, Dict[str, Any]]) -> "MessageBuilder":
        """Set the sender."""
        if isinstance(from_identity, AgentIdentity):
            self._message["from"] = from_identity.to_dict()
        else:
            self._message["from"] = from_identity
        return self
    
    def to_agent(self, to_identity: Union[AgentIdentity, Dict[str, Any]]) -> "MessageBuilder":
        """Set the recipient."""
        if isinstance(to_identity, AgentIdentity):
            self._message["to"] = to_identity.to_dict()
        else:
            self._message["to"] = to_identity
        return self
    
    def payload(self, payload: Dict[str, Any]) -> "MessageBuilder":
        """Set the payload."""
        self._message["p"] = payload
        return self
    
    def classification(
        self,
        cls: str,
        pii_meta: Optional[Dict[str, Any]] = None
    ) -> "MessageBuilder":
        """Set the classification."""
        self._message["cls"] = cls
        if cls == Classifications.PII.value and pii_meta:
            self._message["pii_meta"] = pii_meta
        return self
    
    def reply_to(self, message_id: str) -> "MessageBuilder":
        """Set reply-to reference."""
        self._message["re"] = message_id
        return self
    
    def expires_at(self, expiry_ms: int) -> "MessageBuilder":
        """Set message expiry."""
        self._message["exp"] = expiry_ms
        return self
    
    def expires_in(self, duration_ms: int) -> "MessageBuilder":
        """Set message expiry as duration from now."""
        self._message["exp"] = now() + duration_ms
        return self
    
    def require_capabilities(self, caps: List[str]) -> "MessageBuilder":
        """Set required capabilities."""
        self._message["cap"] = caps
        return self
    
    def extensions(self, extensions: Dict[str, Any]) -> "MessageBuilder":
        """Add extensions."""
        self._message["ext"] = extensions
        return self
    
    def build(self, validate: bool = True) -> Dict[str, Any]:
        """
        Build the message.
        
        Args:
            validate: Validate before returning
            
        Returns:
            The built message
            
        Raises:
            ValueError: If validation fails
        """
        if validate:
            result = validate_message(self._message, strict=False)
            if not result.valid:
                raise ValueError(f"Invalid message: {'; '.join(result.errors)}")
        
        return deep_clone(self._message)


# ============================================================================
# Message Factory Functions
# ============================================================================

def create_message(operation: str) -> MessageBuilder:
    """
    Create a new message builder.
    
    Args:
        operation: Operation type
        
    Returns:
        A new message builder
    """
    return MessageBuilder(operation)


def create_hello(
    identity: Union[AgentIdentity, Dict[str, Any]],
    capabilities: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Create a HELLO message for handshake.
    
    Args:
        identity: Agent identity
        capabilities: Agent capabilities
        
    Returns:
        HELLO message
    """
    caps = capabilities or {}
    return (
        create_message(Operations.HELLO.value)
        .from_agent(identity)
        .payload({
            "protocol_versions": [PROTOCOL_VERSION],
            "capabilities": caps.get("operations", ["query", "respond"]),
            "extensions": caps.get("extensions", []),
            "max_message_size": SizeLimits.SINGLE_MESSAGE,
            "supported_cls": [c.value for c in Classifications]
        })
        .classification(Classifications.INTERNAL.value)
        .build()
    )


def create_query(
    query: Dict[str, Any],
    from_identity: Union[AgentIdentity, Dict[str, Any]],
    to_identity: Union[AgentIdentity, Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Create a QUERY message.
    
    Args:
        query: Query parameters (domain, intent, params)
        from_identity: Sender identity
        to_identity: Recipient identity
        
    Returns:
        QUERY message
    """
    return (
        create_message(Operations.QUERY.value)
        .from_agent(from_identity)
        .to_agent(to_identity)
        .payload(query)
        .classification(Classifications.INTERNAL.value)
        .build()
    )


def create_response(
    reply_to_id: str,
    response: Dict[str, Any],
    from_identity: Union[AgentIdentity, Dict[str, Any]],
    to_identity: Union[AgentIdentity, Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Create a RESPOND message.
    
    Args:
        reply_to_id: Original message ID
        response: Response data
        from_identity: Sender identity
        to_identity: Recipient identity
        
    Returns:
        RESPOND message
    """
    return (
        create_message(Operations.RESPOND.value)
        .from_agent(from_identity)
        .to_agent(to_identity)
        .reply_to(reply_to_id)
        .payload({
            "status": "success",
            "data": response
        })
        .classification(Classifications.INTERNAL.value)
        .build()
    )


def create_task(
    task: Dict[str, Any],
    from_identity: Union[AgentIdentity, Dict[str, Any]],
    to_identity: Union[AgentIdentity, Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Create a TASK message.
    
    Args:
        task: Task definition (description, type, constraints, etc.)
        from_identity: Sender identity
        to_identity: Recipient identity
        
    Returns:
        TASK message
    """
    task_payload = {
        "action": "create",
        "task_id": task.get("id", f"task-{generate_uuid()[:8]}"),
        "type": task.get("type", "general"),
        "description": task.get("description"),
        "constraints": task.get("constraints", {}),
        "priority": task.get("priority", "normal")
    }
    
    if "deadline" in task:
        task_payload["deadline"] = task["deadline"]
    
    if "callback" in task:
        task_payload["callback"] = task["callback"]
    
    return (
        create_message(Operations.TASK.value)
        .from_agent(from_identity)
        .to_agent(to_identity)
        .payload(task_payload)
        .classification(Classifications.INTERNAL.value)
        .build()
    )


def create_error(
    reply_to_id: str,
    error: Dict[str, Any],
    from_identity: Union[AgentIdentity, Dict[str, Any]],
    to_identity: Union[AgentIdentity, Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Create an ERROR message.
    
    Args:
        reply_to_id: Original message ID that caused the error
        error: Error details (code, message, etc.)
        from_identity: Sender identity
        to_identity: Recipient identity
        
    Returns:
        ERROR message
    """
    return (
        create_message(Operations.ERROR.value)
        .from_agent(from_identity)
        .to_agent(to_identity)
        .reply_to(reply_to_id)
        .payload({
            "code": error.get("code", ErrorCodes.E_INTERNAL.value),
            "category": error.get("category", "execution"),
            "message": error.get("message"),
            "field": error.get("field"),
            "recoverable": error.get("recoverable", True),
            "suggestion": error.get("suggestion")
        })
        .classification(Classifications.INTERNAL.value)
        .build()
    )


# ============================================================================
# Envelope Functions
# ============================================================================

def wrap_in_envelope(
    message: Dict[str, Any],
    compressed: bool = False
) -> Dict[str, Any]:
    """
    Wrap a message in an envelope.
    
    Args:
        message: Message to wrap
        compressed: Whether to compress
        
    Returns:
        Envelope containing the message
    """
    return {
        "moltspeak": PROTOCOL_VERSION,
        "envelope": {
            "encrypted": False,
            "compressed": compressed,
            "encoding": "utf-8"
        },
        "message": message
    }


def unwrap_envelope(envelope: Dict[str, Any]) -> Dict[str, Any]:
    """
    Unwrap a message from an envelope.
    
    Args:
        envelope: Envelope to unwrap
        
    Returns:
        The contained message
        
    Raises:
        ValueError: If envelope is invalid or encrypted
    """
    validation = validate_envelope(envelope)
    if not validation.valid:
        raise ValueError(f"Invalid envelope: {'; '.join(validation.errors)}")
    
    if envelope.get("envelope", {}).get("encrypted"):
        raise ValueError("Cannot unwrap encrypted envelope without decryption key")
    
    return envelope["message"]


# ============================================================================
# Encoding/Decoding
# ============================================================================

def encode(
    message: Dict[str, Any],
    pretty: bool = False,
    envelope: bool = False
) -> str:
    """
    Encode a message to JSON string.
    
    Args:
        message: Message to encode
        pretty: Pretty print
        envelope: Wrap in envelope
        
    Returns:
        JSON encoded message
    """
    data = wrap_in_envelope(message) if envelope else message
    
    if pretty:
        return json.dumps(data, indent=2)
    return json.dumps(data)


def decode(
    json_str: str,
    validate: bool = True,
    should_unwrap: bool = True
) -> Dict[str, Any]:
    """
    Decode a JSON string to message.
    
    Args:
        json_str: JSON string to decode
        validate: Validate after decoding
        should_unwrap: Unwrap if envelope
        
    Returns:
        Decoded message
        
    Raises:
        ValueError: If JSON is invalid or validation fails
    """
    try:
        data = json.loads(json_str)
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON: {e}")
    
    # Check if it's an envelope
    message = data
    if "moltspeak" in data and "envelope" in data:
        if should_unwrap:
            message = unwrap_envelope(data)
        else:
            return data
    
    if validate:
        result = validate_message(message, strict=False, check_pii=False)
        if not result.valid:
            raise ValueError(f"Invalid message: {'; '.join(result.errors)}")
    
    return message


# ============================================================================
# Signing (Placeholder)
# ============================================================================

def sign(message: Dict[str, Any], private_key: str) -> Dict[str, Any]:
    """
    Sign a message (placeholder - requires actual crypto implementation).
    
    Args:
        message: Message to sign
        private_key: Private key for signing (ed25519 format expected)
        
    Returns:
        Message with signature
        
    Note:
        This is a placeholder. In production, use actual Ed25519 signing.
    """
    if not private_key:
        raise ValueError("Private key required for signing")
    
    msg_copy = deep_clone(message)
    
    # Create a deterministic string representation
    sorted_keys = sorted([k for k in msg_copy.keys() if k != "sig"])
    payload = "|".join(json.dumps(msg_copy[k]) for k in sorted_keys)
    
    # Placeholder signature
    import base64
    mock_sig = base64.b64encode(payload.encode()).decode()[:64]
    msg_copy["sig"] = f"ed25519:{mock_sig}"
    
    return msg_copy


def verify(message: Dict[str, Any], public_key: str) -> bool:
    """
    Verify a message signature (placeholder - requires actual crypto implementation).
    
    Args:
        message: Signed message to verify
        public_key: Public key for verification
        
    Returns:
        Whether signature is valid
        
    Note:
        This is a placeholder. In production, use actual Ed25519 verification.
    """
    if "sig" not in message:
        return False
    
    if not public_key:
        raise ValueError("Public key required for verification")
    
    # Placeholder: just check signature format
    return message["sig"].startswith("ed25519:") and len(message["sig"]) > 16


# ============================================================================
# Natural Language Encoding
# ============================================================================

def parse_natural_language(
    text: str,
    from_identity: Union[AgentIdentity, Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Parse natural language into a structured message.
    
    Args:
        text: Natural language text
        from_identity: Sender identity
        
    Returns:
        Structured MoltSpeak message
    """
    lower = text.lower().strip()
    
    # Detect query patterns
    if lower.startswith(("query ", "ask ", "what is ")):
        query = re.sub(r"^(query|ask|what is)\s+", "", text, flags=re.IGNORECASE)
        return create_query(
            {"domain": "general", "intent": "information", "params": {"query": query}},
            from_identity,
            {"agent": "unknown"}
        )
    
    # Detect task patterns
    if lower.startswith(("do ", "task ", "please ")):
        description = re.sub(r"^(do|task|please)\s+", "", text, flags=re.IGNORECASE)
        return create_task(
            {"description": description, "type": "general"},
            from_identity,
            {"agent": "unknown"}
        )
    
    # Default: treat as query
    return create_query(
        {"domain": "general", "intent": "natural", "params": {"text": text}},
        from_identity,
        {"agent": "unknown"}
    )


def to_natural_language(message: Dict[str, Any]) -> str:
    """
    Convert a structured message to natural language description.
    
    Args:
        message: MoltSpeak message
        
    Returns:
        Natural language description
    """
    op = message.get("op")
    p = message.get("p", {})
    from_agent = message.get("from", {}).get("agent", "unknown agent")
    to_agent = message.get("to", {}).get("agent", "unknown recipient")
    
    if op == Operations.HELLO.value:
        caps = ", ".join(p.get("capabilities", []))
        return f"{from_agent} initiates handshake with capabilities: {caps}"
    
    if op == Operations.QUERY.value:
        if p.get("params", {}).get("text"):
            return f'{from_agent} asks {to_agent}: "{p["params"]["text"]}"'
        return (
            f"{from_agent} queries {to_agent} about "
            f"{p.get('domain', 'unknown domain')}: {p.get('intent', 'unknown intent')}"
        )
    
    if op == Operations.RESPOND.value:
        data = json.dumps(p.get("data", p))
        return f"{from_agent} responds to {to_agent}: {data}"
    
    if op == Operations.TASK.value:
        desc = p.get("description", "unknown task")
        priority = p.get("priority", "normal")
        return f'{from_agent} assigns task to {to_agent}: "{desc}" (priority: {priority})'
    
    if op == Operations.ERROR.value:
        return f'{from_agent} reports error to {to_agent}: [{p.get("code")}] {p.get("message")}'
    
    if op == Operations.CONSENT.value:
        data_types = ", ".join(p.get("data_types", []))
        return f"{from_agent} requests consent from {to_agent} for: {data_types}"
    
    return f"{from_agent} sends {op} to {to_agent}"


# ============================================================================
# Module Exports (for import *)
# ============================================================================

__all__ = [
    # Constants
    "PROTOCOL_VERSION",
    "Operations",
    "Classifications",
    "ErrorCodes",
    "SizeLimits",
    "PII_PATTERNS",
    
    # Data Classes
    "AgentIdentity",
    "ValidationResult",
    "PIIDetectionResult",
    
    # Utilities
    "generate_uuid",
    "now",
    "deep_clone",
    "byte_size",
    
    # PII
    "detect_pii",
    "mask_pii",
    
    # Validation
    "validate_message",
    "validate_envelope",
    
    # Message Building
    "MessageBuilder",
    "create_message",
    "create_hello",
    "create_query",
    "create_response",
    "create_task",
    "create_error",
    
    # Envelope
    "wrap_in_envelope",
    "unwrap_envelope",
    
    # Encoding/Decoding
    "encode",
    "decode",
    
    # Signing
    "sign",
    "verify",
    
    # Natural Language
    "parse_natural_language",
    "to_natural_language",
]


if __name__ == "__main__":
    # Quick demo
    print("MoltSpeak Python SDK v" + PROTOCOL_VERSION)
    print("-" * 40)
    
    # Create identities
    alice = AgentIdentity(agent="alice-agent", org="acme")
    bob = AgentIdentity(agent="bob-agent", org="widgets")
    
    # Create a query
    query = create_query(
        {"domain": "inventory", "intent": "check", "params": {"sku": "ABC123"}},
        alice,
        bob
    )
    
    print("\nQuery message:")
    print(encode(query, pretty=True))
    
    # Create a response
    response = create_response(
        query["id"],
        {"sku": "ABC123", "quantity": 42},
        bob,
        alice
    )
    
    print("\nResponse message:")
    print(encode(response, pretty=True))
    
    # Natural language conversion
    print("\nNatural language:")
    print(f"  Query: {to_natural_language(query)}")
    print(f"  Response: {to_natural_language(response)}")
