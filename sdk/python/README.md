# MoltSpeak Python SDK

[![PyPI version](https://badge.fury.io/py/moltspeak.svg)](https://pypi.org/project/moltspeak/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

The official Python SDK for the MoltSpeak protocol - secure, efficient agent-to-agent communication.

**Version:** 0.1.1

## Installation

```bash
pip install moltspeak

# With cryptographic support (recommended)
pip install moltspeak[crypto]
```

## Quick Start

```python
from moltspeak import Agent, Message, MessageBuilder, Operation

# Create an agent with fresh identity
agent = Agent.create("my-assistant", "my-org", capabilities=["query", "respond"])

# Build a query message
message = (
    MessageBuilder(Operation.QUERY)
    .from_agent("my-assistant", "my-org")
    .to_agent("weather-service", "weatherco")
    .with_payload({
        "domain": "weather",
        "intent": "forecast",
        "params": {"loc": "Tokyo", "t": "+1d"}
    })
    .classified_as("pub")
    .build()
)

# Sign the message
signed = agent.sign(message)

# Serialize to JSON
print(signed.to_json(indent=2))
```

## Creating Messages

### Using MessageBuilder (Recommended)

```python
from moltspeak import MessageBuilder, Operation

# Query
query = (
    MessageBuilder(Operation.QUERY)
    .from_agent("assistant", "acme")
    .to_agent("search-service", "searchco")
    .with_payload({
        "domain": "research",
        "intent": "papers",
        "params": {"q": "transformer efficiency"}
    })
    .expires_in(3600)  # 1 hour
    .build()
)

# Task with PII
task = (
    MessageBuilder(Operation.TASK)
    .from_agent("assistant", "acme")
    .to_agent("calendar-service", "calco")
    .with_payload({
        "action": "create",
        "task_id": "meeting-001",
        "type": "schedule_meeting"
    })
    .with_pii(
        types=["email", "name"],
        consent_token="consent-abc123",
        purpose="meeting-scheduling"
    )
    .requires_capabilities(["calendar.write"])
    .build()
)
```

### Using Agent Helper Methods

```python
from moltspeak import Agent

agent = Agent.create("my-agent", "my-org")

# Simple query
query = agent.query(
    to_agent="weather-service",
    to_org="weatherco",
    domain="weather",
    intent="current",
    params={"loc": "NYC"}
)

# Respond to a message
response = agent.respond_to(
    original=incoming_message,
    status="success",
    data={"temp": 22, "conditions": "sunny"}
)
```

## Classification

Every message MUST have a classification:

```python
from moltspeak import Classification

# Public - safe for anyone
message.classified_as(Classification.PUBLIC.value)  # "pub"

# Internal - agent-to-agent only
message.classified_as(Classification.INTERNAL.value)  # "int"

# Confidential - sensitive business data
message.classified_as(Classification.CONFIDENTIAL.value)  # "conf"

# PII - requires consent
message.with_pii(types=["email"], consent_token="...", purpose="...")

# Secret - never log
message.classified_as(Classification.SECRET.value)  # "sec"
```

## PII Detection

```python
from moltspeak import PIIDetector

text = "Contact me at john@example.com or 555-123-4567"

# Detect PII
found = PIIDetector.detect(text)
# {'email': ['john@example.com'], 'phone': ['555-123-4567']}

# Mask PII
masked = PIIDetector.mask(text)
# "Contact me at jo**********om or 55*******67"

# Redact PII
redacted = PIIDetector.redact(text)
# "Contact me at [REDACTED:EMAIL] or [REDACTED:PHONE]"
```

## Sessions

```python
from moltspeak import Session, SessionManager

# Create session manager
sessions = SessionManager(max_sessions=100, default_ttl=3600)

# Create a session after handshake
session = sessions.create(
    local_agent="my-agent",
    remote_agent="other-agent",
    remote_org="other-org",
    remote_public_key="ed25519:..."
)

# Get existing session
session = sessions.get_for_remote("other-agent")

# Check capabilities
if session.has_capability("code.execute"):
    # Safe to request code execution
    pass
```

## Cryptographic Operations

```python
from moltspeak import sign_message, verify_signature, encrypt_message, decrypt_message
from moltspeak.crypto import generate_keypair

# Generate keys
private_key, public_key = generate_keypair()

# Sign
signature = sign_message("Hello, world!", private_key)

# Verify
is_valid = verify_signature("Hello, world!", signature, public_key)
```

## Error Handling

```python
from moltspeak import (
    MoltSpeakError,
    ValidationError,
    SignatureError,
    CapabilityError,
    ConsentError,
)

try:
    result = process_message(message)
except ValidationError as e:
    print(f"Invalid message at field {e.field}: {e}")
except SignatureError:
    print("Signature verification failed - message may be tampered")
except CapabilityError as e:
    print(f"Missing capability: {e.capability}")
except ConsentError as e:
    print(f"Need consent for: {e.pii_types}")
```

## Wire Format

Messages use compact field names:

```json
{
  "v": "0.1",
  "id": "uuid",
  "ts": 1703280000000,
  "op": "query",
  "from": {"agent": "my-agent", "org": "my-org", "key": "ed25519:..."},
  "to": {"agent": "other-agent", "org": "other-org"},
  "p": {"domain": "weather", "intent": "forecast"},
  "cls": "pub",
  "sig": "ed25519:..."
}
```

## Running Tests

The SDK includes comprehensive tests (400+ test cases total across all SDKs):

```bash
cd sdk/python
python test_moltspeak.py
```

See the [test file](test_moltspeak.py) for example usage patterns and edge cases.

## License

MIT
