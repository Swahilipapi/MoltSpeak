#!/bin/bash
#
# MoltSpeak Live Demo
# 
# Demonstrates end-to-end agent communication:
# 1. Alice (Python) sends QUERY asking for weather
# 2. Bob (JavaScript) receives, validates, and responds
# 3. Alice (Python) receives and verifies the response
#

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Colors for pretty output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo ""
echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║              🦎 MOLTSPEAK LIVE DEMO                          ║${NC}"
echo -e "${BLUE}║     Agent-to-Agent Communication in Action                   ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Clean up any previous messages
rm -f messages/outbox.json messages/inbox.json messages/last_query_id.txt

echo -e "${YELLOW}▶ STEP 1: Alice (Python) sends a weather query...${NC}"
echo ""
python3 agent_alice.py

echo ""
echo -e "${YELLOW}▶ STEP 2: Bob (JavaScript) receives and responds...${NC}"
echo ""
node agent_bob.js

echo ""
echo -e "${YELLOW}▶ STEP 3: Alice (Python) receives and verifies response...${NC}"
echo ""
python3 agent_alice_receive.py

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                    🎉 DEMO COMPLETE!                         ║${NC}"
echo -e "${GREEN}║                                                              ║${NC}"
echo -e "${GREEN}║  Summary:                                                    ║${NC}"
echo -e "${GREEN}║  • Alice created a valid MoltSpeak QUERY message             ║${NC}"
echo -e "${GREEN}║  • Bob validated, processed, and created RESPOND             ║${NC}"
echo -e "${GREEN}║  • Alice verified the response and extracted data            ║${NC}"
echo -e "${GREEN}║  • Cross-language communication: Python ↔ JavaScript         ║${NC}"
echo -e "${GREEN}║                                                              ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
