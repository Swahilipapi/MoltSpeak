"""
MoltSpeak Python SDK

A compact, secure, privacy-preserving protocol for agent-to-agent communication.
"""

from .message import Message, MessageBuilder, Operation
from .agent import Agent, AgentIdentity
from .session import Session
from .operations import Query, Respond, Task, Stream, Tool, Consent, Error
from .classification import Classification, PIIMeta
from .crypto import sign_message, verify_signature, encrypt_message, decrypt_message
from .discovery import (
    Registry,
    AgentProfile,
    AgentInfo,
    Registration,
    Endpoint,
    Visibility,
    DiscoveryResult,
    PongResponse,
    discover,
    find_agent,
    ping,
)
from .exceptions import (
    MoltSpeakError,
    ValidationError,
    SignatureError,
    CapabilityError,
    ConsentError,
    RateLimitError,
)

__version__ = "0.1.0"
__all__ = [
    # Core
    "Message",
    "MessageBuilder",
    "Operation",
    "Agent",
    "AgentIdentity",
    "Session",
    # Operations
    "Query",
    "Respond",
    "Task",
    "Stream",
    "Tool",
    "Consent",
    "Error",
    # Classification
    "Classification",
    "PIIMeta",
    # Crypto
    "sign_message",
    "verify_signature",
    "encrypt_message",
    "decrypt_message",
    # Discovery
    "Registry",
    "AgentProfile",
    "AgentInfo",
    "Registration",
    "Endpoint",
    "Visibility",
    "DiscoveryResult",
    "PongResponse",
    "discover",
    "find_agent",
    "ping",
    # Exceptions
    "MoltSpeakError",
    "ValidationError",
    "SignatureError",
    "CapabilityError",
    "ConsentError",
    "RateLimitError",
]
