# MoltSpeak SDK Validation Report

**Generated:** January 31, 2025  
**Test Files:** `validation_test_python.py`, `validation_test_js.js`

## Summary

| Validation Area | Python SDK | JS SDK (Bundle) | TypeScript Source |
|-----------------|------------|-----------------|-------------------|
| Required Fields | ✅ Full | ✅ Full | ✅ Full |
| Classification Levels | ✅ Full | ✅ Partial* | ✅ Full |
| Timestamp Validation | ✅ Full | ✅ Full | ✅ Full |
| Size Limits | ✅ Full | ✅ Full | ✅ Full |
| PII + Classification | ✅ Full | ✅ Full | ✅ Full |
| Agent Name Validation | ❌ Lenient | ❌ Lenient | ✅ Strict |

\* Empty string classification not caught in JS bundle

---

## 1. Required Fields Validation

### Test Results
Both SDKs properly validate required fields: `v`, `id`, `ts`, `op`, `from`, `cls`

### Error Messages

| Missing Field | Python Error | JS Error |
|---------------|--------------|----------|
| `v` | `Missing required field: v` | `Missing required field: v` |
| `id` | `Missing required field: id` | `Missing required field: id` |
| `ts` | `Missing required field: ts` | `Missing required field: ts` |
| `op` | `Missing required field: op` | `Missing required field: op` |
| `from` | `Missing required field: from` | `Missing required field: from` |
| `cls` | `Missing required field: cls` | `Missing required field: cls` |

### Null Value Handling
Both SDKs treat `null` values as missing fields and report the appropriate error.

---

## 2. Classification Levels

### Valid Classifications
Both SDKs accept: `pub`, `int`, `conf`, `pii`, `sec`

### Invalid Classification Error Messages

| Classification | Python Error | JS Error |
|----------------|--------------|----------|
| `public` | `Invalid classification: public. Must be one of: pub, int, conf, pii, sec` | Same |
| `private` | `Invalid classification: private. Must be one of: pub, int, conf, pii, sec` | Same |
| `secret` | `Invalid classification: secret. Must be one of: pub, int, conf, pii, sec` | Same |
| `INTERNAL` | `Invalid classification: INTERNAL. Must be one of: pub, int, conf, pii, sec` | Same |
| `PII` | `Invalid classification: PII. Must be one of: pub, int, conf, pii, sec` | Same |
| `xyz123` | `Invalid classification: xyz123. Must be one of: pub, int, conf, pii, sec` | Same |
| ` ` (empty) | `Invalid classification: . Must be one of...` | **⚠️ No error** |
| `null` | `Invalid classification: None...` | `Missing required field: cls` |

### Note
Case-sensitive! `PII` ≠ `pii`, `INTERNAL` ≠ `int`

---

## 3. Timestamp Validation

### Test Scenarios

| Scenario | Expected | Python | JS |
|----------|----------|--------|-----|
| Fresh timestamp (now) | ✅ PASS | ✅ PASS | ✅ PASS |
| 4 minutes old | ✅ PASS | ✅ PASS | ✅ PASS |
| 6 minutes old | ❌ FAIL | ❌ FAIL | ❌ FAIL |
| Future (+1 min) | ✅ PASS | ✅ PASS | ✅ PASS |
| Negative (-1) | ❌ FAIL | ❌ FAIL | ❌ FAIL |
| Non-numeric | ❌ FAIL | ❌ FAIL | ❌ FAIL |
| Zero (0) | Varies | ❌ Too old | ⚠️ PASS |

### Error Messages

**Replay Attack (too old):**
- **Python:** `Message timestamp too old: 360.0s ago (max allowed: 300.0s). Possible replay attack.`
- **JS:** `Message timestamp too old: 360s ago (max 300s)`

**Negative Timestamp:**
- **Both:** `Timestamp (ts) must be positive`

**Non-numeric:**
- **Both:** `Timestamp (ts) must be a number`

### Time Window
Maximum message age: **5 minutes (300 seconds)**

---

## 4. Size Limits

### Limits
- Single message: **1 MB** (1,048,576 bytes)
- Batch message: 10 MB
- Stream chunk: 64 KB
- Session total: 100 MB

### Test Results

| Size | Expected | Python | JS |
|------|----------|--------|-----|
| Under 1MB (~1KB) | ✅ PASS | ✅ PASS | ✅ PASS |
| ~1MB (at limit) | ✅ PASS | ✅ PASS | ✅ PASS |
| Over 1MB | ❌ FAIL | ❌ FAIL | ❌ FAIL |

### Error Message
**Python:** `Message exceeds size limit: 1049731 bytes > 1048576 bytes`
**JS:** `Message exceeds size limit: 1049771 bytes > 1048576 bytes`

---

## 5. PII + Classification

### PII Detection Patterns
Both SDKs detect:
- **email:** `user@example.com`
- **phone:** `555-123-4567`, `+1-555-123-4567`
- **ssn:** `123-45-6789`
- **credit_card:** `4532-1234-5678-9012`
- **ipv4:** `192.168.1.1`
- **address:** `123 Main Street`
- **dob:** `01/15/1990`

### Classification Rules

| Scenario | Expected | Python | JS |
|----------|----------|--------|-----|
| PII data + `cls="pub"` | ❌ FAIL | ❌ FAIL | ❌ FAIL |
| PII data + `cls="pii"` (with consent) | ✅ PASS | ✅ PASS | ✅ PASS |
| Clean data + `cls="pub"` | ✅ PASS | ✅ PASS | ✅ PASS |

### Error Message (PII without consent)
**Both:** `PII detected without consent: email, phone, ssn. Set cls to 'pii' with consent metadata.`

### Required PII Metadata Structure
```json
{
  "pii_meta": {
    "types": ["email", "phone", "ssn"],
    "consent": {
      "granted_by": "user",
      "purpose": "testing",
      "proof": "consent-token-123"
    }
  }
}
```

---

## 6. Agent Name Validation

### ⚠️ Validation Gap Identified

The TypeScript source code defines strict validation for agent/org names:
- Max length: 256 characters
- Pattern: `/^[a-zA-Z0-9_-]+$/` (alphanumeric, dash, underscore only)

**However**, neither the Python SDK nor the bundled JS SDK enforce these rules in `validateMessage()`.

### Test Results

| Agent Name | TypeScript Source | Python SDK | JS Bundle |
|------------|-------------------|------------|-----------|
| `alice` | ✅ PASS | ✅ PASS | ✅ PASS |
| `bob-agent` | ✅ PASS | ✅ PASS | ✅ PASS |
| `agent_123` | ✅ PASS | ✅ PASS | ✅ PASS |
| `alice agent` (space) | ❌ FAIL | ⚠️ PASS | ⚠️ PASS |
| `bob@agent` | ❌ FAIL | ⚠️ PASS | ⚠️ PASS |
| `test!agent` | ❌ FAIL | ⚠️ PASS | ⚠️ PASS |
| `agent<script>` | ❌ FAIL | ⚠️ PASS | ⚠️ PASS |
| 300 chars | ❌ FAIL | ⚠️ PASS | ⚠️ PASS |
| empty string | ❌ FAIL | ⚠️ PASS | ⚠️ PASS |

### Recommendation
Add agent name validation to `validateMessage()` in both SDKs for consistency with the TypeScript source's Message class.

---

## SDK Differences Summary

### Python SDK (moltspeak.py)
- ✅ Comprehensive field validation
- ✅ Classification enum validation
- ✅ PII detection with patterns
- ✅ Timestamp replay protection (5 min window)
- ✅ Size limit enforcement
- ❌ No agent name pattern validation
- ❌ No agent name length limit

### JavaScript SDK (moltspeak.js bundle)
- ✅ Comprehensive field validation
- ⚠️ Empty string classification not caught
- ✅ PII detection with patterns
- ✅ Timestamp replay protection (5 min window)
- ⚠️ Zero timestamp allowed (probably old message)
- ✅ Size limit enforcement
- ❌ No agent name pattern validation
- ❌ No agent name length limit

### TypeScript Source (src/message.ts)
- ✅ Agent name pattern validation (`NAME_PATTERN`)
- ✅ Agent name length validation (`MAX_NAME_LENGTH = 256`)
- ✅ Payload depth validation (`MAX_PAYLOAD_DEPTH = 50`)
- Note: These validations exist in Message class but not in bundled output

---

## Recommended Fixes

1. **Add agent name validation to validateMessage()**
   ```javascript
   // JS/TS
   const NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;
   const MAX_NAME_LENGTH = 256;
   
   if (message.from?.agent) {
     if (!NAME_PATTERN.test(message.from.agent)) {
       errors.push('from.agent contains invalid characters');
     }
     if (message.from.agent.length > MAX_NAME_LENGTH) {
       errors.push('from.agent exceeds maximum length');
     }
   }
   ```

2. **Fix empty classification handling in JS**
   ```javascript
   if (!message.cls || !Object.values(CLASSIFICATIONS).includes(message.cls)) {
     // ...
   }
   ```

3. **Consider future timestamp validation**
   - Currently no check for timestamps in the future
   - Could add small tolerance (e.g., 1 minute) for clock skew

---

## Test Commands

```bash
# Python tests
cd /tmp/MoltSpeak
python3 tests/validation_test_python.py

# JavaScript tests
cd /tmp/MoltSpeak
node tests/validation_test_js.js
```
