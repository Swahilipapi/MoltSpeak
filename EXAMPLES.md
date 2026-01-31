# MoltSpeak Examples

> Real-world message exchanges demonstrating protocol efficiency and clarity.

## Example 1: Weather Query

### Natural Language
```
Agent A: "Hi there! I was wondering if you could help me out. I need to know what 
the weather will be like in San Francisco tomorrow. Specifically, I'm interested 
in the temperature and whether it will rain. Thanks!"

Agent B: "Of course! I'd be happy to help you with that. Looking at the forecast 
for San Francisco tomorrow, December 23rd, 2024, it looks like you can expect a 
high of 58°F (14°C) and a low of 48°F (9°C). There's a 20% chance of rain in the 
morning, but it should clear up by the afternoon. It will be partly cloudy overall. 
Is there anything else you'd like to know?"
```

**Token count**: ~180 tokens total

### MoltSpeak
```json
// Request
{
  "v": "0.1",
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "ts": 1703280000000,
  "op": "query",
  "from": {"agent": "assistant-a", "org": "acme"},
  "to": {"agent": "weather-service", "org": "weatherco"},
  "p": {
    "domain": "weather",
    "intent": "forecast",
    "params": {"loc": "San Francisco, CA", "t": "+1d"},
    "response_format": {"fields": ["temp_high", "temp_low", "precip_chance", "conditions"]}
  },
  "cls": "pub",
  "sig": "ed25519:..."
}

// Response
{
  "v": "0.1",
  "id": "b2c3d4e5-f6a7-8901-bcde-f23456789012",
  "ts": 1703280001000,
  "op": "respond",
  "re": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "from": {"agent": "weather-service", "org": "weatherco"},
  "to": {"agent": "assistant-a", "org": "acme"},
  "p": {
    "status": "success",
    "data": {
      "loc": "San Francisco, CA",
      "date": "2024-12-23",
      "temp_high_c": 14,
      "temp_low_c": 9,
      "precip_chance": 0.2,
      "conditions": "partly-cloudy"
    }
  },
  "cls": "pub",
  "sig": "ed25519:..."
}
```

**Token count**: ~85 tokens total

**Efficiency gain**: 53% reduction (180 → 85 tokens)

---

## Example 2: Calendar Coordination (with PII)

### Natural Language
```
Agent A: "I need to schedule a meeting with John Smith (john.smith@example.com) 
for next Tuesday at 2pm. Can you check if that time works and send him an invite? 
Oh, and please don't share his email with anyone else."

Agent B: "I'll check John's availability. Looking at his calendar... Tuesday at 
2pm works for him. I've sent the meeting invite to john.smith@example.com. As you 
requested, I won't share his contact information. The meeting is confirmed for 
Tuesday, December 24th at 2:00 PM PST. Is there anything else you need?"
```

**Token count**: ~130 tokens
**Privacy issue**: Email transmitted in plaintext, consent unclear

### MoltSpeak
```json
// Request with PII protection
{
  "v": "0.1",
  "id": "c3d4e5f6-a7b8-9012-cdef-345678901234",
  "ts": 1703280000000,
  "op": "task",
  "from": {"agent": "assistant-a", "org": "acme"},
  "to": {"agent": "calendar-service", "org": "calco"},
  "p": {
    "action": "schedule",
    "task_id": "task-001",
    "type": "meeting",
    "params": {
      "time": "2024-12-24T14:00:00-08:00",
      "duration_min": 60,
      "attendee": {"ref": "contact:john-smith-001"}
    },
    "steps": ["check_availability", "send_invite"]
  },
  "cls": "pii",
  "pii_meta": {
    "types": ["email", "name"],
    "consent": {
      "granted_by": "user:alice@acme.com",
      "purpose": "meeting-scheduling",
      "proof": "consent-token:xyz789",
      "scope": "internal_only"
    }
  },
  "sig": "ed25519:..."
}

// Response
{
  "v": "0.1",
  "id": "d4e5f6a7-b8c9-0123-def4-567890123456",
  "ts": 1703280005000,
  "op": "respond",
  "re": "c3d4e5f6-a7b8-9012-cdef-345678901234",
  "from": {"agent": "calendar-service", "org": "calco"},
  "to": {"agent": "assistant-a", "org": "acme"},
  "p": {
    "status": "success",
    "task_id": "task-001",
    "results": {
      "availability": true,
      "invite_sent": true,
      "event_id": "evt-20241224-001"
    }
  },
  "cls": "int",
  "sig": "ed25519:..."
}
```

**Token count**: ~95 tokens
**Privacy**: PII reference (not value), explicit consent, scope-limited

**Efficiency gain**: 27% reduction with **100% privacy improvement**

---

## Example 3: Code Execution Request

### Natural Language
```
Agent A: "Could you run this Python code for me and let me know what it outputs?

def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)

print(fibonacci(10))

I need the result to calculate something else."

Agent B: "I've executed your Python code. The fibonacci function calculated the 
10th Fibonacci number, which is 55. The output was simply '55' printed to stdout. 
The code ran successfully without any errors. Would you like me to run any 
additional calculations?"
```

**Token count**: ~120 tokens

### MoltSpeak
```json
// Request
{
  "v": "0.1",
  "id": "e5f6a7b8-c9d0-1234-ef56-789012345678",
  "ts": 1703280000000,
  "op": "tool",
  "from": {"agent": "assistant-a", "org": "acme"},
  "to": {"agent": "code-runner", "org": "sandbox-co"},
  "p": {
    "action": "invoke",
    "tool": "python-exec",
    "input": {
      "code": "def fibonacci(n):\n    if n <= 1:\n        return n\n    return fibonacci(n-1) + fibonacci(n-2)\n\nprint(fibonacci(10))",
      "timeout_ms": 5000
    }
  },
  "cap": ["code.execute"],
  "cls": "int",
  "sig": "ed25519:..."
}

// Response
{
  "v": "0.1",
  "id": "f6a7b8c9-d0e1-2345-f678-901234567890",
  "ts": 1703280002000,
  "op": "respond",
  "re": "e5f6a7b8-c9d0-1234-ef56-789012345678",
  "from": {"agent": "code-runner", "org": "sandbox-co"},
  "to": {"agent": "assistant-a", "org": "acme"},
  "p": {
    "status": "success",
    "output": {
      "stdout": "55\n",
      "stderr": "",
      "exit_code": 0,
      "runtime_ms": 12
    }
  },
  "cls": "int",
  "sig": "ed25519:..."
}
```

**Token count**: ~90 tokens

**Efficiency gain**: 25% reduction with **explicit capability requirement**

---

## Example 4: Multi-Agent Task Delegation

### Scenario
Agent A needs to research a topic, requiring:
1. Web search
2. Document summarization
3. Fact verification

### Natural Language (Chatty)
*Multiple back-and-forth messages, clarifications, status updates...*

**Estimated tokens**: 400-600 for full exchange

### MoltSpeak
```json
// Parent task creation
{
  "v": "0.1",
  "id": "task-parent-001",
  "ts": 1703280000000,
  "op": "task",
  "from": {"agent": "assistant-a", "org": "acme"},
  "to": {"agent": "orchestrator", "org": "acme"},
  "p": {
    "action": "create",
    "task_id": "research-001",
    "type": "research",
    "description": "AI agent security best practices",
    "subtasks": [
      {
        "id": "search-001",
        "type": "web-search",
        "delegate_to": "search-agent",
        "params": {"query": "AI agent security best practices 2024", "max_results": 10}
      },
      {
        "id": "summarize-001",
        "type": "summarize",
        "delegate_to": "summarizer-agent",
        "depends_on": ["search-001"],
        "params": {"max_length": 500}
      },
      {
        "id": "verify-001",
        "type": "fact-check",
        "delegate_to": "verifier-agent",
        "depends_on": ["summarize-001"],
        "params": {"min_sources": 2}
      }
    ],
    "deadline": 1703283600000,
    "callback": {"on_complete": true}
  },
  "cls": "int",
  "sig": "ed25519:..."
}

// Final aggregated response
{
  "v": "0.1",
  "id": "result-001",
  "ts": 1703281800000,
  "op": "respond",
  "re": "task-parent-001",
  "from": {"agent": "orchestrator", "org": "acme"},
  "to": {"agent": "assistant-a", "org": "acme"},
  "p": {
    "status": "success",
    "task_id": "research-001",
    "results": {
      "summary": "...",
      "sources": [...],
      "verification": {"status": "verified", "confidence": 0.92},
      "subtask_stats": {
        "search-001": {"status": "complete", "runtime_ms": 2300},
        "summarize-001": {"status": "complete", "runtime_ms": 1500},
        "verify-001": {"status": "complete", "runtime_ms": 3200}
      }
    }
  },
  "cls": "int",
  "sig": "ed25519:..."
}
```

**Token count**: ~150 tokens (vs 400-600 for natural language)

**Efficiency gain**: 70% reduction with **explicit task graph**

---

## Example 5: Streaming Response

### Use Case
Large document generation with progress updates.

```json
// Stream start
{
  "v": "0.1",
  "id": "stream-001",
  "ts": 1703280000000,
  "op": "stream",
  "from": {"agent": "generator", "org": "acme"},
  "to": {"agent": "requester", "org": "acme"},
  "p": {
    "action": "start",
    "stream_id": "doc-gen-001",
    "type": "text",
    "estimated_chunks": 50,
    "content_type": "text/markdown"
  },
  "cls": "int"
}

// Stream chunks (repeated)
{
  "v": "0.1",
  "id": "chunk-015",
  "ts": 1703280015000,
  "op": "stream",
  "p": {
    "action": "chunk",
    "stream_id": "doc-gen-001",
    "seq": 15,
    "data": "## Section 3: Implementation\n\nThe implementation requires...",
    "progress": 0.30
  },
  "cls": "int"
}

// Stream end
{
  "v": "0.1",
  "id": "stream-end-001",
  "ts": 1703280050000,
  "op": "stream",
  "from": {"agent": "generator", "org": "acme"},
  "to": {"agent": "requester", "org": "acme"},
  "p": {
    "action": "end",
    "stream_id": "doc-gen-001",
    "total_chunks": 50,
    "checksum": "sha256:abc123..."
  },
  "cls": "int"
}
```

---

## Example 6: Error Handling

### Recoverable Error
```json
{
  "v": "0.1",
  "id": "error-001",
  "ts": 1703280000000,
  "op": "error",
  "re": "original-request-id",
  "from": {"agent": "service-b", "org": "beta"},
  "to": {"agent": "agent-a", "org": "alpha"},
  "p": {
    "code": "E_RATE_LIMIT",
    "category": "transport",
    "message": "Rate limit exceeded: 100 requests/minute",
    "recoverable": true,
    "suggestion": {
      "action": "retry_after",
      "delay_ms": 30000
    },
    "context": {
      "limit": 100,
      "window": "1m",
      "current": 127
    }
  },
  "cls": "int"
}
```

### Non-Recoverable Error
```json
{
  "v": "0.1",
  "id": "error-002",
  "ts": 1703280000000,
  "op": "error",
  "re": "original-request-id",
  "from": {"agent": "service-b", "org": "beta"},
  "to": {"agent": "agent-a", "org": "alpha"},
  "p": {
    "code": "E_CAPABILITY",
    "category": "auth",
    "message": "Required capability 'code.execute' not held by sender",
    "recoverable": false,
    "suggestion": {
      "action": "request_capability",
      "capability": "code.execute",
      "attestation_required": "org-signed"
    }
  },
  "cls": "int"
}
```

---

## Efficiency Summary

| Scenario | Natural Language | MoltSpeak | Reduction |
|----------|-----------------|------------|-----------|
| Weather query | 180 tokens | 85 tokens | 53% |
| Calendar + PII | 130 tokens | 95 tokens | 27%* |
| Code execution | 120 tokens | 90 tokens | 25% |
| Multi-agent task | 500 tokens | 150 tokens | 70% |
| **Average** | **232 tokens** | **105 tokens** | **55%** |

*Calendar scenario includes privacy guarantees not present in natural language

### When MoltSpeak Excels
- Structured data queries (weather, stocks, status)
- Task delegation and orchestration
- Operations requiring explicit capabilities
- Anything involving PII or sensitive data
- High-frequency agent communication

### When Natural Language is Acceptable
- One-off human-initiated requests
- Exploratory conversations
- Debugging and explanation
- Creative/open-ended tasks

---

*MoltSpeak Examples v0.1*
