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
    msg = {"v": "0.1", "id": "test", "ts": moltspeak.now(), "op": "query"}
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
    msg = {"v": "0.1", "id": "test", "ts": moltspeak.now(), "op": "query"}
    encoded = moltspeak.encode(msg, pretty=True)
    assert_true("\n" in encoded)
    assert_true("  " in encoded)

test("encode with pretty option formats nicely", test_encode_pretty)

def test_encode_envelope():
    msg = {"v": "0.1", "id": "test", "ts": moltspeak.now(), "op": "query"}
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
    msg = {"v": "0.1", "id": "test", "ts": moltspeak.now(), "op": "query"}
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
    msg = {"v": "0.1", "id": "test", "ts": moltspeak.now(), "op": "query"}
    signed = moltspeak.sign(msg, "mock-private-key")
    assert_true(signed.get("sig"))
    assert_true(signed["sig"].startswith("ed25519:"))

test("sign adds signature to message", test_sign_adds_signature)

def test_sign_no_modify():
    msg = {"v": "0.1", "id": "test", "ts": moltspeak.now(), "op": "query"}
    moltspeak.sign(msg, "mock-private-key")
    assert_false(msg.get("sig"))

test("sign does not modify original message", test_sign_no_modify)

def test_verify_signed():
    msg = {"v": "0.1", "id": "test", "ts": moltspeak.now(), "op": "query"}
    signed = moltspeak.sign(msg, "mock-private-key")
    valid = moltspeak.verify(signed, "mock-public-key")
    assert_true(valid)

test("verify returns true for signed message", test_verify_signed)

def test_verify_unsigned():
    msg = {"v": "0.1", "id": "test", "ts": moltspeak.now(), "op": "query"}
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
# Edge Case Tests
# ============================================================================

# Empty String Handling
print("\n🔲 Empty String Handling")

def test_empty_agent_name():
    msg = (
        moltspeak.create_message("query")
        .from_agent({"agent": ""})
        .to_agent({"agent": "receiver"})
        .payload({"domain": "test"})
        .build(validate=False)
    )
    assert_equal(msg["from"]["agent"], "")

test("empty agent name in from field", test_empty_agent_name)

def test_empty_payload():
    msg = (
        moltspeak.create_message("query")
        .from_agent({"agent": "sender"})
        .to_agent({"agent": "receiver"})
        .payload({})
        .build(validate=False)
    )
    assert_equal(len(msg["p"]), 0)

test("empty payload object", test_empty_payload)

def test_empty_strings_in_payload():
    msg = moltspeak.create_query(
        {"domain": "", "intent": "", "params": {"key": ""}},
        {"agent": "sender"},
        {"agent": "receiver"}
    )
    assert_equal(msg["p"]["domain"], "")
    assert_equal(msg["p"]["intent"], "")

test("empty string in payload values", test_empty_strings_in_payload)

def test_none_handling():
    msg = (
        moltspeak.create_message("query")
        .from_agent({"agent": "sender"})
        .payload({"null_val": None, "obj": {"nested": None}})
        .build(validate=False)
    )
    assert_equal(msg["p"]["null_val"], None)
    assert_equal(msg["p"]["obj"]["nested"], None)

test("None handling in payload", test_none_handling)


# Unicode Handling
print("\n🌍 Unicode Handling")

def test_emoji_in_agent_names():
    # Build message without validation to test validate_message
    msg = (
        moltspeak.create_message("query")
        .from_agent({"agent": "🤖-agent-🦀"})
        .to_agent({"agent": "🎯-target"})
        .payload({"domain": "test"})
        .build(validate=False)
    )
    
    # Emoji agent names should be rejected by validation (security)
    result = moltspeak.validate_message(msg, strict=True)
    assert_false(result.valid, "Emoji agent names should be rejected")
    assert_true(any("agent" in e or "name" in e or "character" in e for e in result.errors))

test("emoji in agent names rejected", test_emoji_in_agent_names)

def test_cjk_characters():
    msg = moltspeak.create_query(
        {"domain": "天気", "intent": "予報", "params": {"location": "東京"}},
        {"agent": "sender"},
        {"agent": "receiver"}
    )
    assert_equal(msg["p"]["domain"], "天気")
    assert_equal(msg["p"]["params"]["location"], "東京")
    
    # Verify byte size is calculated correctly for multi-byte characters
    cjk_text = "天気"
    size = moltspeak.byte_size(cjk_text)
    # Each CJK character is 3 bytes in UTF-8
    assert_true(size == 6)  # 2 chars * 3 bytes each
    
    # Round-trip works
    encoded = moltspeak.encode(msg)
    decoded = moltspeak.decode(encoded)
    assert_equal(decoded["p"]["domain"], "天気")

test("CJK characters in payload", test_cjk_characters)

def test_mixed_unicode():
    msg = (
        moltspeak.create_message("query")
        .from_agent({"agent": "αβγ-agent", "org": "Организация"})
        .to_agent({"agent": "代理人"})
        .payload({
            "content": "日本語 한국어 العربية עברית",
            "emoji": "🎉🚀💡🔥",
            "special": "© ® ™ € £ ¥"
        })
        .build(validate=False)
    )
    
    # Unicode agent names should be rejected by validation (security)
    result = moltspeak.validate_message(msg, strict=True)
    assert_false(result.valid, "Unicode agent names should be rejected")
    assert_true(any("agent" in e or "name" in e for e in result.errors))
    
    # Note: Unicode in payload content is still allowed, just not in agent names

test("mixed Unicode in agent names rejected", test_mixed_unicode)

def test_rtl_text():
    msg = moltspeak.create_query(
        {"domain": "test", "params": {"text": "مرحبا بالعالم"}},
        {"agent": "sender"},
        {"agent": "receiver"}
    )
    assert_equal(msg["p"]["params"]["text"], "مرحبا بالعالم")

test("RTL text handling", test_rtl_text)

def test_zero_width_characters():
    zero_width = "test\u200B\u200C\u200Dvalue"
    msg = moltspeak.create_query(
        {"domain": zero_width},
        {"agent": "sender"},
        {"agent": "receiver"}
    )
    assert_equal(msg["p"]["domain"], zero_width)

test("zero-width characters", test_zero_width_characters)


# Max Size Messages
print("\n📏 Max Size Messages")

def test_near_1mb_boundary():
    # Create a payload just under 1MB
    large_string = "x" * (900 * 1024)  # 900KB of data
    msg = (
        moltspeak.create_message("query")
        .from_agent({"agent": "sender"})
        .payload({"data": large_string})
        .build(validate=False)
    )
    
    encoded = moltspeak.encode(msg)
    size = moltspeak.byte_size(encoded)
    assert_true(size < 1 * 1024 * 1024)  # Should be under 1MB
    assert_true(size > 900 * 1024)  # Should be over 900KB
    
    # Should still be decodable
    decoded = moltspeak.decode(encoded)
    assert_equal(len(decoded["p"]["data"]), 900 * 1024)

test("message near 1MB boundary (under limit)", test_near_1mb_boundary)

def test_large_array_payload():
    large_array = [{"key": "value", "num": 42} for _ in range(10000)]
    msg = (
        moltspeak.create_message("query")
        .from_agent({"agent": "sender"})
        .payload({"items": large_array})
        .build(validate=False)
    )
    
    assert_equal(len(msg["p"]["items"]), 10000)
    
    encoded = moltspeak.encode(msg)
    decoded = moltspeak.decode(encoded)
    assert_equal(len(decoded["p"]["items"]), 10000)

test("large array payload", test_large_array_payload)


# Deeply Nested Payloads
print("\n🪆 Deeply Nested Payloads")

def test_50_levels_of_nesting():
    nested = {"value": "deepest"}
    for i in range(50):
        nested = {"level": i, "child": nested}
    
    msg = (
        moltspeak.create_message("query")
        .from_agent({"agent": "sender"})
        .payload(nested)
        .build(validate=False)
    )
    
    # Traverse to verify structure
    current = msg["p"]
    for i in range(49, -1, -1):
        assert_equal(current["level"], i)
        current = current["child"]
    assert_equal(current["value"], "deepest")
    
    # Round-trip
    encoded = moltspeak.encode(msg)
    decoded = moltspeak.decode(encoded)
    
    current = decoded["p"]
    for i in range(49, -1, -1):
        assert_equal(current["level"], i)
        current = current["child"]
    assert_equal(current["value"], "deepest")

test("50 levels of nesting", test_50_levels_of_nesting)

def test_deeply_nested_arrays():
    nested = [1, 2, 3]
    for i in range(30):
        nested = [nested, i]
    
    msg = (
        moltspeak.create_message("query")
        .from_agent({"agent": "sender"})
        .payload({"arrays": nested})
        .build(validate=False)
    )
    
    encoded = moltspeak.encode(msg)
    decoded = moltspeak.decode(encoded)
    assert_true(isinstance(decoded["p"]["arrays"], list))

test("deeply nested arrays", test_deeply_nested_arrays)

def test_mixed_deep_nesting():
    complex_obj = {
        "a": [{"b": [{"c": [{"d": [{"e": [{"f": "deep"}]}]}]}]}]
    }
    
    msg = (
        moltspeak.create_message("query")
        .from_agent({"agent": "sender"})
        .payload(complex_obj)
        .build(validate=False)
    )
    
    assert_equal(msg["p"]["a"][0]["b"][0]["c"][0]["d"][0]["e"][0]["f"], "deep")

test("mixed deep nesting (objects and arrays)", test_mixed_deep_nesting)


# Timestamp Edge Cases
print("\n⏰ Timestamp Edge Cases")

def test_future_timestamp():
    future_ts = 4102444800000  # Jan 1, 2100
    msg = {
        "v": "0.1",
        "id": moltspeak.generate_uuid(),
        "ts": future_ts,
        "op": "query",
        "from": {"agent": "future-agent"}
    }
    assert_equal(msg["ts"], future_ts)
    # SDK may reject future timestamps in strict validation
    result = moltspeak.validate_message(msg, strict=False)
    # Just verify it doesn't crash and produces a result
    assert_true(isinstance(result.valid, bool))

test("future timestamp (year 2100)", test_future_timestamp)

def test_very_old_timestamp():
    old_ts = 1000  # 1 second after epoch
    msg = {
        "v": "0.1",
        "id": moltspeak.generate_uuid(),
        "ts": old_ts,
        "op": "query",
        "from": {"agent": "old-agent"}
    }
    assert_equal(msg["ts"], old_ts)
    # Old timestamps should be rejected (replay attack prevention)
    result = moltspeak.validate_message(msg, strict=False)
    assert_false(result.valid)  # Invalid - message too old
    assert_true(any("too old" in e for e in result.errors))

test("very old timestamp (year 1970) rejected", test_very_old_timestamp)

def test_zero_timestamp():
    msg = {
        "v": "0.1",
        "id": moltspeak.generate_uuid(),
        "ts": 0,
        "op": "query",
        "from": {"agent": "zero-ts-agent"}
    }
    assert_equal(msg["ts"], 0)

test("zero timestamp", test_zero_timestamp)

def test_negative_timestamp():
    msg = {
        "v": "0.1",
        "id": moltspeak.generate_uuid(),
        "ts": -1000,
        "op": "query",
        "from": {"agent": "negative-ts-agent"}
    }
    assert_equal(msg["ts"], -1000)

test("negative timestamp", test_negative_timestamp)

def test_expiration_in_past():
    msg = (
        moltspeak.create_message("query")
        .from_agent({"agent": "sender"})
        .expires_in(-60000)  # 1 minute ago
        .build(validate=False)
    )
    assert_true(msg["exp"] < moltspeak.now())

test("expiration in the past", test_expiration_in_past)

def test_far_future_expiration():
    msg = (
        moltspeak.create_message("query")
        .from_agent({"agent": "sender"})
        .expires_in(365 * 24 * 60 * 60 * 1000 * 100)  # 100 years
        .build(validate=False)
    )
    assert_true(msg["exp"] > moltspeak.now())

test("very far future expiration", test_far_future_expiration)


# Invalid UUID Formats
print("\n🔑 UUID Format Edge Cases")

def test_non_standard_uuid():
    msg = {
        "v": "0.1",
        "id": "not-a-valid-uuid",
        "ts": moltspeak.now(),
        "op": "query",
        "from": {"agent": "sender"}
    }
    # In non-strict mode, this should be accepted
    result = moltspeak.validate_message(msg, strict=False)
    # Protocol doesn't strictly enforce UUID format
    assert_true(result.valid or any("id" in e for e in result.errors))

test("non-standard UUID format accepted", test_non_standard_uuid)

def test_empty_id():
    msg = {
        "v": "0.1",
        "id": "",
        "ts": moltspeak.now(),
        "op": "query",
        "from": {"agent": "sender"}
    }
    assert_equal(msg["id"], "")

test("empty string as ID", test_empty_id)

def test_very_long_id():
    long_id = "x" * 1000
    msg = {
        "v": "0.1",
        "id": long_id,
        "ts": moltspeak.now(),
        "op": "query",
        "from": {"agent": "sender"}
    }
    assert_equal(len(msg["id"]), 1000)

test("very long ID string", test_very_long_id)

def test_numeric_id():
    msg = {
        "v": "0.1",
        "id": 12345,
        "ts": moltspeak.now(),
        "op": "query",
        "from": {"agent": "sender"}
    }
    assert_equal(msg["id"], 12345)

test("numeric ID value", test_numeric_id)

def test_uppercase_uuid():
    uppercase_uuid = "A1B2C3D4-E5F6-4789-ABCD-EF1234567890"
    msg = {
        "v": "0.1",
        "id": uppercase_uuid,
        "ts": moltspeak.now(),
        "op": "query",
        "from": {"agent": "sender"}
    }
    assert_equal(msg["id"], uppercase_uuid)

test("UUID with uppercase letters", test_uppercase_uuid)


# Malformed JSON Edge Cases
print("\n🔧 Malformed JSON Edge Cases")

def test_trailing_whitespace():
    ts = moltspeak.now()
    json_str = f'{{"v":"0.1","id":"test","ts":{ts},"op":"query"}}   \n\t  '
    decoded = moltspeak.decode(json_str)
    assert_equal(decoded["op"], "query")

test("decode handles trailing whitespace", test_trailing_whitespace)

def test_incomplete_json():
    assert_raises(
        lambda: moltspeak.decode('{"v":"0.1"'),
        "Invalid JSON"
    )

test("decode rejects incomplete JSON", test_incomplete_json)

def test_plain_text():
    assert_raises(
        lambda: moltspeak.decode("hello world"),
        "Invalid JSON"
    )

test("decode rejects plain text", test_plain_text)

def test_json_array_at_root():
    # Arrays will throw validation error since they're not valid messages
    try:
        result = moltspeak.decode("[1, 2, 3]")
        # If it doesn't throw, arrays should decode but not be valid messages
        assert_true(isinstance(result, list) or result is None or result.get("v") is None)
    except Exception as e:
        # Expected - arrays aren't valid message dictionaries
        assert_true("dictionary" in str(e) or "Invalid" in str(e))

test("decode handles JSON array at root", test_json_array_at_root)

def test_escaped_characters():
    ts = moltspeak.now()
    json_str = f'{{"v":"0.1","id":"test","ts":{ts},"op":"query","p":{{"text":"line1\\nline2\\ttab\\"quote\\""}}}}'
    decoded = moltspeak.decode(json_str)
    assert_equal(decoded["p"]["text"], 'line1\nline2\ttab"quote"')

test("decode handles escaped characters", test_escaped_characters)

def test_deep_clone_isolation():
    # deep_clone should prevent modifications from affecting original
    obj = {"a": 1}
    cloned = moltspeak.deep_clone(obj)
    cloned["b"] = 2
    # The original should still work fine
    msg = (
        moltspeak.create_message("query")
        .from_agent({"agent": "sender"})
        .payload(obj)
        .build(validate=False)
    )
    assert_true(msg["p"]["a"] == 1)
    assert_true("b" not in msg["p"])

test("deep_clone creates isolated copy", test_deep_clone_isolation)

def test_special_json_values():
    msg = (
        moltspeak.create_message("query")
        .from_agent({"agent": "sender"})
        .payload({
            "integer": 42,
            "float": 3.14159,
            "scientific": 1.23e10,
            "negative": -999,
            "bool_true": True,
            "bool_false": False,
            "null_val": None,
            "empty_string": "",
            "empty_array": [],
            "empty_object": {}
        })
        .build(validate=False)
    )
    
    encoded = moltspeak.encode(msg)
    decoded = moltspeak.decode(encoded)
    
    assert_equal(decoded["p"]["integer"], 42)
    assert_equal(decoded["p"]["float"], 3.14159)
    assert_equal(decoded["p"]["bool_true"], True)
    assert_equal(decoded["p"]["bool_false"], False)
    assert_equal(decoded["p"]["null_val"], None)
    assert_equal(decoded["p"]["empty_string"], "")
    assert_true(isinstance(decoded["p"]["empty_array"], list))
    assert_equal(len(decoded["p"]["empty_object"]), 0)

test("special JSON values in payload", test_special_json_values)

def test_unicode_escape_sequences():
    ts = moltspeak.now()
    json_str = f'{{"v":"0.1","id":"test","ts":{ts},"op":"query","p":{{"text":"\\u0048\\u0065\\u006c\\u006c\\u006f"}}}}'
    decoded = moltspeak.decode(json_str)
    assert_equal(decoded["p"]["text"], "Hello")

test("unicode escape sequences in JSON", test_unicode_escape_sequences)


# Additional Edge Cases
print("\n🎲 Additional Edge Cases")

def test_pii_in_deeply_nested():
    deep_payload = {
        "level1": {
            "level2": {
                "level3": {
                    "level4": {
                        "email": "hidden@secret.com"
                    }
                }
            }
        }
    }
    result = moltspeak.detect_pii(deep_payload)
    assert_true(result.has_pii)
    assert_true("email" in result.types)

test("PII detection in deeply nested objects", test_pii_in_deeply_nested)

def test_pii_unicode_email():
    result = moltspeak.detect_pii("Contact: user@例え.jp")
    # Just verify it doesn't crash
    assert_true(isinstance(result.has_pii, bool))

test("PII detection with unicode email", test_pii_unicode_email)

def test_multiple_capabilities():
    msg = (
        moltspeak.create_message("task")
        .from_agent({"agent": "sender"})
        .require_capabilities(["cap1", "cap2", "cap3", "cap1"])  # duplicate
        .build(validate=False)
    )
    assert_true("cap1" in msg["cap"])
    assert_true("cap2" in msg["cap"])
    assert_true("cap3" in msg["cap"])

test("multiple capabilities array handling", test_multiple_capabilities)

def test_very_long_agent_name():
    long_name = "agent-" + "x" * 10000
    # Build message without validation to test validate_message
    msg = (
        moltspeak.create_message("query")
        .from_agent({"agent": long_name})
        .to_agent({"agent": "receiver"})
        .payload({"domain": "test"})
        .build(validate=False)
    )
    
    # Agent names > 256 chars should be rejected by validation (security)
    result = moltspeak.validate_message(msg, strict=True)
    assert_false(result.valid, "Agent names > 256 chars should be rejected")
    assert_true(any("agent" in e or "length" in e or "256" in e for e in result.errors))

test("very long agent name rejected", test_very_long_agent_name)

def test_special_chars_in_org():
    msg = moltspeak.create_query(
        {"domain": "test"},
        {"agent": "sender", "org": "org/with:special@chars#and$symbols!"},
        {"agent": "receiver"}
    )
    assert_equal(msg["from"]["org"], "org/with:special@chars#and$symbols!")

test("special characters in agent org", test_special_chars_in_org)


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
