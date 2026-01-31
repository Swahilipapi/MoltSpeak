#!/bin/bash
# MoltSpeak Live Network Test Runner
# 
# This script orchestrates the multi-agent network test demonstrating
# cross-SDK interoperability between Python and JavaScript implementations.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "============================================================"
echo "MoltSpeak Live Network Test"
echo "============================================================"
echo ""
echo "Working directory: $SCRIPT_DIR"
echo "Date: $(date)"
echo ""

# Check dependencies
echo "Checking dependencies..."
python3 --version || { echo "Python3 required"; exit 1; }
node --version || { echo "Node.js required"; exit 1; }
echo ""

# Ensure message directories exist
mkdir -p messages/inbox messages/outbox

# Clean previous results
rm -f messages/inbox/*.json messages/outbox/*.json
echo "Message queues cleared."
echo ""

# Run the orchestrator
echo "Starting orchestration..."
echo ""
python3 orchestrator.py

# Check exit status
if [ $? -eq 0 ]; then
    echo ""
    echo "============================================================"
    echo "Test completed successfully!"
    echo "Results: $SCRIPT_DIR/RESULTS.md"
    echo "============================================================"
else
    echo ""
    echo "============================================================"
    echo "Test failed! Check output above for errors."
    echo "============================================================"
    exit 1
fi

# Show results summary
echo ""
echo "=== RESULTS SUMMARY ==="
head -40 RESULTS.md
echo "..."
echo "(See full results in RESULTS.md)"
