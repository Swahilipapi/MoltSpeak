"""
MoltSpeak Data Classification
"""
import re
from dataclasses import dataclass
from typing import List, Optional, Dict, Any
from enum import Enum


class Classification(str, Enum):
    """Data classification levels"""
    PUBLIC = "pub"        # Safe for anyone
    INTERNAL = "int"      # Agent-to-agent only
    CONFIDENTIAL = "conf" # Sensitive business data
    PII = "pii"           # Personal data - requires consent
    SECRET = "sec"        # Credentials, keys - never log


@dataclass
class PIIMeta:
    """Metadata for PII classification"""
    types: List[str]           # email, phone, name, ssn, etc.
    consent_granted_by: str    # user identifier
    consent_purpose: str       # what the data is used for
    consent_proof: str         # consent token
    consent_expires: Optional[int] = None  # unix ms
    mask_fields: Optional[List[str]] = None
    scope: Optional[str] = None  # internal_only, etc.
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "types": self.types,
            "consent": {
                "granted_by": self.consent_granted_by,
                "purpose": self.consent_purpose,
                "proof": self.consent_proof,
                "expires": self.consent_expires,
                "scope": self.scope,
            },
            "mask_fields": self.mask_fields,
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "PIIMeta":
        consent = data.get("consent", {})
        return cls(
            types=data.get("types", []),
            consent_granted_by=consent.get("granted_by", ""),
            consent_purpose=consent.get("purpose", ""),
            consent_proof=consent.get("proof", ""),
            consent_expires=consent.get("expires"),
            mask_fields=data.get("mask_fields"),
            scope=consent.get("scope"),
        )


class PIIDetector:
    """
    Detect PII patterns in text.
    
    All outgoing messages should be scanned before transmission.
    """
    
    # Common PII patterns
    PATTERNS = {
        "email": r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}',
        "phone": r'\+?[1-9]\d{1,14}',
        "ssn": r'\d{3}-\d{2}-\d{4}',
        "credit_card": r'\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}',
        "ip_address": r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}',
        "date_of_birth": r'\d{1,2}[/-]\d{1,2}[/-]\d{2,4}',
    }
    
    # Compiled patterns for efficiency
    _compiled = {name: re.compile(pattern) for name, pattern in PATTERNS.items()}
    
    @classmethod
    def detect(cls, text: str) -> Dict[str, List[str]]:
        """
        Scan text for PII patterns.
        
        Returns:
            Dict mapping PII type to list of found matches
        """
        results = {}
        for pii_type, pattern in cls._compiled.items():
            matches = pattern.findall(text)
            if matches:
                results[pii_type] = matches
        return results
    
    @classmethod
    def contains_pii(cls, text: str) -> bool:
        """Quick check if text contains any PII"""
        return bool(cls.detect(text))
    
    @classmethod
    def mask(cls, text: str, mask_char: str = "*") -> str:
        """
        Mask all PII in text.
        
        Replaces middle portions of detected PII with mask character.
        """
        result = text
        for pii_type, pattern in cls._compiled.items():
            def _mask_match(match):
                value = match.group(0)
                if len(value) <= 4:
                    return mask_char * len(value)
                # Keep first 2 and last 2 characters
                return value[:2] + mask_char * (len(value) - 4) + value[-2:]
            result = pattern.sub(_mask_match, result)
        return result
    
    @classmethod
    def redact(cls, text: str, pii_type: str = None) -> str:
        """
        Fully redact PII in text.
        
        Replaces with [REDACTED:{type}] marker.
        """
        result = text
        patterns_to_use = {pii_type: cls._compiled[pii_type]} if pii_type else cls._compiled
        
        for pt, pattern in patterns_to_use.items():
            result = pattern.sub(f"[REDACTED:{pt.upper()}]", result)
        return result


class ClassificationValidator:
    """Validate classification requirements"""
    
    @staticmethod
    def validate_message(message: "Message") -> List[str]:
        """
        Validate classification compliance.
        
        Returns list of violations (empty if valid).
        """
        errors = []
        payload_str = str(message.payload)
        
        # Check for PII in non-PII classified messages
        if message.classification != Classification.PII.value:
            pii_found = PIIDetector.detect(payload_str)
            if pii_found:
                errors.append(
                    f"PII detected but classification is '{message.classification}': {list(pii_found.keys())}"
                )
        
        # Check PII messages have consent
        if message.classification == Classification.PII.value:
            if not message.pii_meta:
                errors.append("PII classification requires pii_meta with consent")
            elif not message.pii_meta.get("consent", {}).get("proof"):
                errors.append("PII classification requires consent proof")
        
        # Check secrets aren't being transmitted externally
        if message.classification == Classification.SECRET.value:
            if message.sender.org != message.recipient.org:
                errors.append("SECRET classification cannot be transmitted across organizations")
        
        return errors
    
    @staticmethod
    def can_log(classification: str) -> bool:
        """Check if messages with this classification can be logged"""
        return classification not in [Classification.SECRET.value]
    
    @staticmethod
    def must_encrypt(classification: str) -> bool:
        """Check if messages with this classification require encryption"""
        return classification in [
            Classification.CONFIDENTIAL.value,
            Classification.PII.value,
            Classification.SECRET.value,
        ]
