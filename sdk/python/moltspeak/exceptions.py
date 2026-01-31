"""
MoltSpeak Exceptions
"""


class MoltSpeakError(Exception):
    """Base exception for all MoltSpeak errors"""
    
    def __init__(self, message: str, code: str = "E_INTERNAL", recoverable: bool = False):
        super().__init__(message)
        self.code = code
        self.recoverable = recoverable


class ValidationError(MoltSpeakError):
    """Message validation failed"""
    
    def __init__(self, message: str, field: str = None):
        super().__init__(message, code="E_SCHEMA", recoverable=True)
        self.field = field


class SignatureError(MoltSpeakError):
    """Signature verification failed"""
    
    def __init__(self, message: str = "Signature verification failed"):
        super().__init__(message, code="E_SIGNATURE", recoverable=False)


class CapabilityError(MoltSpeakError):
    """Required capability not held"""
    
    def __init__(self, capability: str):
        super().__init__(
            f"Required capability not held: {capability}",
            code="E_CAPABILITY",
            recoverable=False
        )
        self.capability = capability


class ConsentError(MoltSpeakError):
    """PII transmitted without valid consent"""
    
    def __init__(self, pii_types: list = None):
        super().__init__(
            f"PII transmitted without consent: {pii_types}",
            code="E_CONSENT",
            recoverable=True
        )
        self.pii_types = pii_types or []


class RateLimitError(MoltSpeakError):
    """Rate limit exceeded"""
    
    def __init__(self, retry_after_ms: int = None):
        super().__init__(
            "Rate limit exceeded",
            code="E_RATE_LIMIT",
            recoverable=True
        )
        self.retry_after_ms = retry_after_ms


class TimeoutError(MoltSpeakError):
    """Operation timed out"""
    
    def __init__(self, message: str = "Operation timed out"):
        super().__init__(message, code="E_TIMEOUT", recoverable=True)


class AuthenticationError(MoltSpeakError):
    """Authentication failed"""
    
    def __init__(self, message: str = "Authentication failed"):
        super().__init__(message, code="E_AUTH_FAILED", recoverable=False)


class ProtocolError(MoltSpeakError):
    """Protocol-level error"""
    
    def __init__(self, message: str, code: str = "E_PARSE"):
        super().__init__(message, code=code, recoverable=False)
