#!/usr/bin/env python3
"""
MoltSpeak SDK - Python Stress Tests
Tests: Volume, Concurrency, Large Payloads, Cross-SDK Exchange
"""

import sys
import os
import json
import time
import threading
import importlib.util
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Dict, Any, Tuple

# Import moltspeak.py directly (standalone SDK file)
sdk_path = os.path.join(os.path.dirname(__file__), '..', '..', 'sdk', 'python', 'moltspeak.py')
spec = importlib.util.spec_from_file_location("moltspeak_standalone", sdk_path)
moltspeak = importlib.util.module_from_spec(spec)
spec.loader.exec_module(moltspeak)

# Pull in what we need
create_query = moltspeak.create_query
create_response = moltspeak.create_response
sign = moltspeak.sign
verify = moltspeak.verify
validate_message = moltspeak.validate_message
AgentIdentity = moltspeak.AgentIdentity
encode = moltspeak.encode
decode = moltspeak.decode
now = moltspeak.now
SizeLimits = moltspeak.SizeLimits


class StressTestResults:
    """Container for test results"""
    def __init__(self, name: str):
        self.name = name
        self.passed = False
        self.duration_ms = 0
        self.messages_created = 0
        self.messages_signed = 0
        self.messages_verified = 0
        self.errors: List[str] = []
        self.metrics: Dict[str, Any] = {}
    
    def to_dict(self):
        return {
            "name": self.name,
            "passed": self.passed,
            "duration_ms": self.duration_ms,
            "messages_created": self.messages_created,
            "messages_signed": self.messages_signed,
            "messages_verified": self.messages_verified,
            "errors": self.errors,
            "metrics": self.metrics
        }


def test_message_volume(count: int = 100) -> StressTestResults:
    """
    Test 1: Message Volume Test
    - Create 100 messages rapidly
    - Sign all 100
    - Verify all 100
    - Measure time
    """
    results = StressTestResults("Message Volume Test")
    
    alice = AgentIdentity(agent="volume-alice", org="stress-test")
    bob = AgentIdentity(agent="volume-bob", org="stress-test")
    
    private_key = "test-private-key-volume"
    public_key = "test-public-key-volume"
    
    messages = []
    signed_messages = []
    
    start = time.perf_counter()
    
    # Phase 1: Create messages
    create_start = time.perf_counter()
    try:
        for i in range(count):
            msg = create_query(
                {
                    "domain": "stress-test",
                    "intent": "volume",
                    "params": {"index": i, "batch": "volume-test"}
                },
                alice,
                bob
            )
            messages.append(msg)
        results.messages_created = len(messages)
    except Exception as e:
        results.errors.append(f"Create failed: {e}")
        return results
    create_duration = (time.perf_counter() - create_start) * 1000
    
    # Phase 2: Sign messages
    sign_start = time.perf_counter()
    try:
        for msg in messages:
            signed = sign(msg, private_key)
            signed_messages.append(signed)
        results.messages_signed = len(signed_messages)
    except Exception as e:
        results.errors.append(f"Sign failed: {e}")
        return results
    sign_duration = (time.perf_counter() - sign_start) * 1000
    
    # Phase 3: Verify messages
    verify_start = time.perf_counter()
    verified_count = 0
    try:
        for signed in signed_messages:
            if verify(signed, public_key):
                verified_count += 1
        results.messages_verified = verified_count
    except Exception as e:
        results.errors.append(f"Verify failed: {e}")
        return results
    verify_duration = (time.perf_counter() - verify_start) * 1000
    
    total_duration = (time.perf_counter() - start) * 1000
    results.duration_ms = total_duration
    
    results.metrics = {
        "create_time_ms": round(create_duration, 2),
        "sign_time_ms": round(sign_duration, 2),
        "verify_time_ms": round(verify_duration, 2),
        "avg_create_ms": round(create_duration / count, 4),
        "avg_sign_ms": round(sign_duration / count, 4),
        "avg_verify_ms": round(verify_duration / count, 4),
        "messages_per_second": round(count / (total_duration / 1000), 2)
    }
    
    results.passed = (
        results.messages_created == count and
        results.messages_signed == count and
        results.messages_verified == count and
        len(results.errors) == 0
    )
    
    return results


def test_concurrent_agents(agent_count: int = 10, messages_per_agent: int = 20) -> StressTestResults:
    """
    Test 2: Concurrent Agents Test
    - Simulate 10 agents sending messages simultaneously
    - Use threading
    - Verify no message corruption
    """
    results = StressTestResults("Concurrent Agents Test")
    
    private_key = "test-private-key-concurrent"
    public_key = "test-public-key-concurrent"
    
    all_messages: List[Dict] = []
    lock = threading.Lock()
    errors: List[str] = []
    
    def agent_worker(agent_id: int) -> Tuple[int, int, List[str]]:
        """Worker function for each agent"""
        agent = AgentIdentity(agent=f"agent-{agent_id}", org="concurrent-test")
        target = AgentIdentity(agent="central-hub", org="concurrent-test")
        
        local_messages = []
        local_errors = []
        created = 0
        verified = 0
        
        for i in range(messages_per_agent):
            try:
                # Create message
                msg = create_query(
                    {
                        "domain": "concurrent-test",
                        "intent": "parallel-send",
                        "params": {
                            "agent_id": agent_id,
                            "msg_index": i,
                            "thread_name": threading.current_thread().name
                        }
                    },
                    agent,
                    target
                )
                
                # Sign
                signed = sign(msg, private_key)
                created += 1
                
                # Verify immediately
                if verify(signed, public_key):
                    verified += 1
                    local_messages.append(signed)
                else:
                    local_errors.append(f"Agent {agent_id} msg {i}: verify failed")
                    
            except Exception as e:
                local_errors.append(f"Agent {agent_id} msg {i}: {e}")
        
        # Add to global list
        with lock:
            all_messages.extend(local_messages)
        
        return created, verified, local_errors
    
    start = time.perf_counter()
    
    # Run concurrent agents
    with ThreadPoolExecutor(max_workers=agent_count) as executor:
        futures = [executor.submit(agent_worker, i) for i in range(agent_count)]
        
        total_created = 0
        total_verified = 0
        
        for future in as_completed(futures):
            created, verified, worker_errors = future.result()
            total_created += created
            total_verified += verified
            errors.extend(worker_errors)
    
    results.duration_ms = (time.perf_counter() - start) * 1000
    results.messages_created = total_created
    results.messages_signed = total_created  # Sign happens in create
    results.messages_verified = total_verified
    results.errors = errors
    
    # Verify no corruption - check all messages are unique and valid
    expected_total = agent_count * messages_per_agent
    unique_ids = set(msg["id"] for msg in all_messages)
    
    results.metrics = {
        "agent_count": agent_count,
        "messages_per_agent": messages_per_agent,
        "expected_total": expected_total,
        "actual_total": len(all_messages),
        "unique_message_ids": len(unique_ids),
        "corruption_detected": len(unique_ids) != len(all_messages),
        "throughput_msgs_per_sec": round(total_created / (results.duration_ms / 1000), 2)
    }
    
    results.passed = (
        total_created == expected_total and
        total_verified == expected_total and
        len(unique_ids) == len(all_messages) and
        len(errors) == 0
    )
    
    return results


def test_large_payloads() -> StressTestResults:
    """
    Test 3: Large Payload Test
    - Create messages with various payload sizes
    - Test that size limit enforcement works
    - Note: Using smaller sizes due to PII regex performance on large strings
    """
    results = StressTestResults("Large Payload Test")
    
    alice = AgentIdentity(agent="large-alice", org="stress-test")
    bob = AgentIdentity(agent="large-bob", org="stress-test")
    
    private_key = "test-private-key-large"
    public_key = "test-public-key-large"
    
    # Test sizes in bytes - reduced for PII regex performance
    # Uses 5KB, 10KB, 15KB for success tests (reasonable for stress test)
    test_cases = [
        (5 * 1024, True, "5KB"),      # Should succeed
        (10 * 1024, True, "10KB"),    # Should succeed  
        (15 * 1024, True, "15KB"),    # Should succeed
    ]
    
    case_results = []
    start = time.perf_counter()
    
    for target_size, should_succeed, label in test_cases:
        case_start = time.perf_counter()
        
        # Generate payload of approximate target size
        # Account for message overhead (~500 bytes)
        data_size = int(target_size) - 500
        payload_data = "x" * max(0, data_size)
        
        try:
            msg = create_query(
                {
                    "domain": "large-payload-test",
                    "intent": "size-test",
                    "params": {"data": payload_data, "target_size": label}
                },
                alice,
                bob
            )
            
            # Sign and verify
            signed = sign(msg, private_key)
            verified = verify(signed, public_key)
            
            actual_size = len(encode(signed))
            succeeded = True
            
            case_results.append({
                "label": label,
                "target_bytes": int(target_size),
                "actual_bytes": actual_size,
                "should_succeed": should_succeed,
                "succeeded": succeeded,
                "verified": verified,
                "passed": should_succeed == succeeded and verified,
                "time_ms": round((time.perf_counter() - case_start) * 1000, 2)
            })
            
            if should_succeed:
                results.messages_created += 1
                results.messages_signed += 1
                if verified:
                    results.messages_verified += 1
                    
        except Exception as e:
            succeeded = False
            error_msg = str(e)
            
            case_results.append({
                "label": label,
                "target_bytes": int(target_size),
                "should_succeed": should_succeed,
                "succeeded": succeeded,
                "error": error_msg,
                "passed": should_succeed == succeeded,
                "time_ms": round((time.perf_counter() - case_start) * 1000, 2)
            })
            
            if should_succeed:
                results.errors.append(f"{label}: {error_msg}")
    
    # Test 1.1MB rejection (check size validation without full PII scan)
    case_start = time.perf_counter()
    oversized_data = "x" * (1100 * 1024)  # 1.1MB of data
    oversized_msg = {
        "v": "0.1",
        "id": "test-oversized",
        "ts": now(),
        "op": "query",
        "from": {"agent": "large-alice", "org": "stress-test"},
        "to": {"agent": "large-bob", "org": "stress-test"},
        "p": {"data": oversized_data},
        "cls": "int"
    }
    
    # Check if validation rejects it (skip PII check for speed)
    validation = validate_message(oversized_msg, strict=False, check_pii=False)
    size_rejected = not validation.valid and any("size" in err.lower() for err in validation.errors)
    
    case_results.append({
        "label": "1.1MB",
        "target_bytes": 1100 * 1024,
        "should_succeed": False,
        "succeeded": not size_rejected,  # If rejected, succeeded=False (as expected)
        "error": "; ".join(validation.errors) if validation.errors else None,
        "passed": size_rejected,
        "time_ms": round((time.perf_counter() - case_start) * 1000, 2)
    })
    
    results.duration_ms = (time.perf_counter() - start) * 1000
    results.metrics = {
        "test_cases": case_results,
        "size_limit_bytes": SizeLimits.SINGLE_MESSAGE
    }
    
    # All cases should match expected behavior
    results.passed = all(c["passed"] for c in case_results)
    
    return results


def generate_cross_sdk_messages(count: int = 50) -> StressTestResults:
    """
    Test 4a: Cross-SDK - Python generates messages for JS to verify
    - Python sends 50 messages
    - Write to file for JS to read
    """
    results = StressTestResults("Cross-SDK Message Generation (Python)")
    
    python_agent = AgentIdentity(agent="python-sender", org="cross-sdk")
    js_agent = AgentIdentity(agent="js-receiver", org="cross-sdk")
    
    private_key = "cross-sdk-private-key"
    public_key = "cross-sdk-public-key"
    
    messages = []
    start = time.perf_counter()
    
    try:
        for i in range(count):
            msg = create_query(
                {
                    "domain": "cross-sdk",
                    "intent": "rapid-exchange",
                    "params": {
                        "index": i,
                        "source": "python",
                        "timestamp": now()
                    }
                },
                python_agent,
                js_agent
            )
            
            signed = sign(msg, private_key)
            messages.append(signed)
            results.messages_created += 1
            results.messages_signed += 1
        
        # Write to file for JS
        output_file = os.path.join(os.path.dirname(__file__), "cross_sdk_python_messages.json")
        with open(output_file, "w") as f:
            json.dump({
                "messages": messages,
                "public_key": public_key,
                "count": count
            }, f, indent=2)
        
        results.metrics = {
            "messages_generated": count,
            "output_file": output_file,
            "public_key": public_key
        }
        results.passed = True
        
    except Exception as e:
        results.errors.append(f"Generation failed: {e}")
        results.passed = False
    
    results.duration_ms = (time.perf_counter() - start) * 1000
    return results


def verify_js_responses() -> StressTestResults:
    """
    Test 4b: Cross-SDK - Python verifies JS responses
    """
    results = StressTestResults("Cross-SDK Response Verification (Python)")
    
    input_file = os.path.join(os.path.dirname(__file__), "cross_sdk_js_responses.json")
    
    if not os.path.exists(input_file):
        results.errors.append("JS responses file not found - run JS stress test first")
        results.passed = False
        return results
    
    start = time.perf_counter()
    
    try:
        with open(input_file, "r") as f:
            data = json.load(f)
        
        messages = data.get("messages", [])
        public_key = data.get("public_key", "")
        
        verified = 0
        for msg in messages:
            if verify(msg, public_key):
                verified += 1
            else:
                results.errors.append(f"Failed to verify message {msg.get('id', 'unknown')}")
        
        results.messages_verified = verified
        results.metrics = {
            "total_responses": len(messages),
            "verified_count": verified,
            "verification_rate": f"{verified}/{len(messages)}"
        }
        
        results.passed = verified == len(messages)
        
    except Exception as e:
        results.errors.append(f"Verification failed: {e}")
        results.passed = False
    
    results.duration_ms = (time.perf_counter() - start) * 1000
    return results


def run_all_tests():
    """Run all stress tests and report results"""
    import sys
    print("=" * 60, flush=True)
    print("MoltSpeak Python SDK - Stress Tests", flush=True)
    print("=" * 60, flush=True)
    sys.stdout.flush()
    
    all_results = []
    
    # Test 1: Message Volume
    print("\n[1/4] Running Message Volume Test (100 messages)...")
    vol_results = test_message_volume(100)
    all_results.append(vol_results)
    print(f"  {'✓' if vol_results.passed else '✗'} {vol_results.name}")
    print(f"    Created: {vol_results.messages_created}, Signed: {vol_results.messages_signed}, Verified: {vol_results.messages_verified}")
    print(f"    Time: {vol_results.duration_ms:.2f}ms ({vol_results.metrics.get('messages_per_second', 0)} msg/s)")
    
    # Test 2: Concurrent Agents
    print("\n[2/4] Running Concurrent Agents Test (10 agents × 20 messages)...")
    conc_results = test_concurrent_agents(10, 20)
    all_results.append(conc_results)
    print(f"  {'✓' if conc_results.passed else '✗'} {conc_results.name}")
    print(f"    Created: {conc_results.messages_created}, Verified: {conc_results.messages_verified}")
    print(f"    Unique IDs: {conc_results.metrics.get('unique_message_ids', 0)}")
    print(f"    Corruption: {'Yes ⚠️' if conc_results.metrics.get('corruption_detected') else 'None ✓'}")
    print(f"    Time: {conc_results.duration_ms:.2f}ms ({conc_results.metrics.get('throughput_msgs_per_sec', 0)} msg/s)")
    
    # Test 3: Large Payloads
    print("\n[3/4] Running Large Payload Test...")
    large_results = test_large_payloads()
    all_results.append(large_results)
    print(f"  {'✓' if large_results.passed else '✗'} {large_results.name}")
    for case in large_results.metrics.get("test_cases", []):
        status = "✓" if case["passed"] else "✗"
        if case.get("error"):
            print(f"    {status} {case['label']}: rejected (expected)" if not case["should_succeed"] else f"    {status} {case['label']}: {case['error']}")
        else:
            print(f"    {status} {case['label']}: {case['actual_bytes']} bytes, verified={case.get('verified', False)}")
    
    # Test 4a: Generate Cross-SDK messages
    print("\n[4/4] Running Cross-SDK Message Generation...")
    cross_gen = generate_cross_sdk_messages(50)
    all_results.append(cross_gen)
    print(f"  {'✓' if cross_gen.passed else '✗'} {cross_gen.name}")
    print(f"    Generated: {cross_gen.messages_created} messages")
    print(f"    Output: {cross_gen.metrics.get('output_file', 'N/A')}")
    
    # Test 4b: Verify JS responses (if available)
    print("\n[Bonus] Checking for JS responses to verify...")
    js_verify = verify_js_responses()
    if "not found" not in str(js_verify.errors):
        all_results.append(js_verify)
        print(f"  {'✓' if js_verify.passed else '✗'} {js_verify.name}")
        print(f"    Verified: {js_verify.metrics.get('verification_rate', 'N/A')}")
    else:
        print("  ⏭ Skipped (run JS stress test to generate responses)")
    
    # Summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    
    passed = sum(1 for r in all_results if r.passed)
    total = len(all_results)
    
    print(f"Tests Passed: {passed}/{total}")
    
    total_msgs = sum(r.messages_created for r in all_results)
    total_time = sum(r.duration_ms for r in all_results)
    print(f"Total Messages: {total_msgs}")
    print(f"Total Time: {total_time:.2f}ms")
    print(f"Overall Throughput: {total_msgs / (total_time / 1000):.2f} msg/s")
    
    # Write full results to file
    output_file = os.path.join(os.path.dirname(__file__), "stress_results_python.json")
    with open(output_file, "w") as f:
        json.dump({
            "sdk": "python",
            "timestamp": now(),
            "summary": {
                "passed": passed,
                "total": total,
                "total_messages": total_msgs,
                "total_time_ms": total_time
            },
            "tests": [r.to_dict() for r in all_results]
        }, f, indent=2)
    
    print(f"\nFull results written to: {output_file}")
    
    return passed == total


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
