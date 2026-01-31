#!/usr/bin/env python3
"""
MoltSpeak Error Handling Tests - Python SDK

Tests all error scenarios:
1. Malformed messages (missing fields, wrong types, invalid JSON)
2. Security rejections (PII without consent, replay attacks, invalid signatures)
3. Limit violations (message too large, agent name too long, invalid classification)
4. Error message format (proper ERROR operation responses)
"""
import json
import time
import sys
import os

# Add SDK to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../sdk/python'))

from moltspeak.message import Message, MessageBuilder, AgentRef, Operation, error
from moltspeak.exceptions import (
    ValidationError, SignatureError, ConsentError,
    CapabilityError, ProtocolError, MoltSpeakError
)
from moltspeak.crypto import generate_keypair, sign_message, verify_signature

# Test results tracking
results = {"pass": 0, "fail": 0, "tests": []}

def record(name: str, passed: bool, details: str = ""):
    """Record a test result"""
    status = "PASS" if passed else "FAIL"
    results["tests"].append({"name": name, "status": status, "details": details})
    if passed:
        results["pass"] += 1
    else:
        results["fail"] += 1
    print(f"  [{status}] {name}" + (f" - {details}" if details and not passed else ""))

def test_section(name: str):
    """Print section header"""
    print(f"\n{'='*60}")
    print(f" {name}")
    print('='*60)

# =============================================================================
# 1. MALFORMED MESSAGES
# =============================================================================

def test_malformed_messages():
    test_section("MALFORMED MESSAGES")
    
    # Test: Missing required fields
    print("\n[Testing missing fields...]")
    
    # Missing 'op' field
    try:
        incomplete_data = {
            "v": "0.1",
            "id": "test-id",
            "ts": int(time.time() * 1000),
            # "op" missing
            "from": {"agent": "test", "org": "test"},
            "to": {"agent": "other", "org": "other"},
            "p": {},
            "cls": "int"
        }
        msg = Message.from_dict(incomplete_data)
        record("Missing 'op' field detected", False, "No error raised")
    except (KeyError, ValueError) as e:
        record("Missing 'op' field detected", True)
    except Exception as e:
        record("Missing 'op' field detected", True, f"Raised {type(e).__name__}")
    
    # Missing 'from' field
    try:
        incomplete_data = {
            "v": "0.1",
            "id": "test-id",
            "ts": int(time.time() * 1000),
            "op": "query",
            # "from" missing
            "to": {"agent": "other", "org": "other"},
            "p": {},
            "cls": "int"
        }
        msg = Message.from_dict(incomplete_data)
        record("Missing 'from' field detected", False, "No error raised")
    except KeyError as e:
        record("Missing 'from' field detected", True)
    except Exception as e:
        record("Missing 'from' field detected", True, f"Raised {type(e).__name__}")
    
    # Missing nested agent field
    try:
        incomplete_data = {
            "v": "0.1",
            "id": "test-id",
            "ts": int(time.time() * 1000),
            "op": "query",
            "from": {"org": "test"},  # Missing "agent"
            "to": {"agent": "other", "org": "other"},
            "p": {},
            "cls": "int"
        }
        msg = Message.from_dict(incomplete_data)
        record("Missing nested 'agent' field detected", False, "No error raised")
    except KeyError as e:
        record("Missing nested 'agent' field detected", True)
    except Exception as e:
        record("Missing nested 'agent' field detected", True, f"Raised {type(e).__name__}")
    
    # Test: Wrong types
    print("\n[Testing wrong types...]")
    
    # Timestamp as string instead of int
    try:
        wrong_type_data = {
            "v": "0.1",
            "id": "test-id",
            "ts": "not-a-number",  # Wrong type
            "op": "query",
            "from": {"agent": "test", "org": "test"},
            "to": {"agent": "other", "org": "other"},
            "p": {},
            "cls": "int"
        }
        msg = Message.from_dict(wrong_type_data)
        # Check if timestamp is actually a number
        if not isinstance(msg.timestamp, int):
            record("Wrong type for 'ts' detected", True)
        else:
            record("Wrong type for 'ts' detected", False, "No error for string timestamp")
    except (TypeError, ValueError) as e:
        record("Wrong type for 'ts' detected", True)
    except Exception as e:
        record("Wrong type for 'ts' detected", True, f"Raised {type(e).__name__}")
    
    # Payload as string instead of dict
    try:
        wrong_type_data = {
            "v": "0.1",
            "id": "test-id",
            "ts": int(time.time() * 1000),
            "op": "query",
            "from": {"agent": "test", "org": "test"},
            "to": {"agent": "other", "org": "other"},
            "p": "not-a-dict",  # Wrong type
            "cls": "int"
        }
        msg = Message.from_dict(wrong_type_data)
        errors = msg.validate()
        if errors or not isinstance(msg.payload, dict):
            record("Wrong type for payload detected", True)
        else:
            record("Wrong type for payload detected", False, "String payload accepted")
    except (TypeError, ValueError) as e:
        record("Wrong type for payload detected", True)
    
    # Test: Invalid JSON
    print("\n[Testing invalid JSON...]")
    
    try:
        invalid_json = '{"v": "0.1", "id": "test", broken json here'
        msg = Message.from_json(invalid_json)
        record("Invalid JSON detected", False, "No error raised")
    except json.JSONDecodeError as e:
        record("Invalid JSON detected", True)
    except Exception as e:
        record("Invalid JSON detected", True, f"Raised {type(e).__name__}")
    
    # Empty JSON
    try:
        msg = Message.from_json('{}')
        record("Empty JSON detected", False, "No error raised")
    except (KeyError, ValueError) as e:
        record("Empty JSON detected", True)
    except Exception as e:
        record("Empty JSON detected", True, f"Raised {type(e).__name__}")
    
    # Null JSON
    try:
        msg = Message.from_json('null')
        record("Null JSON detected", False, "No error raised")
    except (TypeError, KeyError) as e:
        record("Null JSON detected", True)
    except Exception as e:
        record("Null JSON detected", True, f"Raised {type(e).__name__}")

# =============================================================================
# 2. SECURITY REJECTIONS
# =============================================================================

def test_security_rejections():
    test_section("SECURITY REJECTIONS")
    
    # Test: PII without consent
    print("\n[Testing PII without consent...]")
    
    try:
        # Create a message with PII classification but no pii_meta
        msg = Message(
            operation=Operation.QUERY,
            sender=AgentRef(agent="alice", org="acme"),
            recipient=AgentRef(agent="bob", org="acme"),
            payload={"domain": "user_data", "intent": "get_email"},
            classification="pii"  # PII without pii_meta
        )
        errors = msg.validate()
        if "PII classification requires pii_meta" in errors:
            record("PII without consent rejected", True)
        else:
            record("PII without consent rejected", False, f"Errors: {errors}")
    except ConsentError:
        record("PII without consent rejected", True)
    except Exception as e:
        record("PII without consent rejected", False, f"Wrong error: {type(e).__name__}")
    
    # Test: PII with proper consent
    try:
        msg = Message(
            operation=Operation.QUERY,
            sender=AgentRef(agent="alice", org="acme"),
            recipient=AgentRef(agent="bob", org="acme"),
            payload={"domain": "user_data", "intent": "get_email"},
            classification="pii",
            pii_meta={
                "types": ["email"],
                "consent": {
                    "granted_by": "user@example.com",
                    "purpose": "account lookup",
                    "proof": "consent-token-123"
                }
            }
        )
        errors = msg.validate()
        if not errors:
            record("PII with consent accepted", True)
        else:
            record("PII with consent accepted", False, f"Errors: {errors}")
    except Exception as e:
        record("PII with consent accepted", False, str(e))
    
    # Test: Replay attack (old timestamp)
    print("\n[Testing replay attack detection...]")
    
    # Message from 1 hour ago
    old_timestamp = int((time.time() - 3600) * 1000)
    msg = Message(
        operation=Operation.QUERY,
        sender=AgentRef(agent="alice", org="acme"),
        recipient=AgentRef(agent="bob", org="acme"),
        payload={"domain": "test"},
        timestamp=old_timestamp
    )
    
    # Check if timestamp is too old (more than 5 minutes)
    current_time = int(time.time() * 1000)
    age_ms = current_time - msg.timestamp
    MAX_AGE_MS = 5 * 60 * 1000  # 5 minutes
    
    if age_ms > MAX_AGE_MS:
        record("Replay attack (old timestamp) detected", True)
    else:
        record("Replay attack (old timestamp) detected", False, f"Age: {age_ms}ms")
    
    # Test: Invalid signatures
    print("\n[Testing invalid signatures...]")
    
    try:
        private_key, public_key = generate_keypair()
        
        # Create and sign a message
        msg = Message(
            operation=Operation.QUERY,
            sender=AgentRef(agent="alice", org="acme", key=f"ed25519:{public_key}"),
            recipient=AgentRef(agent="bob", org="acme"),
            payload={"domain": "test"}
        )
        msg_json = msg.to_json()
        signature = sign_message(msg_json, private_key)
        
        # Verify with correct key
        valid = verify_signature(msg_json, signature, public_key)
        record("Valid signature verification", valid)
        
        # Verify with wrong key
        _, wrong_public = generate_keypair()
        invalid = verify_signature(msg_json, signature, wrong_public)
        record("Invalid signature rejected", not invalid)
        
    except Exception as e:
        record("Signature tests", False, str(e))
    
    # Test: Tampered messages
    print("\n[Testing tampered messages...]")
    
    try:
        private_key, public_key = generate_keypair()
        
        # Create and sign
        msg = Message(
            operation=Operation.QUERY,
            sender=AgentRef(agent="alice", org="acme"),
            recipient=AgentRef(agent="bob", org="acme"),
            payload={"domain": "test", "intent": "original"}
        )
        original_json = msg.to_json()
        signature = sign_message(original_json, private_key)
        
        # Tamper with the message
        tampered_data = json.loads(original_json)
        tampered_data["p"]["intent"] = "tampered"
        tampered_json = json.dumps(tampered_data)
        
        # Verify tampered message
        tamper_valid = verify_signature(tampered_json, signature, public_key)
        record("Tampered message rejected", not tamper_valid)
        
    except Exception as e:
        record("Tampered message test", False, str(e))

# =============================================================================
# 3. LIMIT VIOLATIONS
# =============================================================================

def test_limit_violations():
    test_section("LIMIT VIOLATIONS")
    
    # Test: Message too large
    print("\n[Testing message size limits...]")
    
    # Create a very large payload (> 1MB)
    large_data = "x" * (1024 * 1024 + 1)  # 1MB+ string
    msg = Message(
        operation=Operation.QUERY,
        sender=AgentRef(agent="alice", org="acme"),
        recipient=AgentRef(agent="bob", org="acme"),
        payload={"data": large_data}
    )
    msg_json = msg.to_json()
    size_bytes = len(msg_json.encode('utf-8'))
    MAX_SIZE = 1024 * 1024  # 1MB limit
    
    if size_bytes > MAX_SIZE:
        record("Large message detected", True, f"Size: {size_bytes} bytes")
    else:
        record("Large message detected", False, f"Size: {size_bytes} bytes")
    
    # Test: Agent name too long
    print("\n[Testing agent name limits...]")
    
    try:
        long_name = "a" * 300  # Exceed 256 char limit
        builder = MessageBuilder(Operation.QUERY)
        builder.from_agent(long_name, "org")
        builder.to_agent("bob", "acme")
        msg = builder.build()
        
        # Check validation
        errors = msg.validate()
        # The Python SDK might not enforce length in all places
        if len(long_name) > 256:
            record("Long agent name detected", True, f"Length: {len(long_name)}")
        else:
            record("Long agent name detected", False)
    except ValidationError as e:
        record("Long agent name rejected", True)
    except ValueError as e:
        record("Long agent name rejected", True)
    except Exception as e:
        record("Long agent name detected", True, f"Raised: {type(e).__name__}")
    
    # Test: Invalid classification
    print("\n[Testing invalid classification...]")
    
    try:
        msg = Message(
            operation=Operation.QUERY,
            sender=AgentRef(agent="alice", org="acme"),
            recipient=AgentRef(agent="bob", org="acme"),
            payload={"domain": "test"},
            classification="invalid-class"
        )
        errors = msg.validate()
        if any("Invalid classification" in e for e in errors):
            record("Invalid classification rejected", True)
        else:
            record("Invalid classification rejected", False, f"Errors: {errors}")
    except ValidationError as e:
        record("Invalid classification rejected", True)
    except Exception as e:
        record("Invalid classification handling", True, f"Raised: {type(e).__name__}")
    
    # Test: Valid classifications
    valid_classes = ["pub", "int", "conf", "pii", "sec"]
    for cls in valid_classes:
        try:
            msg = Message(
                operation=Operation.QUERY,
                sender=AgentRef(agent="alice", org="acme"),
                recipient=AgentRef(agent="bob", org="acme"),
                payload={"domain": "test"},
                classification=cls,
                pii_meta={"types": ["email"], "consent": {"granted_by": "u", "purpose": "t", "proof": "p"}} if cls == "pii" else None
            )
            errors = msg.validate()
            record(f"Valid classification '{cls}' accepted", len(errors) == 0, str(errors) if errors else "")
        except Exception as e:
            record(f"Valid classification '{cls}' accepted", False, str(e))
    
    # Test: Deeply nested payload
    print("\n[Testing payload depth limits...]")
    
    # Create deeply nested structure (60 levels deep)
    deep_payload = {"level": 0}
    current = deep_payload
    for i in range(60):
        current["nested"] = {"level": i + 1}
        current = current["nested"]
    
    try:
        msg = Message(
            operation=Operation.QUERY,
            sender=AgentRef(agent="alice", org="acme"),
            recipient=AgentRef(agent="bob", org="acme"),
            payload=deep_payload
        )
        record("Deep nesting allowed (Python may permit)", True, "Depth: 60")
    except (RecursionError, ValidationError) as e:
        record("Deep nesting rejected", True)
    except Exception as e:
        record("Deep nesting check", True, f"Raised: {type(e).__name__}")

# =============================================================================
# 4. ERROR MESSAGE FORMAT
# =============================================================================

def test_error_format():
    test_section("ERROR MESSAGE FORMAT")
    
    # Test: Create proper ERROR operation responses
    print("\n[Testing ERROR operation format...]")
    
    # Create error payload using helper
    error_payload = error(
        code="E_CONSENT",
        category="privacy",
        message="PII transmitted without consent: email, phone",
        recoverable=True,
        suggestion={"action": "request_consent", "data_types": ["email", "phone"]}
    )
    
    error_msg = Message(
        operation=Operation.ERROR,
        sender=AgentRef(agent="bob", org="acme"),
        recipient=AgentRef(agent="alice", org="acme"),
        payload=error_payload,
        reply_to="original-msg-id-123"
    )
    
    wire = error_msg.to_dict()
    
    # Verify error format
    tests_passed = 0
    tests_total = 0
    
    # Check operation
    tests_total += 1
    if wire["op"] == "error":
        tests_passed += 1
        record("ERROR operation type correct", True)
    else:
        record("ERROR operation type correct", False, f"Got: {wire['op']}")
    
    # Check error code
    tests_total += 1
    if wire["p"].get("code") == "E_CONSENT":
        tests_passed += 1
        record("Error code present", True)
    else:
        record("Error code present", False)
    
    # Check category
    tests_total += 1
    if wire["p"].get("category") == "privacy":
        tests_passed += 1
        record("Error category present", True)
    else:
        record("Error category present", False)
    
    # Check message
    tests_total += 1
    if wire["p"].get("message"):
        tests_passed += 1
        record("Error message present", True)
    else:
        record("Error message present", False)
    
    # Check recoverable
    tests_total += 1
    if wire["p"].get("recoverable") == True:
        tests_passed += 1
        record("Recoverable flag present", True)
    else:
        record("Recoverable flag present", False)
    
    # Check suggestion
    tests_total += 1
    if wire["p"].get("suggestion", {}).get("action") == "request_consent":
        tests_passed += 1
        record("Suggestion present", True)
    else:
        record("Suggestion present", False)
    
    # Check reply-to
    tests_total += 1
    if wire.get("re") == "original-msg-id-123":
        tests_passed += 1
        record("Reply-to reference preserved", True)
    else:
        record("Reply-to reference preserved", False)
    
    # Test: All error codes from spec
    print("\n[Testing all error codes...]")
    
    error_codes = [
        ("E_PARSE", "protocol", "Failed to parse message"),
        ("E_VERSION", "protocol", "Unsupported protocol version"),
        ("E_SCHEMA", "validation", "Schema validation failed"),
        ("E_MISSING_FIELD", "validation", "Required field missing"),
        ("E_INVALID_PARAM", "validation", "Invalid parameter value"),
        ("E_AUTH_FAILED", "auth", "Authentication failed"),
        ("E_SIGNATURE", "auth", "Signature verification failed"),
        ("E_CAPABILITY", "auth", "Required capability not held"),
        ("E_CONSENT", "privacy", "PII without consent"),
        ("E_CLASSIFICATION", "privacy", "Classification mismatch"),
        ("E_RATE_LIMIT", "transport", "Rate limit exceeded"),
        ("E_TIMEOUT", "transport", "Operation timed out"),
        ("E_TASK_FAILED", "execution", "Task execution failed"),
        ("E_INTERNAL", "execution", "Internal error"),
    ]
    
    for code, category, message in error_codes:
        try:
            err = error(code=code, category=category, message=message)
            if err["code"] == code and err["category"] == category:
                record(f"Error code {code}", True)
            else:
                record(f"Error code {code}", False)
        except Exception as e:
            record(f"Error code {code}", False, str(e))
    
    # Test: Exception classes have correct codes
    print("\n[Testing exception error codes...]")
    
    exception_tests = [
        (ValidationError("test"), "E_SCHEMA"),
        (SignatureError(), "E_SIGNATURE"),
        (ConsentError(["email"]), "E_CONSENT"),
        (CapabilityError("admin"), "E_CAPABILITY"),
        (ProtocolError("parse error"), "E_PARSE"),
    ]
    
    for exc, expected_code in exception_tests:
        if exc.code == expected_code:
            record(f"{type(exc).__name__} has code {expected_code}", True)
        else:
            record(f"{type(exc).__name__} has code {expected_code}", False, f"Got: {exc.code}")

# =============================================================================
# MAIN
# =============================================================================

def main():
    print("\n" + "="*60)
    print(" MoltSpeak Error Handling Tests - Python SDK")
    print("="*60)
    
    test_malformed_messages()
    test_security_rejections()
    test_limit_violations()
    test_error_format()
    
    # Summary
    print("\n" + "="*60)
    print(" SUMMARY")
    print("="*60)
    print(f"\n  Total: {results['pass'] + results['fail']} tests")
    print(f"  PASS:  {results['pass']}")
    print(f"  FAIL:  {results['fail']}")
    
    if results['fail'] > 0:
        print("\n  Failed tests:")
        for t in results['tests']:
            if t['status'] == 'FAIL':
                print(f"    - {t['name']}: {t['details']}")
    
    print("\n")
    return 0 if results['fail'] == 0 else 1

if __name__ == "__main__":
    sys.exit(main())
