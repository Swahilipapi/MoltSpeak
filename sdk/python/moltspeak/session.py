"""
MoltSpeak Session management
"""
import time
import secrets
from dataclasses import dataclass, field
from typing import Optional, Dict, List, Any


@dataclass
class Session:
    """
    Represents an authenticated session between two agents.
    
    Sessions are established after successful handshake and provide:
    - Session ID for message correlation
    - Shared session key (from key exchange)
    - Negotiated capabilities
    - Expiration tracking
    """
    session_id: str
    local_agent: str
    remote_agent: str
    remote_org: str
    remote_public_key: str
    session_key: Optional[bytes] = None  # Derived from key exchange
    capabilities: List[str] = field(default_factory=list)
    extensions: List[str] = field(default_factory=list)
    created_at: int = field(default_factory=lambda: int(time.time() * 1000))
    expires_at: Optional[int] = None  # Unix ms
    last_activity: int = field(default_factory=lambda: int(time.time() * 1000))
    message_count: int = 0
    
    @classmethod
    def create(
        cls,
        local_agent: str,
        remote_agent: str,
        remote_org: str,
        remote_public_key: str,
        ttl_seconds: int = 3600
    ) -> "Session":
        """Create a new session"""
        now = int(time.time() * 1000)
        return cls(
            session_id=secrets.token_hex(16),
            local_agent=local_agent,
            remote_agent=remote_agent,
            remote_org=remote_org,
            remote_public_key=remote_public_key,
            expires_at=now + (ttl_seconds * 1000),
        )
    
    def is_expired(self) -> bool:
        """Check if session has expired"""
        if self.expires_at is None:
            return False
        return int(time.time() * 1000) > self.expires_at
    
    def is_valid(self) -> bool:
        """Check if session is valid for use"""
        return not self.is_expired()
    
    def touch(self) -> None:
        """Update last activity timestamp"""
        self.last_activity = int(time.time() * 1000)
        self.message_count += 1
    
    def has_capability(self, capability: str) -> bool:
        """Check if remote agent has a capability"""
        return capability in self.capabilities
    
    def extend(self, ttl_seconds: int = 3600) -> None:
        """Extend session expiration"""
        self.expires_at = int(time.time() * 1000) + (ttl_seconds * 1000)


class SessionManager:
    """
    Manage multiple sessions.
    
    Tracks active sessions, handles expiration, limits per-peer sessions.
    """
    
    def __init__(self, max_sessions: int = 100, default_ttl: int = 3600):
        self._sessions: Dict[str, Session] = {}
        self._by_remote: Dict[str, List[str]] = {}  # remote_agent -> [session_ids]
        self.max_sessions = max_sessions
        self.default_ttl = default_ttl
    
    def create(
        self,
        local_agent: str,
        remote_agent: str,
        remote_org: str,
        remote_public_key: str,
        ttl_seconds: Optional[int] = None
    ) -> Session:
        """Create and store a new session"""
        # Clean up expired sessions first
        self._cleanup_expired()
        
        # Check limits
        if len(self._sessions) >= self.max_sessions:
            # Remove oldest session
            oldest = min(self._sessions.values(), key=lambda s: s.last_activity)
            self.remove(oldest.session_id)
        
        session = Session.create(
            local_agent=local_agent,
            remote_agent=remote_agent,
            remote_org=remote_org,
            remote_public_key=remote_public_key,
            ttl_seconds=ttl_seconds or self.default_ttl,
        )
        
        self._sessions[session.session_id] = session
        
        if remote_agent not in self._by_remote:
            self._by_remote[remote_agent] = []
        self._by_remote[remote_agent].append(session.session_id)
        
        return session
    
    def get(self, session_id: str) -> Optional[Session]:
        """Get session by ID"""
        session = self._sessions.get(session_id)
        if session and session.is_expired():
            self.remove(session_id)
            return None
        return session
    
    def get_for_remote(self, remote_agent: str) -> Optional[Session]:
        """Get an active session for a remote agent"""
        session_ids = self._by_remote.get(remote_agent, [])
        for sid in session_ids:
            session = self.get(sid)
            if session and session.is_valid():
                return session
        return None
    
    def remove(self, session_id: str) -> None:
        """Remove a session"""
        session = self._sessions.pop(session_id, None)
        if session and session.remote_agent in self._by_remote:
            self._by_remote[session.remote_agent] = [
                sid for sid in self._by_remote[session.remote_agent]
                if sid != session_id
            ]
    
    def _cleanup_expired(self) -> None:
        """Remove all expired sessions"""
        expired = [
            sid for sid, session in self._sessions.items()
            if session.is_expired()
        ]
        for sid in expired:
            self.remove(sid)
    
    def active_count(self) -> int:
        """Count active sessions"""
        self._cleanup_expired()
        return len(self._sessions)
    
    def list_sessions(self) -> List[Session]:
        """List all active sessions"""
        self._cleanup_expired()
        return list(self._sessions.values())
