#!/usr/bin/env node
/**
 * MoltSpeak Encoding/Decoding Test Suite (JavaScript)
 * Tests JSON encoding, decoding, envelopes, error handling, and byte size calculations.
 */

const sdk = require('../sdk/js/moltspeak.js');
const { encode, decode, byteSize, wrapInEnvelope, unwrapEnvelope, validateMessage, PROTOCOL_VERSION } = sdk;

// Test data
const SAMPLE_MESSAGE = {
  v: "0.1",
  id: "test-msg-001",
  ts: 1706700000000,
  op: "query",
  from: { agent: "alice", org: "acme" },
  to: { agent: "bob", org: "acme" },
  p: { domain: "weather", intent: "get_forecast", params: { location: "NYC" } },
  cls: "int"
};

// ============================================================================
// Color output helpers
// ============================================================================
const GREEN = "\x1b[92m";
const RED = "\x1b[91m";
const YELLOW = "\x1b[93m";
const RESET = "\x1b[0m";

function printPass(msg) {
  console.log(`  ${GREEN}✓${RESET} ${msg}`);
}

function printFail(msg) {
  console.log(`  ${RED}✗${RESET} ${msg}`);
}

function printSection(title) {
  console.log(`\n${YELLOW}${'='.repeat(60)}${RESET}`);
  console.log(`${YELLOW}${title}${RESET}`);
  console.log(`${YELLOW}${'='.repeat(60)}${RESET}`);
}

// ============================================================================
// Test counters
// ============================================================================
let passed = 0;
let failed = 0;

function test(condition, description) {
  if (condition) {
    printPass(description);
    passed++;
  } else {
    printFail(description);
    failed++;
  }
  return condition;
}

// ============================================================================
// 1. JSON Encoding Tests
// ============================================================================
printSection("1. JSON ENCODING TESTS");

// Test encode() produces valid JSON
const encoded = encode(SAMPLE_MESSAGE);
test(typeof encoded === 'string', "encode() returns string");

try {
  const parsed = JSON.parse(encoded);
  test(true, "encode() produces valid JSON");
} catch (e) {
  test(false, "encode() produces valid JSON");
}

// Test compact encoding (no whitespace between elements)
const compact = encode(SAMPLE_MESSAGE, { pretty: false });
test(!compact.includes('\n'), "Compact encoding has no newlines");
test(!compact.includes('  '), "Compact encoding has no indentation");

// Test pretty printing
const pretty = encode(SAMPLE_MESSAGE, { pretty: true });
test(pretty.includes('\n'), "Pretty printing has newlines");
test(pretty.includes('  '), "Pretty printing has indentation");

// Verify pretty and compact decode to same thing
const compactParsed = JSON.parse(compact);
const prettyParsed = JSON.parse(pretty);
test(JSON.stringify(compactParsed) === JSON.stringify(prettyParsed), 
     "Pretty and compact decode to same value");

// ============================================================================
// 2. JSON Decoding Tests
// ============================================================================
printSection("2. JSON DECODING TESTS");

// Test decode() parses JSON correctly
const decoded = decode(encoded, { validate: false });
test(decoded.id === SAMPLE_MESSAGE.id, "decode() parses JSON correctly");
test(decoded.op === SAMPLE_MESSAGE.op, "decode() preserves operation field");

// Test whitespace handling
const jsonWithWhitespace = `
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
`;
const decodedWs = decode(jsonWithWhitespace, { validate: false });
test(decodedWs.id === "ws-test", "Handles leading/trailing whitespace");

// Test escaped characters
const msgWithEscapes = {
  v: "0.1",
  id: "escape-test",
  ts: 1706700000000,
  op: "query",
  from: { agent: "alice", org: "acme" },
  to: { agent: "bob", org: "acme" },
  p: { text: "Line1\nLine2\tTabbed\"Quoted\"\\Backslash" },
  cls: "int"
};
const encodedEscapes = encode(msgWithEscapes);
const decodedEscapes = decode(encodedEscapes, { validate: false });
test(decodedEscapes.p.text === "Line1\nLine2\tTabbed\"Quoted\"\\Backslash",
     "Handles escaped characters (newline, tab, quote, backslash)");

// Test Unicode handling
const msgWithUnicode = {
  v: "0.1",
  id: "unicode-test",
  ts: 1706700000000,
  op: "query",
  from: { agent: "alice", org: "acme" },
  to: { agent: "bob", org: "acme" },
  p: { greeting: "Привет мир 你好世界 مرحبا بالعالم" },
  cls: "int"
};
const encodedUnicode = encode(msgWithUnicode);
const decodedUnicode = decode(encodedUnicode, { validate: false });
test(decodedUnicode.p.greeting === "Привет мир 你好世界 مرحبا بالعالم",
     "Handles Unicode (Cyrillic, Chinese, Arabic)");

// ============================================================================
// 3. Envelope Tests
// ============================================================================
printSection("3. ENVELOPE TESTS");

// Test encode with envelope=true
const encodedWithEnvelope = encode(SAMPLE_MESSAGE, { envelope: true });
const parsedEnvelope = JSON.parse(encodedWithEnvelope);
test("moltspeak" in parsedEnvelope, "encode({envelope:true}) adds moltspeak field");
test("envelope" in parsedEnvelope, "encode({envelope:true}) adds envelope metadata");
test("message" in parsedEnvelope, "encode({envelope:true}) wraps message");
test(parsedEnvelope.moltspeak === PROTOCOL_VERSION, "Envelope has correct protocol version");

// Test decode() auto-unwraps envelope
const decodedFromEnvelope = decode(encodedWithEnvelope, { validate: false });
test(decodedFromEnvelope.id === SAMPLE_MESSAGE.id, "decode() auto-unwraps envelope");
test(!("moltspeak" in decodedFromEnvelope), "Unwrapped message doesn't contain envelope fields");

// Test decode with unwrapEnvelope=false
const notUnwrapped = decode(encodedWithEnvelope, { validate: false, unwrapEnvelope: false });
test("moltspeak" in notUnwrapped, "decode({unwrapEnvelope:false}) keeps envelope");

// Test wrapInEnvelope directly
const wrapped = wrapInEnvelope(SAMPLE_MESSAGE);
test(wrapped.envelope.encrypted === false, "Envelope marks as not encrypted");
test(wrapped.envelope.encoding === "utf-8", "Envelope specifies UTF-8 encoding");

// Test unwrapEnvelope directly
const unwrapped = unwrapEnvelope(wrapped);
test(unwrapped.id === SAMPLE_MESSAGE.id, "unwrapEnvelope() extracts message correctly");

// ============================================================================
// 4. Error Handling Tests
// ============================================================================
printSection("4. ERROR HANDLING TESTS");

// Test invalid JSON
try {
  decode("this is not json", { validate: false });
  test(false, "Invalid JSON raises error");
} catch (e) {
  test(e.message.includes("Invalid JSON"), "Invalid JSON raises proper Error");
}

// Test empty string
try {
  decode("", { validate: false });
  test(false, "Empty string raises error");
} catch (e) {
  test(e.message.includes("Invalid JSON"), "Empty string raises proper Error");
}

// Test non-object JSON (array)
try {
  decode("[1, 2, 3]", { validate: true });
  test(false, "Non-object JSON should fail validation");
} catch (e) {
  test(true, "Non-object JSON (array) fails validation");
}

// Test non-object JSON (string)
try {
  decode('"just a string"', { validate: true });
  test(false, "String JSON should fail validation");
} catch (e) {
  test(true, "Non-object JSON (string) fails validation");
}

// Test non-object JSON (number)
try {
  decode("42", { validate: true });
  test(false, "Number JSON should fail validation");
} catch (e) {
  test(true, "Non-object JSON (number) fails validation");
}

// Test null JSON
try {
  decode("null", { validate: true });
  test(false, "null JSON should fail validation");
} catch (e) {
  test(true, "null JSON fails validation");
}

// ============================================================================
// 5. Size Calculation Tests
// ============================================================================
printSection("5. SIZE CALCULATION TESTS");

// Test ASCII
const asciiText = "Hello, World!";
const asciiSize = byteSize(asciiText);
test(asciiSize === 13, `byteSize() accurate for ASCII: expected 13, got ${asciiSize}`);

// Test Unicode (multi-byte) - Cyrillic
const unicodeText = "Привет";  // Russian "Hello" - 12 bytes in UTF-8 (6 chars × 2 bytes)
const unicodeSize = byteSize(unicodeText);
test(unicodeSize === 12, `byteSize() accurate for Unicode: expected 12, got ${unicodeSize}`);

// Test Chinese characters (3 bytes each in UTF-8)
const chineseText = "你好";  // 6 bytes (2 chars × 3 bytes)
const chineseSize = byteSize(chineseText);
test(chineseSize === 6, `byteSize() accurate for Chinese: expected 6, got ${chineseSize}`);

// Test emoji (4 bytes each in UTF-8)
const emojiText = "🔥🚀";  // 8 bytes (2 emoji × 4 bytes)
const emojiSize = byteSize(emojiText);
test(emojiSize === 8, `byteSize() accurate for emoji: expected 8, got ${emojiSize}`);

// Test mixed content
const mixedText = "Hi 你好 🎉";  // H(1) + i(1) + space(1) + 你(3) + 好(3) + space(1) + 🎉(4) = 14
const mixedSize = byteSize(mixedText);
test(mixedSize === 14, `byteSize() accurate for mixed: expected 14, got ${mixedSize}`);

// Verify against Buffer
test(Buffer.byteLength(asciiText, 'utf8') === asciiSize, "ASCII byteSize matches Buffer.byteLength");
test(Buffer.byteLength(emojiText, 'utf8') === emojiSize, "Emoji byteSize matches Buffer.byteLength");

// ============================================================================
// Summary
// ============================================================================
printSection("JAVASCRIPT SDK TEST SUMMARY");
console.log(`Passed: ${GREEN}${passed}${RESET}`);
console.log(`Failed: ${RED}${failed}${RESET}`);
console.log();

if (failed > 0) {
  process.exit(1);
}
