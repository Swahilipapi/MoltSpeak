"""
MoltSpeak SDK Test Suite for Python

Run with: python test_moltspeak.py
"""

import json
import re
import sys
import importlib.util

# Import from moltspeak.py directly (not the package)
spec = importlib.util.spec_from_file_location("moltspeak_standalone", "moltspeak.py")
moltspeak = importlib.util.module_from_spec(spec)
spec.loader.exec_module(moltspeak)


# ============================================================================
# Test Utilities
# ============================================================================

passed = 0
failed = 0
errors = []


def test(name, fn):
    """Run a test case."""
    global passed, failed
    try:
        fn()
        passed += 1
        print(f"  ✓ {name}")
    except Exception as e:
        failed += 1
        errors.append({"name": name, "error": str(e)})
        print(f"  ✗ {name}: {e}")


def assert_equal(actual, expected, message=""):
    """Assert two values are equal."""
    if actual != expected:
        raise AssertionError(f"{message} Expected {expected!r}, got {actual!r}")


def assert_true(value, message=""):
    """Assert value is truthy."""
    if not value:
        raise AssertionError(f"{message} Expected truthy, got {value!r}")


def assert_false(value, message=""):
    """Assert value is falsy."""
    if value:
        raise AssertionError(f"{message} Expected falsy, got {value!r}")


def assert_raises(fn, expected_error=None, message=""):
    """Assert function raises an exception."""
    try:
        fn()
        raise AssertionError(f"{message} Expected function to raise")
    except Exception as e:
        if expected_error and expected_error not in str(e):
            raise AssertionError(
                f"{message} Expected error containing '{expected_error}', got '{e}'"
            )


# ============================================================================
# Test Suites
# ============================================================================

print("\n🧪 MoltSpeak Python SDK Tests\n")
print("─" * 50)

# Test Constants
print("\n📌 Constants")

test("PROTOCOL_VERSION is defined", lambda: assert_equal(
    moltspeak.PROTOCOL_VERSION, "0.1"
))

test("Operations enum is defined", lambda: (
    assert_true(len(moltspeak.Operations) >= 8),
    assert_equal(moltspeak.Operations.QUERY.value, "query")
))

test("Classifications enum is defined", lambda: (
    assert_equal(moltspeak.Classifications.PUBLIC.value, "pub"),
    assert_equal(moltspeak.Classifications.PII.value, "pii")
))

test("ErrorCodes enum is defined", lambda: (
    assert_true(moltspeak.ErrorCodes.E_PARSE),
    assert_true(moltspeak.ErrorCodes.E_CONSENT)
))


# Test Utilities
print("\n🔧 Utilities")

test("generate_uuid returns valid UUID format", lambda: (
    assert_true(re.match(
        r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
        moltspeak.generate_uuid(),
        re.IGNORECASE
    ))
))

def test_unique_uuid():
    uuid1 = moltspeak.generate_uuid()
    uuid2 = moltspeak.generate_uuid()
    assert_true(uuid1 != uuid2)

test("generate_uuid returns unique values", test_unique_uuid)

def test_now():
    ts = moltspeak.now()
    assert_true(ts > 1700000000000)  # After 2023
    assert_true(ts < 2000000000000)  # Before 2033

test("now returns timestamp in milliseconds", test_now)

def test_deep_clone():
    original = {"a": 1, "b": {"c": 2}}
    cloned = moltspeak.deep_clone(original)
    cloned["b"]["c"] = 99
    assert_equal(original["b"]["c"], 2)

test("deep_clone creates independent copy", test_deep_clone)

test("byte_size calculates correctly", lambda: assert_equal(
    moltspeak.byte_size("hello"), 5
))


# Test PII Detection
print("\n🔒 PII Detection")

def test_email_detection():
    result = moltspeak.detect_pii("Contact me at test@example.com")
    assert_true(result.has_pii)
    assert_true("email" in result.types)

test("detect_pii finds email addresses", test_email_detection)

def test_phone_detection():
    result = moltspeak.detect_pii("Call me at 555-123-4567")
    assert_true(result.has_pii)
    assert_true("phone" in result.types)

test("detect_pii finds phone numbers", test_phone_detection)

def test_ssn_detection():
    result = moltspeak.detect_pii("SSN: 123-45-6789")
    assert_true(result.has_pii)
    assert_true("ssn" in result.types)

test("detect_pii finds SSN patterns", test_ssn_detection)

def test_clean_text():
    result = moltspeak.detect_pii("The weather is nice today")
    assert_false(result.has_pii)

test("detect_pii returns false for clean text", test_clean_text)

def test_pii_in_objects():
    result = moltspeak.detect_pii({"email": "user@test.com", "name": "Test"})
    assert_true(result.has_pii)

test("detect_pii works on objects", test_pii_in_objects)

def test_mask_email():
    masked = moltspeak.mask_pii("Contact test@example.com please")
    assert_true("test@example.com" not in masked)
    assert_true("*" in masked)

test("mask_pii masks email addresses", test_mask_email)

def test_mask_preserves_clean():
    text = "Hello world"
    masked = moltspeak.mask_pii(text)
    assert_equal(masked, text)

test("mask_pii preserves non-PII text", test_mask_preserves_clean)


# Test Message Validation
print("\n✅ Message Validation")

def test_valid_message():
    msg = {
        "v": "0.1",
        "id": moltspeak.generate_uuid(),
        "ts": moltspeak.now(),
        "op": "query",
        "from": {"agent": "test-agent"},
        "cls": "int",
        "p": {"domain": "test"}
    }
    result = moltspeak.validate_message(msg)
    assert_true(result.valid)
    assert_equal(len(result.errors), 0)

test("validate_message accepts valid message", test_valid_message)

def test_missing_fields():
    msg = {"v": "0.1"}  # Missing id, ts, op
    result = moltspeak.validate_message(msg, strict=True)
    assert_false(result.valid)
    assert_true(len(result.errors) > 0)

test("validate_message rejects missing required fields", test_missing_fields)

def test_invalid_classification():
    msg = {
        "v": "0.1",
        "id": moltspeak.generate_uuid(),
        "ts": moltspeak.now(),
        "op": "query",
        "cls": "invalid-cls"
    }
    result = moltspeak.validate_message(msg, strict=False)
    assert_false(result.valid)
    assert_true(any("classification" in e for e in result.errors))

test("validate_message rejects invalid classification", test_invalid_classification)

def test_pii_without_consent():
    msg = {
        "v": "0.1",
        "id": moltspeak.generate_uuid(),
        "ts": moltspeak.now(),
        "op": "query",
        "from": {"agent": "test"},
        "cls": "int",
        "p": {"email": "secret@email.com"}
    }
    result = moltspeak.validate_message(msg, check_pii=True)
    assert_false(result.valid)
    assert_true(any("PII" in e for e in result.errors))

test("validate_message detects PII without consent", test_pii_without_consent)

def test_pii_with_classification():
    msg = {
        "v": "0.1",
        "id": moltspeak.generate_uuid(),
        "ts": moltspeak.now(),
        "op": "query",
        "from": {"agent": "test"},
        "cls": "pii",
        "p": {"email": "user@email.com"}
    }
    result = moltspeak.validate_message(msg)
    assert_true(result.valid)

test("validate_message allows PII with proper classification", test_pii_with_classification)


# Test Message Building
print("\n🏗️ Message Building")

def test_builder_creates_valid():
    msg = (
        moltspeak.create_message("query")
        .from_agent({"agent": "sender"})
        .to_agent({"agent": "receiver"})
        .payload({"domain": "test", "intent": "demo"})
        .build()
    )
    assert_equal(msg["op"], "query")
    assert_equal(msg["from"]["agent"], "sender")
    assert_equal(msg["to"]["agent"], "receiver")
    assert_true(msg["id"])
    assert_true(msg["ts"])

test("MessageBuilder creates valid message", test_builder_creates_valid)

def test_builder_chaining():
    msg = (
        moltspeak.create_message("task")
        .from_agent({"agent": "a"})
        .to_agent({"agent": "b"})
        .payload({"description": "Test task"})
        .classification("conf")
        .reply_to("original-id")
        .expires_in(60000)
        .require_capabilities(["task.create"])
        .build(validate=False)
    )
    assert_equal(msg["cls"], "conf")
    assert_equal(msg["re"], "original-id")
    assert_true(msg["exp"] > moltspeak.now())
    assert_true("task.create" in msg["cap"])

test("MessageBuilder supports chaining", test_builder_chaining)


# Test Factory Functions
print("\n🏭 Factory Functions")

def test_create_hello():
    hello = moltspeak.create_hello(
        {"agent": "test-agent", "org": "test-org"},
        {"operations": ["query", "respond", "task"]}
    )
    assert_equal(hello["op"], "hello")
    assert_true("query" in hello["p"]["capabilities"])
    assert_true("0.1" in hello["p"]["protocol_versions"])

test("create_hello creates valid hello message", test_create_hello)

def test_create_query():
    query = moltspeak.create_query(
        {"domain": "weather", "intent": "forecast", "params": {"loc": "Tokyo"}},
        {"agent": "sender"},
        {"agent": "receiver"}
    )
    assert_equal(query["op"], "query")
    assert_equal(query["p"]["domain"], "weather")
    assert_equal(query["p"]["params"]["loc"], "Tokyo")

test("create_query creates valid query message", test_create_query)

def test_create_response():
    response = moltspeak.create_response(
        "original-query-id",
        {"temperature": 22, "unit": "C"},
        {"agent": "responder"},
        {"agent": "requester"}
    )
    assert_equal(response["op"], "respond")
    assert_equal(response["re"], "original-query-id")
    assert_equal(response["p"]["status"], "success")

test("create_response creates valid response message", test_create_response)

def test_create_task():
    task = moltspeak.create_task(
        {"description": "Search for papers", "type": "research", "priority": "high"},
        {"agent": "delegator"},
        {"agent": "worker"}
    )
    assert_equal(task["op"], "task")
    assert_equal(task["p"]["type"], "research")
    assert_equal(task["p"]["priority"], "high")
    assert_true(task["p"]["task_id"].startswith("task-"))

test("create_task creates valid task message", test_create_task)

def test_create_error():
    error = moltspeak.create_error(
        "failed-msg-id",
        {"code": "E_INVALID_PARAM", "message": "Missing location", "recoverable": True},
        {"agent": "service"},
        {"agent": "client"}
    )
    assert_equal(error["op"], "error")
    assert_equal(error["p"]["code"], "E_INVALID_PARAM")
    assert_true(error["p"]["recoverable"])

test("create_error creates valid error message", test_create_error)


# Test Envelope Functions
print("\n📦 Envelope Functions")

def test_wrap_envelope():
    msg = moltspeak.create_query(
        {"domain": "test"},
        {"agent": "a"},
        {"agent": "b"}
    )
    envelope = moltspeak.wrap_in_envelope(msg)
    assert_equal(envelope["moltspeak"], "0.1")
    assert_equal(envelope["envelope"]["encrypted"], False)
    assert_true(envelope["message"])
    assert_equal(envelope["message"]["op"], "query")

test("wrap_in_envelope wraps message correctly", test_wrap_envelope)

def test_unwrap_envelope():
    msg = {"v": "0.1", "id": "test", "ts": 123, "op": "query"}
    envelope = moltspeak.wrap_in_envelope(msg)
    unwrapped = moltspeak.unwrap_envelope(envelope)
    assert_equal(unwrapped["op"], "query")

test("unwrap_envelope extracts message", test_unwrap_envelope)

def test_unwrap_encrypted_throws():
    envelope = {
        "moltspeak": "0.1",
        "envelope": {"encrypted": True, "algorithm": "x25519-xsalsa20-poly1305"},
        "ciphertext": "encrypted-data"
    }
    assert_raises(
        lambda: moltspeak.unwrap_envelope(envelope),
        "decrypt"
    )

test("unwrap_envelope throws on encrypted envelope", test_unwrap_encrypted_throws)


# Test Encoding/Decoding
print("\n🔄 Encoding/Decoding")

def test_encode_produces_json():
    msg = moltspeak.create_query({"domain": "test"}, {"agent": "a"}, {"agent": "b"})
    encoded = moltspeak.encode(msg)
    assert_true(isinstance(encoded, str))
    parsed = json.loads(encoded)
    assert_equal(parsed["op"], "query")

test("encode produces valid JSON", test_encode_produces_json)

def test_encode_pretty():
    msg = {"v": "0.1", "id": "test", "ts": 123, "op": "query"}
    encoded = moltspeak.encode(msg, pretty=True)
    assert_true("\n" in encoded)
    assert_true("  " in encoded)

test("encode with pretty option formats nicely", test_encode_pretty)

def test_encode_envelope():
    msg = {"v": "0.1", "id": "test", "ts": 123, "op": "query"}
    encoded = moltspeak.encode(msg, envelope=True)
    parsed = json.loads(encoded)
    assert_true(parsed.get("moltspeak"))
    assert_true(parsed.get("envelope"))
    assert_true(parsed.get("message"))

test("encode with envelope option wraps message", test_encode_envelope)

def test_decode_parses():
    original = moltspeak.create_query({"domain": "test"}, {"agent": "a"}, {"agent": "b"})
    encoded = moltspeak.encode(original)
    decoded = moltspeak.decode(encoded)
    assert_equal(decoded["op"], "query")
    assert_equal(decoded["p"]["domain"], "test")

test("decode parses valid JSON message", test_decode_parses)

def test_decode_unwraps():
    msg = {"v": "0.1", "id": "test", "ts": 123, "op": "query"}
    encoded = moltspeak.encode(msg, envelope=True)
    decoded = moltspeak.decode(encoded)
    assert_equal(decoded["op"], "query")
    assert_false(decoded.get("moltspeak"))

test("decode unwraps envelope by default", test_decode_unwraps)

def test_decode_invalid_json():
    assert_raises(
        lambda: moltspeak.decode("not json"),
        "Invalid JSON"
    )

test("decode throws on invalid JSON", test_decode_invalid_json)


# Test Signing
print("\n🔐 Signing")

def test_sign_adds_signature():
    msg = {"v": "0.1", "id": "test", "ts": 123, "op": "query"}
    signed = moltspeak.sign(msg, "mock-private-key")
    assert_true(signed.get("sig"))
    assert_true(signed["sig"].startswith("ed25519:"))

test("sign adds signature to message", test_sign_adds_signature)

def test_sign_no_modify():
    msg = {"v": "0.1", "id": "test", "ts": 123, "op": "query"}
    moltspeak.sign(msg, "mock-private-key")
    assert_false(msg.get("sig"))

test("sign does not modify original message", test_sign_no_modify)

def test_verify_signed():
    msg = {"v": "0.1", "id": "test", "ts": 123, "op": "query"}
    signed = moltspeak.sign(msg, "mock-private-key")
    valid = moltspeak.verify(signed, "mock-public-key")
    assert_true(valid)

test("verify returns true for signed message", test_verify_signed)

def test_verify_unsigned():
    msg = {"v": "0.1", "id": "test", "ts": 123, "op": "query"}
    valid = moltspeak.verify(msg, "mock-public-key")
    assert_false(valid)

test("verify returns false for unsigned message", test_verify_unsigned)


# Test Natural Language
print("\n💬 Natural Language")

def test_parse_query_pattern():
    msg = moltspeak.parse_natural_language("query weather in Tokyo", {"agent": "user"})
    assert_equal(msg["op"], "query")
    assert_true("weather" in msg["p"]["params"]["query"])

test("parse_natural_language handles query patterns", test_parse_query_pattern)

def test_parse_task_pattern():
    msg = moltspeak.parse_natural_language("do research on AI safety", {"agent": "user"})
    assert_equal(msg["op"], "task")
    assert_true("research" in msg["p"]["description"])

test("parse_natural_language handles task patterns", test_parse_task_pattern)

def test_to_nl_query():
    msg = {
        "op": "query",
        "from": {"agent": "alice"},
        "to": {"agent": "bob"},
        "p": {"domain": "weather", "intent": "forecast"}
    }
    description = moltspeak.to_natural_language(msg)
    assert_true("alice" in description)
    assert_true("bob" in description)
    assert_true("weather" in description)

test("to_natural_language describes query message", test_to_nl_query)

def test_to_nl_task():
    msg = {
        "op": "task",
        "from": {"agent": "manager"},
        "to": {"agent": "worker"},
        "p": {"description": "Complete the report", "priority": "high"}
    }
    description = moltspeak.to_natural_language(msg)
    assert_true("manager" in description)
    assert_true("Complete the report" in description)
    assert_true("high" in description)

test("to_natural_language describes task message", test_to_nl_task)


# Integration Tests
print("\n🔗 Integration Tests")

def test_full_roundtrip():
    # Create → Sign → Encode → Decode → Verify
    original = moltspeak.create_query(
        {"domain": "weather", "intent": "forecast", "params": {"location": "London"}},
        {"agent": "client-agent", "org": "acme"},
        {"agent": "weather-agent", "org": "weather-service"}
    )
    signed = moltspeak.sign(original, "private-key")
    encoded = moltspeak.encode(signed, envelope=True)
    decoded = moltspeak.decode(encoded)
    verified = moltspeak.verify(decoded, "public-key")
    
    assert_equal(decoded["op"], "query")
    assert_equal(decoded["p"]["domain"], "weather")
    assert_true(verified)

test("full message round-trip", test_full_roundtrip)

def test_query_response_exchange():
    alice = {"agent": "alice-agent", "org": "company-a"}
    bob = {"agent": "bob-agent", "org": "company-b"}
    
    # Alice sends query
    query = moltspeak.create_query(
        {"domain": "inventory", "intent": "stock-check", "params": {"sku": "ABC123"}},
        alice,
        bob
    )
    
    # Bob responds
    response = moltspeak.create_response(
        query["id"],
        {"sku": "ABC123", "quantity": 42, "warehouse": "WH-EAST"},
        bob,
        alice
    )
    
    assert_equal(response["re"], query["id"])
    assert_equal(response["p"]["data"]["quantity"], 42)

test("query-response exchange", test_query_response_exchange)

def test_error_handling_flow():
    client = {"agent": "client"}
    server = {"agent": "server"}
    
    # Client sends query
    bad_query = moltspeak.create_query(
        {"domain": "api"},
        client,
        server
    )
    
    # Server responds with error
    error_response = moltspeak.create_error(
        bad_query["id"],
        {
            "code": "E_MISSING_FIELD",
            "message": "Required parameter 'params' is missing",
            "field": "p.params",
            "recoverable": True,
            "suggestion": {"action": "retry", "fix": "Add params object"}
        },
        server,
        client
    )
    
    assert_equal(error_response["re"], bad_query["id"])
    assert_equal(error_response["p"]["code"], "E_MISSING_FIELD")
    assert_true(error_response["p"]["recoverable"])

test("error handling flow", test_error_handling_flow)


# ============================================================================
# Summary
# ============================================================================

print("\n" + "─" * 50)
print(f"\n📊 Results: {passed} passed, {failed} failed")

if failed > 0:
    print("\n❌ Failed tests:")
    for e in errors:
        print(f"   • {e['name']}: {e['error']}")
    sys.exit(1)
else:
    print("\n✅ All tests passed!")
    sys.exit(0)
