#!/usr/bin/env python3
"""
Agent Alice (Python) - Sends a QUERY message asking for weather

This agent demonstrates:
1. Creating an agent identity
2. Constructing a QUERY message using MoltSpeak protocol
3. Writing the message to a file-based message queue (outbox)
"""

import sys
import os
import json

# Add SDK to path - use the standalone moltspeak.py file
sdk_path = os.path.join(os.path.dirname(__file__), '..', '..', 'sdk', 'python')
sys.path.insert(0, sdk_path)

# Import from the standalone moltspeak.py file (not the package)
import importlib.util
spec = importlib.util.spec_from_file_location("moltspeak_sdk", os.path.join(sdk_path, "moltspeak.py"))
moltspeak = importlib.util.module_from_spec(spec)
spec.loader.exec_module(moltspeak)

def main():
    print("=" * 60)
    print("🐍 AGENT ALICE (Python) - Starting up...")
    print("=" * 60)
    
    # Create Alice's identity
    alice = moltspeak.AgentIdentity(
        agent="alice-weather-bot",
        org="demo-corp"
    )
    print(f"\n✅ Created identity: {alice.agent}@{alice.org}")
    
    # Create Bob's identity (recipient)
    bob = moltspeak.AgentIdentity(
        agent="bob-weather-service",
        org="weather-inc"
    )
    print(f"✅ Target recipient: {bob.agent}@{bob.org}")
    
    # Create a QUERY message asking for weather
    query_msg = moltspeak.create_query(
        {
            "domain": "weather",
            "intent": "current",
            "params": {
                "location": "Amsterdam",
                "units": "celsius"
            }
        },
        alice,
        bob
    )
    
    print(f"\n📨 Created QUERY message:")
    print(f"   ID: {query_msg['id']}")
    print(f"   Operation: {query_msg['op']}")
    print(f"   Classification: {query_msg['cls']}")
    
    # Validate the message
    validation = moltspeak.validate_message(query_msg, strict=True, check_pii=True)
    if validation.valid:
        print(f"   ✅ Validation: PASSED")
    else:
        print(f"   ❌ Validation FAILED: {validation.errors}")
        return 1
    
    # Convert to natural language for human readability
    natural = moltspeak.to_natural_language(query_msg)
    print(f"\n📝 Natural language: {natural}")
    
    # Write to outbox
    outbox_path = os.path.join(os.path.dirname(__file__), 'messages', 'outbox.json')
    with open(outbox_path, 'w') as f:
        f.write(moltspeak.encode(query_msg, pretty=True))
    
    print(f"\n📤 Message written to: messages/outbox.json")
    print("\n" + "=" * 60)
    print("Full message content:")
    print("=" * 60)
    print(moltspeak.encode(query_msg, pretty=True))
    print("=" * 60)
    
    # Save message ID for later reference
    id_path = os.path.join(os.path.dirname(__file__), 'messages', 'last_query_id.txt')
    with open(id_path, 'w') as f:
        f.write(query_msg['id'])
    
    print(f"\n🏁 Alice finished sending. Waiting for Bob's response...")
    return 0

if __name__ == "__main__":
    sys.exit(main())
