#!/bin/bash
#
# MoltSpeak Error Handling Tests Runner
#

set -e

cd "$(dirname "$0")"
ROOT_DIR="$(cd ../.. && pwd)"

echo "=============================================="
echo " MoltSpeak Error Handling Tests"
echo "=============================================="

# Run Python tests
echo ""
echo "Running Python SDK tests..."
echo "----------------------------------------------"
cd "$ROOT_DIR"
. .venv/bin/activate
python tests/error_handling/test_errors_python.py
PYTHON_EXIT=$?

# Run TypeScript tests
echo ""
echo "Running TypeScript SDK tests..."
echo "----------------------------------------------"
cd "$ROOT_DIR/tests/error_handling"
npx ts-node --transpile-only --project tsconfig.json test_errors_typescript.ts
TS_EXIT=$?

# Final summary
echo ""
echo "=============================================="
echo " FINAL RESULTS"
echo "=============================================="
if [ $PYTHON_EXIT -eq 0 ] && [ $TS_EXIT -eq 0 ]; then
    echo " ✅ All error handling tests PASSED!"
    exit 0
else
    echo " ❌ Some tests FAILED"
    [ $PYTHON_EXIT -ne 0 ] && echo "   - Python SDK: FAILED"
    [ $TS_EXIT -ne 0 ] && echo "   - TypeScript SDK: FAILED"
    exit 1
fi
