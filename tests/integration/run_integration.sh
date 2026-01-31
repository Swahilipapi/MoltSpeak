#!/bin/bash
#
# MoltSpeak Cross-SDK Integration Test Runner
#
# Runs both Python and JavaScript integration tests and reports results.
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "╔══════════════════════════════════════════════════════════╗"
echo "║     MoltSpeak Cross-SDK Integration Test Suite           ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Track results
PYTHON_RESULT=0
JS_RESULT=0

# Check prerequisites
echo "🔍 Checking prerequisites..."
echo ""

if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 is required but not found"
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo "❌ Node.js is required but not found"
    exit 1
fi

echo "  Python: $(python3 --version 2>&1 | head -1)"
echo "  Node:   $(node --version)"
echo ""

# Run Python integration tests
echo "╭──────────────────────────────────────────────────────────╮"
echo "│  Running Python Integration Tests                        │"
echo "╰──────────────────────────────────────────────────────────╯"
echo ""

if python3 "$SCRIPT_DIR/cross_sdk_test.py"; then
    PYTHON_RESULT=0
    echo ""
    echo "✅ Python tests completed successfully"
else
    PYTHON_RESULT=1
    echo ""
    echo "❌ Python tests failed"
fi

echo ""
echo ""

# Run JavaScript integration tests
echo "╭──────────────────────────────────────────────────────────╮"
echo "│  Running JavaScript Integration Tests                    │"
echo "╰──────────────────────────────────────────────────────────╯"
echo ""

if node "$SCRIPT_DIR/cross_sdk_test.js"; then
    JS_RESULT=0
    echo ""
    echo "✅ JavaScript tests completed successfully"
else
    JS_RESULT=1
    echo ""
    echo "❌ JavaScript tests failed"
fi

echo ""
echo ""

# Summary
echo "╔══════════════════════════════════════════════════════════╗"
echo "║                    FINAL RESULTS                         ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

if [ $PYTHON_RESULT -eq 0 ] && [ $JS_RESULT -eq 0 ]; then
    echo "  Python SDK tests:     ✅ PASS"
    echo "  JavaScript SDK tests: ✅ PASS"
    echo ""
    echo "  ╔════════════════════════════════════════════════════╗"
    echo "  ║  🎉 ALL INTEGRATION TESTS PASSED!                  ║"
    echo "  ║                                                    ║"
    echo "  ║  The Python and JavaScript SDKs are fully         ║"
    echo "  ║  interoperable. Messages can be:                  ║"
    echo "  ║    • Created in either SDK                        ║"
    echo "  ║    • Signed in either SDK                         ║"
    echo "  ║    • Verified in either SDK                       ║"
    echo "  ║    • Wrapped/unwrapped in envelopes               ║"
    echo "  ╚════════════════════════════════════════════════════╝"
    echo ""
    exit 0
else
    [ $PYTHON_RESULT -eq 0 ] && echo "  Python SDK tests:     ✅ PASS" || echo "  Python SDK tests:     ❌ FAIL"
    [ $JS_RESULT -eq 0 ] && echo "  JavaScript SDK tests: ✅ PASS" || echo "  JavaScript SDK tests: ❌ FAIL"
    echo ""
    echo "  ⚠️  Some integration tests failed."
    echo "  Please review the output above for details."
    echo ""
    exit 1
fi
