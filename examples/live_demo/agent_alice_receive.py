#!/usr/bin/env python3
"""
Agent Alice (Python) - Receives and verifies RESPOND message

This agent demonstrates:
1. Reading response from inbox
2. Validating the response
3. Verifying signature
4. Processing the weather data
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
    print("🐍 AGENT ALICE (Python) - Receiving response...")
    print("=" * 60)
    
    # Read the response from inbox
    inbox_path = os.path.join(os.path.dirname(__file__), 'messages', 'inbox.json')
    
    if not os.path.exists(inbox_path):
        print("❌ No response found in inbox.json")
        return 1
    
    with open(inbox_path, 'r') as f:
        raw_response = f.read()
    
    print("\n📥 Reading response from: messages/inbox.json")
    
    # Decode the message
    try:
        response_msg = moltspeak.decode(raw_response, validate=True, should_unwrap=True)
        print("✅ Response decoded successfully")
    except Exception as e:
        print(f"❌ Failed to decode response: {e}")
        return 1
    
    # Validate the response
    validation = moltspeak.validate_message(response_msg, strict=True, check_pii=True)
    if validation.valid:
        print("✅ Response validation: PASSED")
    else:
        print(f"❌ Response validation FAILED: {validation.errors}")
        return 1
    
    # Verify signature (using placeholder verification)
    if 'sig' in response_msg:
        is_valid = moltspeak.verify(response_msg, 'mock-public-key')
        if is_valid:
            print("🔏 Signature verification: PASSED")
        else:
            print("⚠️  Signature verification: FAILED (but continuing for demo)")
    else:
        print("⚠️  No signature present")
    
    # Read original query ID
    id_path = os.path.join(os.path.dirname(__file__), 'messages', 'last_query_id.txt')
    original_id = None
    if os.path.exists(id_path):
        with open(id_path, 'r') as f:
            original_id = f.read().strip()
    
    # Check reply chain
    if original_id and response_msg.get('re') == original_id:
        print(f"✅ Reply chain verified: Response matches original query ID")
    else:
        print(f"⚠️  Reply chain mismatch or missing")
    
    # Display response info
    print(f"\n📨 Received RESPOND from: {response_msg['from']['agent']}@{response_msg['from']['org']}")
    print(f"   Message ID: {response_msg['id']}")
    print(f"   Operation: {response_msg['op']}")
    print(f"   Status: {response_msg['p']['status']}")
    
    # Extract weather data
    weather = response_msg['p']['data']
    
    print("\n" + "=" * 60)
    print("🌤️  WEATHER REPORT FOR " + weather['location'].upper())
    print("=" * 60)
    print(f"   🌡️  Temperature: {weather['temperature']}°{weather['units'][0].upper()}")
    print(f"   ☁️  Conditions: {weather['conditions']}")
    print(f"   💧 Humidity: {weather['humidity']}%")
    print(f"   💨 Wind: {weather['wind']['speed']} km/h {weather['wind']['direction']}")
    print(f"   📅 Forecast: {weather['forecast']}")
    print("=" * 60)
    
    # Convert to natural language
    natural = moltspeak.to_natural_language(response_msg)
    print(f"\n📝 Natural language: {natural}")
    
    print("\n" + "=" * 60)
    print("✅ COMMUNICATION SUCCESSFUL!")
    print("   Alice (Python) → Bob (JavaScript) → Alice (Python)")
    print("   MoltSpeak protocol working end-to-end!")
    print("=" * 60)
    
    return 0

if __name__ == "__main__":
    sys.exit(main())
