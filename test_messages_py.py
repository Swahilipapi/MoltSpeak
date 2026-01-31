#!/usr/bin/env python3
"""
MoltSpeak Message Builder Comprehensive Test - Python
Tests all 9 operations, builder patterns, factory functions, and message fields
"""

import sys
import json
import time
sys.path.insert(0, '/tmp/MoltSpeak/sdk/python')

from moltspeak import (
    Message, MessageBuilder, Operation,
    Query, Respond, Task, Stream, Tool, Consent, Error
)
from moltspeak.message import AgentRef

# Test tracking
results = {"passed": 0, "failed": 0, "tests": []}

def test(name, fn):
    """Run a test and track results"""
    try:
        fn()
        results["passed"] += 1
        results["tests"].append({"name": name, "status": "PASS"})
        print(f"  ✅ PASS: {name}")
        return True
    except Exception as e:
        results["failed"] += 1
        results["tests"].append({"name": name, "status": "FAIL", "error": str(e)})
        print(f"  ❌ FAIL: {name} - {e}")
        return False

def sender():
    return AgentRef(agent="alice", org="test-org", key="pk_alice123")

def recipient():
    return AgentRef(agent="bob", org="other-org")

# =============================================================================
# 1. ALL 9 OPERATIONS TEST
# =============================================================================
print("\n" + "="*60)
print("1. ALL 9 OPERATIONS")
print("="*60)

def test_hello():
    msg = Message(
        operation=Operation.HELLO,
        sender=sender(),
        recipient=recipient(),
        payload={
            "protocol": "moltspeak",
            "version": "0.1",
            "capabilities": ["query", "task"]
        }
    )
    assert msg.operation == Operation.HELLO
    assert len(msg.validate()) == 0
    wire = msg.to_dict()
    assert wire["op"] == "hello"

test("hello operation", test_hello)

def test_verify():
    msg = Message(
        operation=Operation.VERIFY,
        sender=sender(),
        recipient=recipient(),
        payload={
            "challenge": "abc123xyz",
            "timestamp": int(time.time() * 1000)
        }
    )
    assert msg.operation == Operation.VERIFY
    assert len(msg.validate()) == 0

test("verify operation", test_verify)

def test_query():
    msg = Message(
        operation=Operation.QUERY,
        sender=sender(),
        recipient=recipient(),
        payload={
            "domain": "weather",
            "intent": "current",
            "params": {"location": "Amsterdam"}
        }
    )
    assert msg.operation == Operation.QUERY
    assert len(msg.validate()) == 0

test("query operation", test_query)

def test_respond():
    msg = Message(
        operation=Operation.RESPOND,
        sender=sender(),
        recipient=recipient(),
        payload={
            "status": "success",
            "data": {"temperature": 22, "conditions": "sunny"}
        }
    )
    assert msg.operation == Operation.RESPOND
    assert len(msg.validate()) == 0

test("respond operation", test_respond)

def test_task():
    msg = Message(
        operation=Operation.TASK,
        sender=sender(),
        recipient=recipient(),
        payload={
            "action": "create",
            "task_id": "task-001",
            "type": "analysis",
            "description": "Analyze data"
        }
    )
    assert msg.operation == Operation.TASK
    assert len(msg.validate()) == 0

test("task operation", test_task)

def test_stream():
    msg = Message(
        operation=Operation.STREAM,
        sender=sender(),
        recipient=recipient(),
        payload={
            "action": "chunk",
            "stream_id": "stream-001",
            "seq": 1,
            "data": "Hello world",
            "progress": 0.5
        }
    )
    assert msg.operation == Operation.STREAM
    assert len(msg.validate()) == 0

test("stream operation", test_stream)

def test_tool():
    msg = Message(
        operation=Operation.TOOL,
        sender=sender(),
        recipient=recipient(),
        payload={
            "action": "invoke",
            "tool": "calculator",
            "input": {"expression": "2+2"}
        }
    )
    assert msg.operation == Operation.TOOL
    assert len(msg.validate()) == 0

test("tool operation", test_tool)

def test_consent():
    msg = Message(
        operation=Operation.CONSENT,
        sender=sender(),
        recipient=recipient(),
        payload={
            "action": "request",
            "data_types": ["email", "name"],
            "purpose": "personalization"
        }
    )
    assert msg.operation == Operation.CONSENT
    assert len(msg.validate()) == 0

test("consent operation", test_consent)

def test_error():
    msg = Message(
        operation=Operation.ERROR,
        sender=sender(),
        recipient=recipient(),
        payload={
            "code": "E_AUTH_FAILED",
            "category": "auth",
            "message": "Invalid signature",
            "recoverable": False
        }
    )
    assert msg.operation == Operation.ERROR
    assert len(msg.validate()) == 0

test("error operation", test_error)

# =============================================================================
# 2. BUILDER PATTERN TESTS
# =============================================================================
print("\n" + "="*60)
print("2. BUILDER PATTERN")
print("="*60)

def test_builder_chaining():
    msg = (MessageBuilder(Operation.QUERY)
           .from_agent("alice", "test-org", "pk_alice")
           .to_agent("bob", "other-org")
           .with_payload({"domain": "test", "intent": "ping"})
           .classified_as("int")
           .build())
    assert msg.sender.agent == "alice"
    assert msg.recipient.org == "other-org"
    assert msg.payload["domain"] == "test"
    assert msg.classification == "int"

test("builder chaining (.from().to().payload().classify())", test_builder_chaining)

def test_builder_all_methods():
    msg = (MessageBuilder(Operation.TASK)
           .from_agent("alice", "org1", "key123")
           .to_agent("bob", "org2")
           .with_payload({"action": "create", "task_id": "t1"})
           .classified_as("conf")
           .reply_to("msg-123")
           .expires_in(3600)  # 1 hour from now
           .requires_capabilities(["task.create", "task.execute"])
           .with_extension("myext", {"custom": "data"})
           .build())
    
    assert msg.sender.agent == "alice"
    assert msg.reply_to == "msg-123"
    assert msg.expires is not None
    assert msg.capabilities_required == ["task.create", "task.execute"]
    assert msg.extensions == {"myext": {"custom": "data"}}
    assert msg.classification == "conf"

test("builder all methods", test_builder_all_methods)

def test_builder_expires_at():
    future_ts = int(time.time() * 1000) + 60000  # 60 seconds from now
    msg = (MessageBuilder(Operation.QUERY)
           .from_agent("a", "o")
           .to_agent("b", "o")
           .with_payload({})
           .expires_at(future_ts)
           .build())
    assert msg.expires == future_ts

test("builder expires_at", test_builder_expires_at)

def test_builder_with_pii():
    msg = (MessageBuilder(Operation.QUERY)
           .from_agent("alice", "org")
           .to_agent("bob", "org")
           .with_payload({"domain": "profile", "intent": "get"})
           .with_pii(["email", "phone"], "consent-token-123", "user support")
           .build())
    
    assert msg.classification == "pii"
    assert msg.pii_meta is not None
    assert "email" in msg.pii_meta["types"]
    assert msg.pii_meta["consent"]["proof"] == "consent-token-123"

test("builder with_pii", test_builder_with_pii)

def test_builder_missing_sender():
    try:
        (MessageBuilder(Operation.QUERY)
         .to_agent("bob", "org")
         .with_payload({})
         .build())
        assert False, "Should have raised ValueError"
    except ValueError as e:
        assert "Sender" in str(e)

test("builder missing sender (should fail)", test_builder_missing_sender)

def test_builder_missing_recipient():
    try:
        (MessageBuilder(Operation.QUERY)
         .from_agent("alice", "org")
         .with_payload({})
         .build())
        assert False, "Should have raised ValueError"
    except ValueError as e:
        assert "Recipient" in str(e)

test("builder missing recipient (should fail)", test_builder_missing_recipient)

# =============================================================================
# 3. FACTORY/OPERATION CLASSES
# =============================================================================
print("\n" + "="*60)
print("3. FACTORY/OPERATION CLASSES")
print("="*60)

def test_query_class():
    q = Query(domain="weather", intent="forecast", params={"days": 5})
    payload = q.to_payload()
    assert payload["domain"] == "weather"
    assert payload["intent"] == "forecast"
    assert payload["params"]["days"] == 5

test("Query class", test_query_class)

def test_respond_class():
    r = Respond(status="success", data={"result": 42}, schema="json")
    payload = r.to_payload()
    assert payload["status"] == "success"
    assert payload["data"]["result"] == 42
    assert payload["schema"] == "json"

test("Respond class", test_respond_class)

def test_task_class():
    t = Task.create("task-001", "analysis", description="Analyze sales data", params={"target": "Q4"})
    payload = t.to_payload()
    assert payload["action"] == "create"
    assert payload["task_id"] == "task-001"
    assert payload["type"] == "analysis"
    assert payload["description"] == "Analyze sales data"

test("Task class (create)", test_task_class)

def test_task_status():
    t = Task.status("task-001")
    assert t.action == "status"
    assert t.task_id == "task-001"

test("Task class (status)", test_task_status)

def test_task_cancel():
    t = Task.cancel("task-001")
    assert t.action == "cancel"

test("Task class (cancel)", test_task_cancel)

def test_stream_class():
    s = Stream.start("stream-001", "text")
    assert s.action == "start"
    
    chunk = Stream.chunk("stream-001", seq=0, data="chunk data", progress=0.1)
    assert chunk.seq == 0
    assert chunk.data == "chunk data"
    
    end = Stream.end("stream-001", total_chunks=10, checksum="abc123")
    assert end.total_chunks == 10

test("Stream class (start/chunk/end)", test_stream_class)

def test_tool_class():
    t = Tool.invoke("calculator", {"expr": "2+2"}, timeout_ms=5000)
    payload = t.to_payload()
    assert payload["action"] == "invoke"
    assert payload["tool"] == "calculator"
    assert payload["timeout_ms"] == 5000

test("Tool class (invoke)", test_tool_class)

def test_tool_list():
    t = Tool.list_tools()
    assert t.action == "list"

test("Tool class (list)", test_tool_list)

def test_consent_class():
    c = Consent.request(["email", "phone"], "marketing", human="user-123")
    payload = c.to_payload()
    assert payload["action"] == "request"
    assert "email" in payload["data_types"]

test("Consent class (request)", test_consent_class)

def test_consent_grant():
    c = Consent.grant(["email"], "support", consent_token="token-xyz")
    assert c.action == "grant"
    assert c.consent_token == "token-xyz"

test("Consent class (grant)", test_consent_grant)

def test_error_class():
    e = Error.auth_error("Bad credentials")
    payload = e.to_payload()
    assert payload["code"] == "E_AUTH_FAILED"
    assert payload["category"] == "auth"

test("Error class (auth)", test_error_class)

def test_error_rate_limit():
    e = Error.rate_limit_error(5000)
    payload = e.to_payload()
    assert payload["code"] == "E_RATE_LIMIT"
    assert payload["suggestion"]["delay_ms"] == 5000

test("Error class (rate_limit)", test_error_rate_limit)

# =============================================================================
# 4. MESSAGE FIELDS
# =============================================================================
print("\n" + "="*60)
print("4. MESSAGE FIELDS")
print("="*60)

def test_required_fields_present():
    msg = Message(
        operation=Operation.QUERY,
        sender=sender(),
        recipient=recipient(),
        payload={"domain": "test", "intent": "ping"}
    )
    # Auto-generated fields
    assert msg.message_id is not None
    assert msg.timestamp is not None
    assert msg.version == "0.1"
    errors = msg.validate()
    assert len(errors) == 0, f"Validation errors: {errors}"

test("required fields auto-generated", test_required_fields_present)

def test_wire_format():
    msg = Message(
        operation=Operation.QUERY,
        sender=sender(),
        recipient=recipient(),
        payload={"test": 123}
    )
    wire = msg.to_dict()
    # Check compact field names
    assert "v" in wire
    assert "id" in wire
    assert "ts" in wire
    assert "op" in wire
    assert "from" in wire
    assert "to" in wire
    assert "p" in wire
    assert "cls" in wire

test("wire format (compact fields)", test_wire_format)

def test_optional_exp():
    msg = Message(
        operation=Operation.QUERY,
        sender=sender(),
        recipient=recipient(),
        payload={},
        expires=int(time.time() * 1000) + 60000
    )
    wire = msg.to_dict()
    assert "exp" in wire

test("optional field: exp (expires)", test_optional_exp)

def test_optional_ref():
    msg = Message(
        operation=Operation.RESPOND,
        sender=sender(),
        recipient=recipient(),
        payload={"status": "success", "data": {}},
        reply_to="original-msg-id"
    )
    wire = msg.to_dict()
    assert wire.get("re") == "original-msg-id"

test("optional field: ref (reply_to)", test_optional_ref)

def test_optional_cap():
    msg = Message(
        operation=Operation.TASK,
        sender=sender(),
        recipient=recipient(),
        payload={"action": "create", "task_id": "t1"},
        capabilities_required=["execute", "admin"]
    )
    wire = msg.to_dict()
    assert wire.get("cap") == ["execute", "admin"]

test("optional field: cap (capabilities)", test_optional_cap)

def test_optional_ext():
    msg = Message(
        operation=Operation.QUERY,
        sender=sender(),
        recipient=recipient(),
        payload={},
        extensions={"custom": {"key": "value"}}
    )
    wire = msg.to_dict()
    assert wire.get("ext") == {"custom": {"key": "value"}}

test("optional field: ext (extensions)", test_optional_ext)

def test_pii_meta():
    msg = Message(
        operation=Operation.QUERY,
        sender=sender(),
        recipient=recipient(),
        payload={"user_email": "test@example.com"},
        classification="pii",
        pii_meta={
            "types": ["email"],
            "consent": {
                "proof": "consent-token",
                "purpose": "support"
            }
        }
    )
    errors = msg.validate()
    assert len(errors) == 0
    wire = msg.to_dict()
    assert wire["cls"] == "pii"
    assert "pii_meta" in wire

test("pii_meta handling", test_pii_meta)

def test_pii_without_meta_fails():
    msg = Message(
        operation=Operation.QUERY,
        sender=sender(),
        recipient=recipient(),
        payload={},
        classification="pii"
        # No pii_meta!
    )
    errors = msg.validate()
    assert any("pii_meta" in e.lower() for e in errors)

test("pii classification without meta (should fail validation)", test_pii_without_meta_fails)

def test_roundtrip_json():
    original = Message(
        operation=Operation.TASK,
        sender=sender(),
        recipient=recipient(),
        payload={"action": "create", "task_id": "t1"},
        classification="conf",
        reply_to="prev-msg",
        expires=999999999,
        capabilities_required=["cap1"],
        extensions={"ext1": {"data": 123}}
    )
    json_str = original.to_json()
    restored = Message.from_json(json_str)
    
    assert restored.operation == original.operation
    assert restored.sender.agent == original.sender.agent
    assert restored.recipient.org == original.recipient.org
    assert restored.payload == original.payload
    assert restored.classification == original.classification
    assert restored.reply_to == original.reply_to
    assert restored.expires == original.expires
    assert restored.capabilities_required == original.capabilities_required
    assert restored.extensions == original.extensions

test("JSON roundtrip (serialize/deserialize)", test_roundtrip_json)

def test_all_classifications():
    for cls in ["pub", "int", "conf", "sec"]:  # pii requires meta
        msg = Message(
            operation=Operation.QUERY,
            sender=sender(),
            recipient=recipient(),
            payload={},
            classification=cls
        )
        errors = msg.validate()
        assert len(errors) == 0, f"Classification '{cls}' failed: {errors}"

test("all classification levels", test_all_classifications)

# =============================================================================
# SUMMARY
# =============================================================================
print("\n" + "="*60)
print("SUMMARY - PYTHON")
print("="*60)
print(f"Total:  {results['passed'] + results['failed']}")
print(f"Passed: {results['passed']}")
print(f"Failed: {results['failed']}")

if results["failed"] > 0:
    print("\nFailed tests:")
    for t in results["tests"]:
        if t["status"] == "FAIL":
            print(f"  - {t['name']}: {t.get('error', 'Unknown error')}")
    sys.exit(1)
else:
    print("\n🎉 All Python tests passed!")
    sys.exit(0)
