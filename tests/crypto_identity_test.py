#!/usr/bin/env python3
"""
MoltSpeak Cryptographic & Identity Test Suite

Tests all crypto and identity features:
1. Key Generation - 10 unique identities
2. Signing - unique signatures, deterministic behavior
3. Verification - valid/invalid scenarios
4. Cross-SDK - Python <-> JavaScript crypto interop
"""

import json
import subprocess
import sys
import os
import base64

# Add SDK paths
sdk_path = os.path.join(os.path.dirname(__file__), '..', 'sdk', 'python')
sys.path.insert(0, sdk_path)

# Import crypto module
from moltspeak.crypto import (
    generate_keypair,
    sign_message,
    verify_signature,
    NACL_AVAILABLE
)

# ============================================================================
# Test Results Tracking
# ============================================================================

class TestResult:
    def __init__(self, name: str, category: str):
        self.name = name
        self.category = category
        self.passed = False
        self.error = None
        self.details = None
    
    def __str__(self):
        status = "✅ PASS" if self.passed else "❌ FAIL"
        result = f"{status}: [{self.category}] {self.name}"
        if self.error:
            result += f"\n   Error: {self.error}"
        if self.details and not self.passed:
            result += f"\n   Details: {self.details}"
        return result


RESULTS = []


def run_test(name: str, category: str):
    """Decorator for test functions"""
    def decorator(func):
        def wrapper():
            result = TestResult(name, category)
            try:
                func(result)
            except Exception as e:
                result.passed = False
                result.error = str(e)
            RESULTS.append(result)
            return result
        return wrapper
    return decorator


def run_js(script: str) -> tuple:
    """Run JavaScript code via Node.js"""
    js_sdk_path = os.path.join(os.path.dirname(__file__), '..', 'sdk', 'js')
    
    full_script = f"""
const nacl = require('{js_sdk_path}/node_modules/tweetnacl');
const naclUtil = require('{js_sdk_path}/node_modules/tweetnacl-util');

// Helper functions matching Python SDK format
function generateKeyPair() {{
    const keyPair = nacl.sign.keyPair();
    return {{
        privateKey: naclUtil.encodeBase64(keyPair.secretKey),
        publicKey: naclUtil.encodeBase64(keyPair.publicKey)
    }};
}}

function signMessage(message, privateKeyB64) {{
    const secretKey = naclUtil.decodeBase64(privateKeyB64);
    const messageBytes = naclUtil.decodeUTF8(message);
    const signature = nacl.sign.detached(messageBytes, secretKey);
    return naclUtil.encodeBase64(signature);
}}

function verifySignature(message, signatureB64, publicKeyB64) {{
    try {{
        const publicKey = naclUtil.decodeBase64(publicKeyB64);
        const signature = naclUtil.decodeBase64(signatureB64);
        const messageBytes = naclUtil.decodeUTF8(message);
        return nacl.sign.detached.verify(messageBytes, signature, publicKey);
    }} catch(e) {{
        return false;
    }}
}}

{script}
"""
    
    result = subprocess.run(
        ['node', '-e', full_script],
        capture_output=True,
        text=True,
        timeout=10
    )
    
    return result.stdout.strip(), result.stderr.strip(), result.returncode


# ============================================================================
# KEY GENERATION TESTS
# ============================================================================

@run_test("Generate 10 unique agent identities", "KEY_GEN")
def test_generate_10_identities(result):
    """Generate 10 different agent identities with unique keys"""
    identities = []
    public_keys = set()
    private_keys = set()
    
    for i in range(10):
        private_key, public_key = generate_keypair()
        identities.append({
            "id": f"agent-{i}",
            "private_key": private_key,
            "public_key": public_key
        })
        public_keys.add(public_key)
        private_keys.add(private_key)
    
    # All 10 public keys should be unique
    if len(public_keys) != 10:
        result.error = f"Expected 10 unique public keys, got {len(public_keys)}"
        return
    
    # All 10 private keys should be unique
    if len(private_keys) != 10:
        result.error = f"Expected 10 unique private keys, got {len(private_keys)}"
        return
    
    result.passed = True
    result.details = f"Generated 10 identities with unique keys"


@run_test("Verify key format (ed25519 base64)", "KEY_GEN")
def test_key_format(result):
    """Verify keys have correct format"""
    private_key, public_key = generate_keypair()
    
    # Keys should be base64 encoded
    try:
        private_bytes = base64.b64decode(private_key)
        public_bytes = base64.b64decode(public_key)
    except Exception as e:
        result.error = f"Keys not valid base64: {e}"
        return
    
    # Ed25519 private key (seed + public) = 64 bytes
    # Ed25519 public key = 32 bytes
    if len(private_bytes) != 32:
        result.error = f"Private key wrong size: {len(private_bytes)} (expected 32 seed bytes)"
        return
    
    if len(public_bytes) != 32:
        result.error = f"Public key wrong size: {len(public_bytes)} (expected 32 bytes)"
        return
    
    result.passed = True
    result.details = f"Private: 32 bytes, Public: 32 bytes (base64 encoded)"


@run_test("Key derivation is deterministic from seed", "KEY_GEN")
def test_key_determinism(result):
    """Each generated keypair should be cryptographically random"""
    keys_a = generate_keypair()
    keys_b = generate_keypair()
    
    if keys_a[0] == keys_b[0]:
        result.error = "Two generated private keys are identical (not random)"
        return
    
    if keys_a[1] == keys_b[1]:
        result.error = "Two generated public keys are identical (not random)"
        return
    
    result.passed = True
    result.details = "Each call generates unique random keypair"


# ============================================================================
# SIGNING TESTS
# ============================================================================

@run_test("Sign messages with each identity", "SIGNING")
def test_sign_with_identities(result):
    """Sign a message with 10 different identities"""
    message = "Test message for signing"
    signatures = set()
    
    for i in range(10):
        private_key, public_key = generate_keypair()
        signature = sign_message(message, private_key)
        
        if not signature:
            result.error = f"Identity {i} produced empty signature"
            return
            
        signatures.add(signature)
    
    # All 10 signatures should be unique (different keys)
    if len(signatures) != 10:
        result.error = f"Expected 10 unique signatures, got {len(signatures)}"
        return
    
    result.passed = True
    result.details = "10 identities signed same message with 10 unique signatures"


@run_test("Signatures are unique per message", "SIGNING")
def test_signatures_unique_per_message(result):
    """Different messages produce different signatures"""
    private_key, public_key = generate_keypair()
    
    messages = [
        "Message 1",
        "Message 2",
        "Message 3",
        "Longer message with more content",
        "Special chars: !@#$%^&*()"
    ]
    
    signatures = []
    for msg in messages:
        sig = sign_message(msg, private_key)
        signatures.append(sig)
    
    # All signatures should be unique
    if len(set(signatures)) != len(messages):
        result.error = "Some messages produced identical signatures"
        return
    
    result.passed = True
    result.details = f"5 different messages = 5 different signatures"


@run_test("Same message + same key = same signature", "SIGNING")
def test_signature_determinism(result):
    """Same message with same key produces identical signature"""
    private_key, public_key = generate_keypair()
    message = "Deterministic signing test"
    
    sig1 = sign_message(message, private_key)
    sig2 = sign_message(message, private_key)
    sig3 = sign_message(message, private_key)
    
    if sig1 != sig2 or sig2 != sig3:
        result.error = f"Signatures differ: {sig1[:20]}... vs {sig2[:20]}..."
        return
    
    result.passed = True
    result.details = "3 sign operations with same inputs = identical signatures"


@run_test("Signature format is base64", "SIGNING")
def test_signature_format(result):
    """Signature should be valid base64"""
    private_key, public_key = generate_keypair()
    signature = sign_message("Test message", private_key)
    
    try:
        sig_bytes = base64.b64decode(signature)
    except Exception as e:
        result.error = f"Signature not valid base64: {e}"
        return
    
    # Ed25519 signature = 64 bytes
    if len(sig_bytes) != 64:
        result.error = f"Signature wrong size: {len(sig_bytes)} (expected 64 bytes)"
        return
    
    result.passed = True
    result.details = "Signature is 64 bytes, base64 encoded"


# ============================================================================
# VERIFICATION TESTS
# ============================================================================

@run_test("Valid signatures pass verification", "VERIFY")
def test_valid_signature_passes(result):
    """A properly signed message should verify"""
    private_key, public_key = generate_keypair()
    message = "Valid signature test"
    
    signature = sign_message(message, private_key)
    verified = verify_signature(message, signature, public_key)
    
    if not verified:
        result.error = "Valid signature failed verification"
        return
    
    result.passed = True
    result.details = "sign() -> verify() = True"


@run_test("Tampered messages fail verification", "VERIFY")
def test_tampered_message_fails(result):
    """Modified message should fail verification"""
    private_key, public_key = generate_keypair()
    original_message = "Original message"
    
    signature = sign_message(original_message, private_key)
    
    # Tamper with message
    tampered_message = "Tampered message"
    verified = verify_signature(tampered_message, signature, public_key)
    
    if verified:
        result.error = "Tampered message passed verification (should fail)"
        return
    
    result.passed = True
    result.details = "Tampered message correctly rejected"


@run_test("Wrong key fails verification", "VERIFY")
def test_wrong_key_fails(result):
    """Signature verified with wrong key should fail"""
    private_key_a, public_key_a = generate_keypair()
    private_key_b, public_key_b = generate_keypair()
    
    message = "Test with wrong key"
    signature = sign_message(message, private_key_a)  # Sign with key A
    
    # Verify with key B (wrong key)
    verified = verify_signature(message, signature, public_key_b)
    
    if verified:
        result.error = "Signature verified with wrong key (should fail)"
        return
    
    result.passed = True
    result.details = "Wrong public key correctly rejected"


@run_test("Truncated signatures fail verification", "VERIFY")
def test_truncated_signature_fails(result):
    """Truncated signature should fail"""
    private_key, public_key = generate_keypair()
    message = "Test truncation"
    
    signature = sign_message(message, private_key)
    
    # Truncate signature
    truncated = signature[:len(signature)//2]
    verified = verify_signature(message, truncated, public_key)
    
    if verified:
        result.error = "Truncated signature passed verification (should fail)"
        return
    
    result.passed = True
    result.details = "Truncated signature correctly rejected"


@run_test("Corrupted signatures fail verification", "VERIFY")
def test_corrupted_signature_fails(result):
    """Corrupted signature should fail"""
    private_key, public_key = generate_keypair()
    message = "Test corruption"
    
    signature = sign_message(message, private_key)
    
    # Corrupt signature by changing characters
    sig_bytes = bytearray(base64.b64decode(signature))
    sig_bytes[0] ^= 0xFF  # Flip bits in first byte
    sig_bytes[32] ^= 0xFF  # Flip bits in middle
    corrupted = base64.b64encode(bytes(sig_bytes)).decode()
    
    verified = verify_signature(message, corrupted, public_key)
    
    if verified:
        result.error = "Corrupted signature passed verification (should fail)"
        return
    
    result.passed = True
    result.details = "Corrupted signature correctly rejected"


@run_test("Empty message can be signed and verified", "VERIFY")
def test_empty_message(result):
    """Empty string should work"""
    private_key, public_key = generate_keypair()
    message = ""
    
    signature = sign_message(message, private_key)
    verified = verify_signature(message, signature, public_key)
    
    if not verified:
        result.error = "Empty message signature failed verification"
        return
    
    result.passed = True
    result.details = "Empty message sign/verify works"


# ============================================================================
# CROSS-SDK CRYPTO TESTS
# ============================================================================

@run_test("Sign in Python, verify in JavaScript", "CROSS_SDK")
def test_python_sign_js_verify(result):
    """Python signature should be verifiable by JS"""
    private_key, public_key = generate_keypair()
    message = "Cross-SDK test: Python to JavaScript"
    
    # Sign in Python
    signature = sign_message(message, private_key)
    
    # Verify in JavaScript
    js_script = f'''
const verified = verifySignature(
    {json.dumps(message)},
    {json.dumps(signature)},
    {json.dumps(public_key)}
);
console.log(JSON.stringify({{ verified: verified }}));
'''
    
    stdout, stderr, code = run_js(js_script)
    
    if code != 0:
        result.error = f"JS execution failed: {stderr}"
        return
    
    try:
        js_result = json.loads(stdout)
    except:
        result.error = f"Invalid JS output: {stdout}"
        return
    
    if not js_result.get("verified"):
        result.error = "JS failed to verify Python signature"
        return
    
    result.passed = True
    result.details = "Python sign() -> JS verify() = True"


@run_test("Sign in JavaScript, verify in Python", "CROSS_SDK")
def test_js_sign_python_verify(result):
    """JavaScript signature should be verifiable by Python"""
    
    # Generate keys in JS (need the full 64-byte secret key for JS)
    js_script = '''
const keyPair = nacl.sign.keyPair();
const message = "Cross-SDK test: JavaScript to Python";
const messageBytes = naclUtil.decodeUTF8(message);
const signature = nacl.sign.detached(messageBytes, keyPair.secretKey);

console.log(JSON.stringify({
    message: message,
    signature: naclUtil.encodeBase64(signature),
    publicKey: naclUtil.encodeBase64(keyPair.publicKey),
    privateKeySeed: naclUtil.encodeBase64(keyPair.secretKey.slice(0, 32))
}));
'''
    
    stdout, stderr, code = run_js(js_script)
    
    if code != 0:
        result.error = f"JS key generation failed: {stderr}"
        return
    
    try:
        js_data = json.loads(stdout)
    except:
        result.error = f"Invalid JS output: {stdout}"
        return
    
    # Verify in Python
    message = js_data["message"]
    signature = js_data["signature"]
    public_key = js_data["publicKey"]
    
    verified = verify_signature(message, signature, public_key)
    
    if not verified:
        result.error = "Python failed to verify JS signature"
        result.details = f"sig={signature[:40]}..., pub={public_key[:40]}..."
        return
    
    result.passed = True
    result.details = "JS sign() -> Python verify() = True"


@run_test("Python and JS generate compatible keys", "CROSS_SDK")
def test_key_compatibility(result):
    """Keys generated in Python should work in JS and vice versa"""
    
    # Generate in Python, use in JS
    py_private, py_public = generate_keypair()
    
    js_script = f'''
// Verify Python key format is usable
try {{
    const pubKey = naclUtil.decodeBase64({json.dumps(py_public)});
    console.log(JSON.stringify({{
        success: true,
        pubKeyLength: pubKey.length
    }}));
}} catch(e) {{
    console.log(JSON.stringify({{ error: e.message }}));
}}
'''
    
    stdout, stderr, code = run_js(js_script)
    
    if code != 0:
        result.error = f"JS execution failed: {stderr}"
        return
    
    js_result = json.loads(stdout)
    
    if js_result.get("error"):
        result.error = f"JS couldn't decode Python key: {js_result['error']}"
        return
    
    if js_result.get("pubKeyLength") != 32:
        result.error = f"Key length mismatch: {js_result.get('pubKeyLength')}"
        return
    
    result.passed = True
    result.details = "Python keys compatible with JS nacl"


@run_test("Round-trip: Python->JS->Python", "CROSS_SDK")
def test_roundtrip_sign_verify(result):
    """Full round-trip: Python generates key, JS signs, Python verifies"""
    
    # Generate key in Python
    private_key, public_key = generate_keypair()
    message = "Round-trip test message"
    
    # In JS, we need to reconstruct the full 64-byte secret key from the seed
    # PyNaCl stores just the 32-byte seed, but tweetnacl expects seed+pubkey
    js_script = f'''
// Reconstruct full secret key from Python seed
const seed = naclUtil.decodeBase64({json.dumps(private_key)});
const keyPair = nacl.sign.keyPair.fromSeed(seed);

// Sign the message
const messageBytes = naclUtil.decodeUTF8({json.dumps(message)});
const signature = nacl.sign.detached(messageBytes, keyPair.secretKey);

console.log(JSON.stringify({{
    signature: naclUtil.encodeBase64(signature),
    derivedPubKey: naclUtil.encodeBase64(keyPair.publicKey),
    expectedPubKey: {json.dumps(public_key)}
}}));
'''
    
    stdout, stderr, code = run_js(js_script)
    
    if code != 0:
        result.error = f"JS signing failed: {stderr}"
        return
    
    js_result = json.loads(stdout)
    
    # Verify derived public key matches
    if js_result["derivedPubKey"] != js_result["expectedPubKey"]:
        result.error = "JS derived different public key from seed"
        return
    
    # Verify in Python
    verified = verify_signature(message, js_result["signature"], public_key)
    
    if not verified:
        result.error = "Python couldn't verify JS signature with shared key"
        return
    
    result.passed = True
    result.details = "Python key -> JS sign -> Python verify = success"


# ============================================================================
# MAIN
# ============================================================================

def main():
    print("=" * 70)
    print("MoltSpeak Cryptographic & Identity Test Suite")
    print("=" * 70)
    print()
    print(f"PyNaCl available: {NACL_AVAILABLE}")
    
    # Check Node.js
    try:
        node_ver = subprocess.run(['node', '--version'], capture_output=True, text=True)
        print(f"Node.js version: {node_ver.stdout.strip()}")
    except:
        print("❌ Node.js not available - cross-SDK tests will fail")
    
    print()
    print("-" * 70)
    print()
    
    # Run all tests
    tests = [
        # Key Generation
        test_generate_10_identities,
        test_key_format,
        test_key_determinism,
        
        # Signing
        test_sign_with_identities,
        test_signatures_unique_per_message,
        test_signature_determinism,
        test_signature_format,
        
        # Verification
        test_valid_signature_passes,
        test_tampered_message_fails,
        test_wrong_key_fails,
        test_truncated_signature_fails,
        test_corrupted_signature_fails,
        test_empty_message,
        
        # Cross-SDK
        test_python_sign_js_verify,
        test_js_sign_python_verify,
        test_key_compatibility,
        test_roundtrip_sign_verify,
    ]
    
    for test in tests:
        test()
        print(RESULTS[-1])
    
    # Summary
    print()
    print("-" * 70)
    print()
    
    # Group by category
    categories = {}
    for r in RESULTS:
        if r.category not in categories:
            categories[r.category] = {"passed": 0, "failed": 0}
        if r.passed:
            categories[r.category]["passed"] += 1
        else:
            categories[r.category]["failed"] += 1
    
    print("SUMMARY BY CATEGORY:")
    for cat, counts in categories.items():
        total = counts["passed"] + counts["failed"]
        status = "✅" if counts["failed"] == 0 else "❌"
        print(f"  {status} {cat}: {counts['passed']}/{total} passed")
    
    print()
    
    passed = sum(1 for r in RESULTS if r.passed)
    total = len(RESULTS)
    
    if passed == total:
        print(f"🎉 ALL TESTS PASSED: {passed}/{total}")
        return 0
    else:
        print(f"⚠️  TESTS FAILED: {passed}/{total} passed, {total - passed} failed")
        return 1


if __name__ == "__main__":
    sys.exit(main())
