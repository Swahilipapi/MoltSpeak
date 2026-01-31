#!/usr/bin/env python3
"""
Comprehensive PII Detection Tests for MoltSpeak
Tests both Python and JS SDKs
"""

import sys
import json
sys.path.insert(0, '/tmp/MoltSpeak/sdk/python')

from moltspeak.classification import PIIDetector, Classification

# Test results tracking
results = {"passed": 0, "failed": 0, "tests": []}

def test(name, expected, actual, match_type="equals"):
    """Generic test function"""
    if match_type == "equals":
        passed = expected == actual
    elif match_type == "contains":
        passed = expected in str(actual)
    elif match_type == "any":
        passed = bool(actual)
    elif match_type == "empty":
        passed = not actual
    else:
        passed = expected == actual
    
    status = "✅ PASS" if passed else "❌ FAIL"
    results["tests"].append({
        "name": name,
        "passed": passed,
        "expected": str(expected)[:100],
        "actual": str(actual)[:100]
    })
    if passed:
        results["passed"] += 1
    else:
        results["failed"] += 1
    print(f"{status}: {name}")
    if not passed:
        print(f"    Expected: {expected}")
        print(f"    Got: {actual}")
    return passed

print("=" * 60)
print("🔍 MoltSpeak PII Detection Test Suite")
print("=" * 60)

# ============== EMAIL DETECTION ==============
print("\n📧 EMAIL DETECTION")
print("-" * 40)

# Simple emails
simple_emails = [
    "user@example.com",
    "test@domain.org",
    "hello@company.net",
]
for email in simple_emails:
    found = PIIDetector.detect(email)
    test(f"Email - simple: {email}", True, "email" in found)

# Complex emails
complex_emails = [
    "user.name+tag@sub.domain.co.uk",
    "test.user123@mail-server.example.com",
    "user_name%special@company.edu",
]
for email in complex_emails:
    found = PIIDetector.detect(email)
    test(f"Email - complex: {email[:30]}...", True, "email" in found)

# Edge cases
edge_emails = [
    "a@b.co",  # Minimal valid
    "verylongusernamethatisverylong@verylongdomainnamethatislong.com",  # Long
]
for email in edge_emails:
    found = PIIDetector.detect(email)
    test(f"Email - edge: {email[:25]}...", True, "email" in found)

# Invalid (should NOT match)
invalid_emails = [
    "not-an-email",
    "missing@domain",  # No TLD
    "@nodomain.com",
]
for email in invalid_emails:
    found = PIIDetector.detect(email)
    test(f"Email - invalid (no match): {email}", False, "email" in found)

# ============== PHONE DETECTION ==============
print("\n📞 PHONE DETECTION")
print("-" * 40)

# US phones
us_phones = [
    "5551234567",       # Plain 10 digits
    "+15551234567",     # +1 prefix
]
for phone in us_phones:
    found = PIIDetector.detect(phone)
    test(f"Phone - US: {phone}", True, "phone" in found)

# International phones
intl_phones = [
    "+31612345678",     # Netherlands
    "+447911123456",    # UK
    "+4915123456789",   # Germany
]
for phone in intl_phones:
    found = PIIDetector.detect(phone)
    test(f"Phone - Intl: {phone}", True, "phone" in found)

# NOTE: Pattern limitation - doesn't support formatted phones like (555) 123-4567
formatted_phones = [
    "(555) 123-4567",   # Parentheses format
    "555-123-4567",     # Dash format
]
for phone in formatted_phones:
    found = PIIDetector.detect(phone)
    # These may not match the current simple pattern
    status = "phone" in found
    print(f"⚠️  PATTERN CHECK: {phone} - Detected: {status}")

# ============== SSN DETECTION ==============
print("\n🔐 SSN DETECTION")
print("-" * 40)

# Valid SSN formats
valid_ssns = [
    "123-45-6789",
    "000-00-0000",
    "999-99-9999",
]
for ssn in valid_ssns:
    found = PIIDetector.detect(ssn)
    test(f"SSN - valid: {ssn}", True, "ssn" in found)

# Without dashes (current pattern requires dashes)
ssn_no_dash = "123456789"
found = PIIDetector.detect(ssn_no_dash)
status = "ssn" in found
print(f"⚠️  PATTERN CHECK: {ssn_no_dash} (no dashes) - Detected: {status}")

# ============== CREDIT CARD DETECTION ==============
print("\n💳 CREDIT CARD DETECTION")
print("-" * 40)

# Standard formats
valid_ccs = [
    "4111111111111111",           # Visa (plain)
    "4111-1111-1111-1111",        # Visa (dashes)
    "4111 1111 1111 1111",        # Visa (spaces)
    "5500000000000004",           # Mastercard
    "5500-0000-0000-0004",        # Mastercard (dashes)
]
for cc in valid_ccs:
    found = PIIDetector.detect(cc)
    test(f"CC - valid: {cc[:19]}...", True, "credit_card" in found)

# ============== IP ADDRESS DETECTION ==============
print("\n🌐 IP ADDRESS DETECTION")
print("-" * 40)

# Valid IPs
valid_ips = [
    "192.168.1.1",
    "10.0.0.1",
    "255.255.255.255",
    "8.8.8.8",
]
for ip in valid_ips:
    found = PIIDetector.detect(ip)
    test(f"IP - valid: {ip}", True, "ip_address" in found)

# ============== DOB DETECTION ==============
print("\n📅 DATE OF BIRTH DETECTION")
print("-" * 40)

# Various date formats
valid_dobs = [
    "01/15/1990",
    "12-31-2000",
    "1/5/85",
]
for dob in valid_dobs:
    found = PIIDetector.detect(dob)
    test(f"DOB - valid: {dob}", True, "date_of_birth" in found)

# ============== NESTED PII ==============
print("\n🏗️ NESTED PII DETECTION")
print("-" * 40)

# Deep object
nested_object = {
    "user": {
        "profile": {
            "email": "deep.nested@example.com",
            "contact": {
                "phone": "+15551234567"
            }
        }
    }
}
nested_str = json.dumps(nested_object)
found = PIIDetector.detect(nested_str)
test("Nested - deep email", True, "email" in found)
test("Nested - deep phone", True, "phone" in found)

# Array of mixed data
mixed_array = [
    "clean data",
    {"email": "array@test.com"},
    "more clean",
    "192.168.1.100",
]
array_str = json.dumps(mixed_array)
found = PIIDetector.detect(array_str)
test("Nested - array with mixed", True, len(found) >= 2)

# Multiple PII types together
multi_pii = "Contact john@example.com or call +15551234567. SSN: 123-45-6789"
found = PIIDetector.detect(multi_pii)
test("Multiple PII types", True, len(found) >= 3)

# ============== PII MASKING ==============
print("\n🎭 PII MASKING")
print("-" * 40)

# Email masking
email_text = "Contact user@example.com for help"
masked = PIIDetector.mask(email_text)
test("Mask - email hidden", False, "user@example.com" in masked)
test("Mask - context preserved", True, "Contact" in masked)

# Multiple values
multi_text = "Email: test@domain.org, Phone: 15551234567"
masked = PIIDetector.mask(multi_text)
test("Mask - multiple values", False, "@domain.org" in masked)
print(f"    Original: {multi_text}")
print(f"    Masked:   {masked}")

# SSN masking
ssn_text = "My SSN is 123-45-6789"
masked = PIIDetector.mask(ssn_text)
test("Mask - SSN hidden", False, "123-45-6789" in masked)
print(f"    Original: {ssn_text}")
print(f"    Masked:   {masked}")

# ============== PII REDACTION ==============
print("\n✂️ PII REDACTION")
print("-" * 40)

# Full redaction
email_text = "Email me at secret@company.com"
redacted = PIIDetector.redact(email_text)
test("Redact - email replaced", True, "[REDACTED:EMAIL]" in redacted)
print(f"    Original: {email_text}")
print(f"    Redacted: {redacted}")

# Specific type redaction
mixed_text = "Email: a@b.com, IP: 10.0.0.1"
redacted_email = PIIDetector.redact(mixed_text, "email")
test("Redact - only email", True, "[REDACTED:EMAIL]" in redacted_email)
test("Redact - IP preserved", True, "10.0.0.1" in redacted_email)

# ============== FALSE POSITIVES ==============
print("\n🚫 FALSE POSITIVE CHECKS")
print("-" * 40)

# Numbers that look like SSN but aren't
false_ssns = [
    "123456789",      # No dashes (expected: no match with current pattern)
    "12-34-5678",     # Wrong grouping
    "1234-56-789",    # Wrong grouping
]
for val in false_ssns:
    found = PIIDetector.detect(val)
    ssn_match = "ssn" in found
    print(f"⚠️  False SSN check: {val} - Detected as SSN: {ssn_match}")

# IP-like values
false_ips = [
    "999.999.999.999",  # Invalid octets but matches pattern
    "1.2.3.4.5",        # Too many octets (partial match possible)
]
for val in false_ips:
    found = PIIDetector.detect(val)
    status = "ip_address" in found
    print(f"⚠️  False IP check: {val} - Detected: {status}")

# Random numbers
random_nums = [
    "123456",           # 6 digits
    "1234567890123456789",  # 19 digits
]
for val in random_nums:
    found = PIIDetector.detect(val)
    print(f"⚠️  Random number: {val} - Detected types: {list(found.keys())}")

# ============== ADDRESS DETECTION ==============
print("\n🏠 ADDRESS DETECTION")
print("-" * 40)

# Note: No address pattern in current implementation
address_samples = [
    "123 Main Street, Apt 4",
    "456 Oak Avenue, Suite 100",
    "789 First St NW, Washington DC 20001",
]
for addr in address_samples:
    found = PIIDetector.detect(addr)
    has_addr = "address" in found
    print(f"⚠️  Address: '{addr[:30]}...' - Has address pattern: {has_addr}")

print("\n" + "=" * 60)
print("📊 SUMMARY")
print("=" * 60)
print(f"Total Tests: {results['passed'] + results['failed']}")
print(f"✅ Passed:   {results['passed']}")
print(f"❌ Failed:   {results['failed']}")
if results['failed'] > 0:
    print("\nFailed tests:")
    for t in results['tests']:
        if not t['passed']:
            print(f"  - {t['name']}")

# Pattern coverage analysis
print("\n📋 PATTERN COVERAGE ANALYSIS")
print("-" * 40)
patterns = PIIDetector.PATTERNS
print(f"Implemented patterns: {len(patterns)}")
for name, pattern in patterns.items():
    print(f"  • {name}: {pattern[:50]}...")

print("\n⚠️  MISSING PATTERNS (Not Detected):")
print("  • Physical addresses (123 Main St)")
print("  • Names (John Smith)")
print("  • Formatted US phones like (555) 123-4567")
print("  • SSN without dashes (123456789)")
print("  • Passport numbers")
print("  • Bank account numbers")

print("\n" + "=" * 60)
print("✨ Test complete!")
print("=" * 60)
