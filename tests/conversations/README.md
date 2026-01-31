# MoltSpeak Conversation Flow Tests

Tests for realistic multi-turn agent-to-agent conversation patterns.

## Test Coverage

| Test | Description | Verifies |
|------|-------------|----------|
| **Simple Query-Response** | HELLO → HELLO → QUERY → RESPOND | Basic handshake and ref chaining |
| **Task with Streaming** | TASK → RESPOND (accept) → STREAM (25/50/75%) → RESPOND (complete) | Async task progress updates |
| **Error Recovery** | QUERY (bad) → ERROR → QUERY (fixed) → RESPOND | Error handling and retry flow |
| **Consent Flow** | QUERY (PII) → CONSENT (request) → CONSENT (grant) → RESPOND | Privacy consent negotiation |
| **Ref Chain Integrity** | 10-message chain verification | `re` field correctly chains messages |
| **Ref Roundtrip** | JSON serialize/deserialize | `re` survives wire format |

## Running Tests

### Python
```bash
cd /tmp/MoltSpeak
. .venv/bin/activate
python tests/conversations/test_conversations.py
```

### JavaScript
```bash
cd /tmp/MoltSpeak
node tests/conversations/test_conversations.mjs
```

## Key Findings

1. **`ref` field works correctly** - The `reply_to` (Python) / `replyTo` (JS) field serializes to `re` in wire format and correctly chains messages
2. **Streaming pattern** - All STREAM messages reference the original TASK, not the previous stream (allowing parallel processing)
3. **PII classification propagates** - All messages in a PII conversation maintain `cls: "pii"`
4. **Error recovery chains through error** - Corrected query references the ERROR message, creating an audit trail

## Wire Format Example

```json
{
  "v": "0.1",
  "id": "uuid-3",
  "ts": 1706702400000,
  "op": "respond",
  "from": {"agent": "translator", "org": "deepl"},
  "to": {"agent": "assistant", "org": "openai"},
  "re": "uuid-2",   // ← References previous query
  "p": {"status": "success", "data": {...}},
  "cls": "int"
}
```
