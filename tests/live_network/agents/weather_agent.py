#!/usr/bin/env python3
"""
Weather Agent - MoltSpeak Python SDK

A specialist agent that responds to weather queries.
Demonstrates Python SDK message handling.
"""

import sys
import json
from pathlib import Path

# Add SDK to path - use the standalone moltspeak.py file
sdk_path = Path(__file__).parent.parent.parent.parent / "sdk" / "python"
sys.path.insert(0, str(sdk_path))

# Import from standalone SDK file
import importlib.util
spec = importlib.util.spec_from_file_location("moltspeak_standalone", sdk_path / "moltspeak.py")
moltspeak_standalone = importlib.util.module_from_spec(spec)
spec.loader.exec_module(moltspeak_standalone)

create_response = moltspeak_standalone.create_response
sign = moltspeak_standalone.sign
verify = moltspeak_standalone.verify
decode = moltspeak_standalone.decode
encode = moltspeak_standalone.encode
AgentIdentity = moltspeak_standalone.AgentIdentity
Operations = moltspeak_standalone.Operations

# ============================================================================
# Agent Identity
# ============================================================================

IDENTITY = AgentIdentity(
    agent="weather-agent",
    org="moltspeak-network",
    key="ed25519:weather_public_key_12345"
)
PRIVATE_KEY = "ed25519:weather_private_key_12345"

# ============================================================================
# Weather Data (Mock)
# ============================================================================

WEATHER_DATA = {
    "Tokyo": {"temp": "22°C", "conditions": "Partly cloudy", "humidity": "65%"},
    "London": {"temp": "14°C", "conditions": "Rainy", "humidity": "85%"},
    "New York": {"temp": "18°C", "conditions": "Sunny", "humidity": "45%"},
    "default": {"temp": "20°C", "conditions": "Clear", "humidity": "50%"}
}

# ============================================================================
# Message Handler
# ============================================================================

def handle_query(message: dict) -> dict:
    """Handle an incoming weather query."""
    payload = message.get("p", {})
    location = payload.get("params", {}).get("location", "default")
    
    weather = WEATHER_DATA.get(location, WEATHER_DATA["default"])
    
    response_data = {
        "location": location,
        "temperature": weather["temp"],
        "conditions": weather["conditions"],
        "humidity": weather["humidity"],
        "forecast": f"Weather data for {location}"
    }
    
    # Get sender identity for response
    sender = message.get("from", {})
    to_identity = AgentIdentity(
        agent=sender.get("agent", "unknown"),
        org=sender.get("org"),
        key=sender.get("key")
    )
    
    # Create response
    response = create_response(
        message["id"],
        response_data,
        IDENTITY,
        to_identity
    )
    
    # Sign the response
    signed_response = sign(response, PRIVATE_KEY)
    
    return signed_response

def process_message(msg_json: str) -> str:
    """Process an incoming message and return response."""
    message = decode(msg_json, validate=True)
    
    # Verify signature if present
    if "sig" in message:
        sender_key = message.get("from", {}).get("key")
        if sender_key:
            is_valid = verify(message, sender_key)
            if not is_valid:
                print(f"WARNING: Invalid signature from {message.get('from', {}).get('agent')}")
    
    # Handle based on operation
    if message.get("op") == Operations.QUERY.value:
        response = handle_query(message)
        return encode(response, pretty=True)
    
    return json.dumps({"error": "Unsupported operation"})

# ============================================================================
# Main
# ============================================================================

if __name__ == "__main__":
    print(f"Weather Agent ({IDENTITY.agent}) initialized")
    print(f"SDK: Python | Org: {IDENTITY.org}")
    
    # Demo: process a sample query
    if len(sys.argv) > 1:
        msg_file = sys.argv[1]
        with open(msg_file) as f:
            response = process_message(f.read())
        print(response)
    else:
        print("Ready to process weather queries")
        print(f"Supported locations: {list(WEATHER_DATA.keys())}")
