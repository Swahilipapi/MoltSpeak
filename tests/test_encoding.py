#!/usr/bin/env python3
"""
MoltSpeak Encoding/Decoding Test Suite
Tests JSON encoding, decoding, envelopes, error handling, and byte size calculations.
"""

import json
import sys
import os
import subprocess
import tempfile

# Add SDK to path (use standalone moltspeak.py)
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'sdk', 'python'))

# Import from standalone file which has encode/decode functions
import importlib.util
spec = importlib.util.spec_from_file_location("moltspeak_standalone", 
    os.path.join(os.path.dirname(__file__), '..', 'sdk', 'python', 'moltspeak.py'))
moltspeak_standalone = importlib.util.module_from_spec(spec)
spec.loader.exec_module(moltspeak_standalone)

encode = moltspeak_standalone.encode
decode = moltspeak_standalone.decode
byte_size = moltspeak_standalone.byte_size
wrap_in_envelope = moltspeak_standalone.wrap_in_envelope
unwrap_envelope = moltspeak_standalone.unwrap_envelope
validate_message = moltspeak_standalone.validate_message
PROTOCOL_VERSION = moltspeak_standalone.PROTOCOL_VERSION

# Test data
SAMPLE_MESSAGE = {
    "v": "0.1",
    "id": "test-msg-001",
    "ts": 1706700000000,
    "op": "query",
    "from": {"agent": "alice", "org": "acme"},
    "to": {"agent": "bob", "org": "acme"},
    "p": {"domain": "weather", "intent": "get_forecast", "params": {"location": "NYC"}},
    "cls": "int"
}

# ============================================================================
# Color output helpers
# ============================================================================
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
RESET = "\033[0m"

def print_pass(msg):
    print(f"  {GREEN}✓{RESET} {msg}")

def print_fail(msg):
    print(f"  {RED}✗{RESET} {msg}")
    
def print_section(title):
    print(f"\n{YELLOW}{'='*60}{RESET}")
    print(f"{YELLOW}{title}{RESET}")
    print(f"{YELLOW}{'='*60}{RESET}")

# ============================================================================
# Test counters
# ============================================================================
passed = 0
failed = 0

def test(condition, description):
    global passed, failed
    if condition:
        print_pass(description)
        passed += 1
    else:
        print_fail(description)
        failed += 1
    return condition

# ============================================================================
# 1. JSON Encoding Tests
# ============================================================================
print_section("1. JSON ENCODING TESTS")

# Test encode() produces valid JSON
encoded = encode(SAMPLE_MESSAGE)
test(isinstance(encoded, str), "encode() returns string")

try:
    parsed = json.loads(encoded)
    test(True, "encode() produces valid JSON")
except json.JSONDecodeError:
    test(False, "encode() produces valid JSON")

# Test compact encoding (no whitespace between elements)
compact = encode(SAMPLE_MESSAGE, pretty=False)
test('\n' not in compact, "Compact encoding has no newlines")
test('  ' not in compact, "Compact encoding has no indentation")

# Test pretty printing
pretty = encode(SAMPLE_MESSAGE, pretty=True)
test('\n' in pretty, "Pretty printing has newlines")
test('  ' in pretty, "Pretty printing has indentation")

# Verify pretty and compact decode to same thing
compact_parsed = json.loads(compact)
pretty_parsed = json.loads(pretty)
test(compact_parsed == pretty_parsed, "Pretty and compact decode to same value")

# ============================================================================
# 2. JSON Decoding Tests
# ============================================================================
print_section("2. JSON DECODING TESTS")

# Test decode() parses JSON correctly
decoded = decode(encoded, validate=False)
test(decoded["id"] == SAMPLE_MESSAGE["id"], "decode() parses JSON correctly")
test(decoded["op"] == SAMPLE_MESSAGE["op"], "decode() preserves operation field")

# Test whitespace handling
json_with_whitespace = '''
{
    "v": "0.1",
    "id": "ws-test",
    "ts": 1706700000000,
    "op": "query",
    "from": {"agent": "alice", "org": "acme"},
    "to": {"agent": "bob", "org": "acme"},
    "p": {},
    "cls": "int"
}
'''
decoded_ws = decode(json_with_whitespace, validate=False)
test(decoded_ws["id"] == "ws-test", "Handles leading/trailing whitespace")

# Test escaped characters
msg_with_escapes = {
    "v": "0.1",
    "id": "escape-test",
    "ts": 1706700000000,
    "op": "query",
    "from": {"agent": "alice", "org": "acme"},
    "to": {"agent": "bob", "org": "acme"},
    "p": {"text": "Line1\nLine2\tTabbed\"Quoted\"\\Backslash"},
    "cls": "int"
}
encoded_escapes = encode(msg_with_escapes)
decoded_escapes = decode(encoded_escapes, validate=False)
test(decoded_escapes["p"]["text"] == "Line1\nLine2\tTabbed\"Quoted\"\\Backslash", 
     "Handles escaped characters (newline, tab, quote, backslash)")

# Test Unicode handling
msg_with_unicode = {
    "v": "0.1",
    "id": "unicode-test",
    "ts": 1706700000000,
    "op": "query",
    "from": {"agent": "alice", "org": "acme"},
    "to": {"agent": "bob", "org": "acme"},
    "p": {"greeting": "Привет мир 你好世界 مرحبا بالعالم"},
    "cls": "int"
}
encoded_unicode = encode(msg_with_unicode)
decoded_unicode = decode(encoded_unicode, validate=False)
test(decoded_unicode["p"]["greeting"] == "Привет мир 你好世界 مرحبا بالعالم",
     "Handles Unicode (Cyrillic, Chinese, Arabic)")

# ============================================================================
# 3. Envelope Tests
# ============================================================================
print_section("3. ENVELOPE TESTS")

# Test encode with envelope=True
encoded_with_envelope = encode(SAMPLE_MESSAGE, envelope=True)
parsed_envelope = json.loads(encoded_with_envelope)
test("moltspeak" in parsed_envelope, "encode(envelope=True) adds moltspeak field")
test("envelope" in parsed_envelope, "encode(envelope=True) adds envelope metadata")
test("message" in parsed_envelope, "encode(envelope=True) wraps message")
test(parsed_envelope["moltspeak"] == PROTOCOL_VERSION, "Envelope has correct protocol version")

# Test decode() auto-unwraps envelope
decoded_from_envelope = decode(encoded_with_envelope, validate=False)
test(decoded_from_envelope["id"] == SAMPLE_MESSAGE["id"], "decode() auto-unwraps envelope")
test("moltspeak" not in decoded_from_envelope, "Unwrapped message doesn't contain envelope fields")

# Test decode with should_unwrap=False
not_unwrapped = decode(encoded_with_envelope, validate=False, should_unwrap=False)
test("moltspeak" in not_unwrapped, "decode(should_unwrap=False) keeps envelope")

# Test wrap_in_envelope directly
wrapped = wrap_in_envelope(SAMPLE_MESSAGE)
test(wrapped["envelope"]["encrypted"] == False, "Envelope marks as not encrypted")
test(wrapped["envelope"]["encoding"] == "utf-8", "Envelope specifies UTF-8 encoding")

# Test unwrap_envelope directly
unwrapped = unwrap_envelope(wrapped)
test(unwrapped["id"] == SAMPLE_MESSAGE["id"], "unwrap_envelope() extracts message correctly")

# ============================================================================
# 4. Error Handling Tests
# ============================================================================
print_section("4. ERROR HANDLING TESTS")

# Test invalid JSON
try:
    decode("this is not json", validate=False)
    test(False, "Invalid JSON raises error")
except ValueError as e:
    test("Invalid JSON" in str(e), "Invalid JSON raises proper ValueError")

# Test empty string
try:
    decode("", validate=False)
    test(False, "Empty string raises error")
except ValueError as e:
    test("Invalid JSON" in str(e), "Empty string raises proper ValueError")

# Test non-object JSON (array)
try:
    decode("[1, 2, 3]", validate=True)
    test(False, "Non-object JSON should fail validation")
except (ValueError, KeyError) as e:
    test(True, "Non-object JSON (array) fails validation")

# Test non-object JSON (string)
try:
    decode('"just a string"', validate=True)
    test(False, "String JSON should fail validation")
except (ValueError, TypeError, AttributeError) as e:
    test(True, "Non-object JSON (string) fails validation")

# Test non-object JSON (number)
try:
    decode("42", validate=True)
    test(False, "Number JSON should fail validation")  
except (ValueError, TypeError, AttributeError) as e:
    test(True, "Non-object JSON (number) fails validation")

# Test null JSON
try:
    decode("null", validate=True)
    test(False, "null JSON should fail validation")
except (ValueError, TypeError, AttributeError) as e:
    test(True, "null JSON fails validation")

# ============================================================================
# 5. Size Calculation Tests
# ============================================================================
print_section("5. SIZE CALCULATION TESTS")

# Test ASCII
ascii_text = "Hello, World!"
ascii_size = byte_size(ascii_text)
test(ascii_size == 13, f"byte_size() accurate for ASCII: expected 13, got {ascii_size}")

# Test Unicode (multi-byte)
unicode_text = "Привет"  # Russian "Hello" - 12 bytes in UTF-8 (6 chars × 2 bytes)
unicode_size = byte_size(unicode_text)
test(unicode_size == 12, f"byte_size() accurate for Unicode: expected 12, got {unicode_size}")

# Test Chinese characters (3 bytes each in UTF-8)
chinese_text = "你好"  # 6 bytes (2 chars × 3 bytes)
chinese_size = byte_size(chinese_text)
test(chinese_size == 6, f"byte_size() accurate for Chinese: expected 6, got {chinese_size}")

# Test emoji (4 bytes each in UTF-8)
emoji_text = "🔥🚀"  # 8 bytes (2 emoji × 4 bytes)
emoji_size = byte_size(emoji_text)
test(emoji_size == 8, f"byte_size() accurate for emoji: expected 8, got {emoji_size}")

# Test mixed content
mixed_text = "Hi 你好 🎉"  # H(1) + i(1) + space(1) + 你(3) + 好(3) + space(1) + 🎉(4) = 14
mixed_size = byte_size(mixed_text)
test(mixed_size == 14, f"byte_size() accurate for mixed: expected 14, got {mixed_size}")

# Verify against actual encoding
test(len(ascii_text.encode('utf-8')) == ascii_size, "ASCII byte_size matches Python encode")
test(len(emoji_text.encode('utf-8')) == emoji_size, "Emoji byte_size matches Python encode")

# ============================================================================
# Summary
# ============================================================================
print_section("PYTHON SDK TEST SUMMARY")
print(f"Passed: {GREEN}{passed}{RESET}")
print(f"Failed: {RED}{failed}{RESET}")
print()

if failed > 0:
    sys.exit(1)
