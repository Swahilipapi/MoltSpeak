"""
MoltSpeak Operation types

Provides typed operation classes for common message patterns.
"""
from dataclasses import dataclass, field
from typing import Optional, Dict, Any, List


@dataclass
class Query:
    """Query operation - request information"""
    domain: str
    intent: str
    params: Dict[str, Any] = field(default_factory=dict)
    response_format: Optional[Dict[str, Any]] = None
    
    def to_payload(self) -> Dict[str, Any]:
        payload = {
            "domain": self.domain,
            "intent": self.intent,
            "params": self.params,
        }
        if self.response_format:
            payload["response_format"] = self.response_format
        return payload


@dataclass
class Respond:
    """Response operation - reply to a query"""
    status: str  # success, error, partial
    data: Any
    schema: Optional[str] = None
    
    def to_payload(self) -> Dict[str, Any]:
        payload = {"status": self.status, "data": self.data}
        if self.schema:
            payload["schema"] = self.schema
        return payload


@dataclass
class Task:
    """Task operation - delegate work"""
    action: str  # create, status, cancel, complete
    task_id: str
    task_type: Optional[str] = None
    description: Optional[str] = None
    params: Optional[Dict[str, Any]] = None
    constraints: Optional[Dict[str, Any]] = None
    deadline: Optional[int] = None  # Unix ms
    priority: str = "normal"  # low, normal, high, urgent
    callback: Optional[Dict[str, bool]] = None
    subtasks: Optional[List[Dict[str, Any]]] = None
    
    def to_payload(self) -> Dict[str, Any]:
        payload = {
            "action": self.action,
            "task_id": self.task_id,
        }
        if self.task_type:
            payload["type"] = self.task_type
        if self.description:
            payload["description"] = self.description
        if self.params:
            payload["params"] = self.params
        if self.constraints:
            payload["constraints"] = self.constraints
        if self.deadline:
            payload["deadline"] = self.deadline
        if self.priority != "normal":
            payload["priority"] = self.priority
        if self.callback:
            payload["callback"] = self.callback
        if self.subtasks:
            payload["subtasks"] = self.subtasks
        return payload
    
    @classmethod
    def create(
        cls,
        task_id: str,
        task_type: str,
        description: str = None,
        **kwargs
    ) -> "Task":
        """Factory for task creation"""
        return cls(
            action="create",
            task_id=task_id,
            task_type=task_type,
            description=description,
            **kwargs
        )
    
    @classmethod
    def status(cls, task_id: str) -> "Task":
        """Factory for task status check"""
        return cls(action="status", task_id=task_id)
    
    @classmethod
    def cancel(cls, task_id: str) -> "Task":
        """Factory for task cancellation"""
        return cls(action="cancel", task_id=task_id)


@dataclass
class Stream:
    """Stream operation - large/realtime data"""
    action: str  # start, chunk, end, error
    stream_id: str
    stream_type: Optional[str] = None  # text, binary, json
    data: Optional[Any] = None
    seq: Optional[int] = None
    progress: Optional[float] = None
    total_chunks: Optional[int] = None
    checksum: Optional[str] = None
    
    def to_payload(self) -> Dict[str, Any]:
        payload = {
            "action": self.action,
            "stream_id": self.stream_id,
        }
        if self.stream_type:
            payload["type"] = self.stream_type
        if self.data is not None:
            payload["data"] = self.data
        if self.seq is not None:
            payload["seq"] = self.seq
        if self.progress is not None:
            payload["progress"] = self.progress
        if self.total_chunks is not None:
            payload["total_chunks"] = self.total_chunks
        if self.checksum:
            payload["checksum"] = self.checksum
        return payload
    
    @classmethod
    def start(cls, stream_id: str, stream_type: str = "text") -> "Stream":
        return cls(action="start", stream_id=stream_id, stream_type=stream_type)
    
    @classmethod
    def chunk(cls, stream_id: str, seq: int, data: Any, progress: float = None) -> "Stream":
        return cls(action="chunk", stream_id=stream_id, seq=seq, data=data, progress=progress)
    
    @classmethod
    def end(cls, stream_id: str, total_chunks: int, checksum: str = None) -> "Stream":
        return cls(action="end", stream_id=stream_id, total_chunks=total_chunks, checksum=checksum)


@dataclass
class Tool:
    """Tool operation - invoke a tool"""
    action: str  # invoke, list, describe
    tool: Optional[str] = None
    input: Optional[Dict[str, Any]] = None
    timeout_ms: Optional[int] = None
    
    def to_payload(self) -> Dict[str, Any]:
        payload = {"action": self.action}
        if self.tool:
            payload["tool"] = self.tool
        if self.input:
            payload["input"] = self.input
        if self.timeout_ms:
            payload["timeout_ms"] = self.timeout_ms
        return payload
    
    @classmethod
    def invoke(cls, tool: str, input: Dict[str, Any], timeout_ms: int = None) -> "Tool":
        return cls(action="invoke", tool=tool, input=input, timeout_ms=timeout_ms)
    
    @classmethod
    def list_tools(cls) -> "Tool":
        return cls(action="list")
    
    @classmethod
    def describe(cls, tool: str) -> "Tool":
        return cls(action="describe", tool=tool)


@dataclass
class Consent:
    """Consent operation - PII consent flow"""
    action: str  # request, grant, revoke, verify
    data_types: List[str]
    purpose: str
    human: Optional[str] = None  # user identifier
    duration: str = "session"  # session, 24h, 7d, permanent
    consent_token: Optional[str] = None
    
    def to_payload(self) -> Dict[str, Any]:
        payload = {
            "action": self.action,
            "data_types": self.data_types,
            "purpose": self.purpose,
            "duration": self.duration,
        }
        if self.human:
            payload["human"] = self.human
        if self.consent_token:
            payload["consent_token"] = self.consent_token
        return payload
    
    @classmethod
    def request(cls, data_types: List[str], purpose: str, human: str) -> "Consent":
        return cls(action="request", data_types=data_types, purpose=purpose, human=human)
    
    @classmethod
    def grant(cls, data_types: List[str], purpose: str, consent_token: str) -> "Consent":
        return cls(action="grant", data_types=data_types, purpose=purpose, consent_token=consent_token)
    
    @classmethod
    def revoke(cls, consent_token: str) -> "Consent":
        return cls(action="revoke", data_types=[], purpose="", consent_token=consent_token)


@dataclass
class Error:
    """Error operation - error response"""
    code: str
    category: str  # protocol, validation, auth, privacy, transport, execution
    message: str
    recoverable: bool = False
    field: Optional[str] = None
    suggestion: Optional[Dict[str, Any]] = None
    context: Optional[Dict[str, Any]] = None
    
    def to_payload(self) -> Dict[str, Any]:
        payload = {
            "code": self.code,
            "category": self.category,
            "message": self.message,
            "recoverable": self.recoverable,
        }
        if self.field:
            payload["field"] = self.field
        if self.suggestion:
            payload["suggestion"] = self.suggestion
        if self.context:
            payload["context"] = self.context
        return payload
    
    # Common error factories
    @classmethod
    def parse_error(cls, message: str) -> "Error":
        return cls("E_PARSE", "protocol", message, recoverable=False)
    
    @classmethod
    def validation_error(cls, message: str, field: str = None) -> "Error":
        return cls("E_SCHEMA", "validation", message, recoverable=True, field=field)
    
    @classmethod
    def auth_error(cls, message: str = "Authentication failed") -> "Error":
        return cls("E_AUTH_FAILED", "auth", message, recoverable=False)
    
    @classmethod
    def capability_error(cls, capability: str) -> "Error":
        return cls(
            "E_CAPABILITY", "auth",
            f"Required capability not held: {capability}",
            recoverable=False,
            suggestion={"action": "request_capability", "capability": capability}
        )
    
    @classmethod
    def consent_error(cls, pii_types: List[str]) -> "Error":
        return cls(
            "E_CONSENT", "privacy",
            f"PII transmitted without consent: {pii_types}",
            recoverable=True,
            suggestion={"action": "request_consent", "data_types": pii_types}
        )
    
    @classmethod
    def rate_limit_error(cls, retry_after_ms: int) -> "Error":
        return cls(
            "E_RATE_LIMIT", "transport",
            "Rate limit exceeded",
            recoverable=True,
            suggestion={"action": "retry_after", "delay_ms": retry_after_ms}
        )
