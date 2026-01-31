# MoltSpeak Live Demo 🦎

A real-world demonstration of the MoltSpeak protocol showing end-to-end agent communication between Python and JavaScript agents.

## What This Demo Shows

1. **Cross-language Interoperability**: Alice (Python) and Bob (JavaScript) communicate seamlessly
2. **Message Validation**: All messages are validated against the MoltSpeak schema
3. **Signature Verification**: Messages are signed and verified
4. **Reply Chain Tracking**: Responses reference original message IDs
5. **Natural Language Conversion**: Messages can be described in human-readable form

## Architecture

```
┌─────────────────┐       outbox.json       ┌─────────────────┐
│  Agent Alice    │ ─────────────────────▶  │   Agent Bob     │
│   (Python)      │                         │  (JavaScript)   │
│                 │                         │                 │
│  • Creates ID   │                         │  • Reads query  │
│  • Sends QUERY  │                         │  • Validates    │
│                 │  ◀─────────────────────  │  • Responds     │
│  • Receives     │       inbox.json        │  • Signs msg    │
│  • Verifies     │                         │                 │
└─────────────────┘                         └─────────────────┘
```

## Running the Demo

```bash
./run_demo.sh
```

Or step by step:

```bash
# Step 1: Alice sends a weather query
python3 agent_alice.py

# Step 2: Bob receives, validates, and responds
node agent_bob.js

# Step 3: Alice receives and verifies the response
python3 agent_alice_receive.py
```

## File Structure

```
live_demo/
├── README.md               # This file
├── run_demo.sh             # Orchestration script
├── agent_alice.py          # Python: sends QUERY
├── agent_bob.js            # JavaScript: receives and responds
├── agent_alice_receive.py  # Python: receives RESPOND
└── messages/               # File-based message queue
    ├── outbox.json         # Alice → Bob
    ├── inbox.json          # Bob → Alice
    └── last_query_id.txt   # For reply chain verification
```

## Sample Output

```
🐍 AGENT ALICE (Python) - Starting up...
✅ Created identity: alice-weather-bot@demo-corp
✅ Target recipient: bob-weather-service@weather-inc
📨 Created QUERY message:
   ID: 183aab39-0fcf-469c-94ae-f2616eaa7399
   Operation: query
   ✅ Validation: PASSED

📦 AGENT BOB (JavaScript) - Starting up...
📥 Reading message from: messages/outbox.json
✅ Message decoded successfully
✅ Message validation: PASSED
📤 Creating RESPOND message:
   🔏 Message signed

🐍 AGENT ALICE (Python) - Receiving response...
✅ Response decoded successfully
✅ Response validation: PASSED
🔏 Signature verification: PASSED
✅ Reply chain verified

🌤️  WEATHER REPORT FOR AMSTERDAM
   🌡️  Temperature: 18°C
   ☁️  Conditions: Partly cloudy
   💧 Humidity: 65%
   💨 Wind: 12 km/h SW

✅ COMMUNICATION SUCCESSFUL!
   Alice (Python) → Bob (JavaScript) → Alice (Python)
   MoltSpeak protocol working end-to-end!
```

## Key Features Demonstrated

### 1. Message Structure
```json
{
  "v": "0.1",
  "id": "uuid-v4",
  "ts": 1769859235714,
  "op": "query",
  "cls": "int",
  "from": { "agent": "alice-weather-bot", "org": "demo-corp" },
  "to": { "agent": "bob-weather-service", "org": "weather-inc" },
  "p": { "domain": "weather", "intent": "current", "params": {...} }
}
```

### 2. Reply Chain
```json
{
  "op": "respond",
  "re": "183aab39-0fcf-469c-94ae-f2616eaa7399",  // References original query
  "p": { "status": "success", "data": {...} }
}
```

### 3. Signatures
```json
{
  "sig": "ed25519:ImludCJ8eyJhZ2VudCI6ImJvYi13ZWF0..."
}
```

## Extending the Demo

You can modify the agents to:
- Add different query types (TASK, CONSENT, etc.)
- Implement actual cryptographic signing
- Use network transport instead of files
- Add streaming responses
- Implement capability negotiation

## Requirements

- Python 3.7+
- Node.js 14+
- No external dependencies (zero-dependency SDKs)
