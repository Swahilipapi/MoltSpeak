#!/usr/bin/env python3
"""
MoltSpeak Conversation Flow Tests - Python
Tests realistic multi-turn conversation patterns with ref chaining
"""

import sys
import json
sys.path.insert(0, '/tmp/MoltSpeak/sdk/python')

from moltspeak import Message, Operation
from moltspeak.message import AgentRef

# Test tracking
results = {"passed": 0, "failed": 0, "tests": []}

def test(name, fn):
    """Run a test and track results"""
    try:
        fn()
        results["passed"] += 1
        results["tests"].append({"name": name, "status": "PASS"})
        print(f"  ✅ PASS: {name}")
        return True
    except Exception as e:
        results["failed"] += 1
        results["tests"].append({"name": name, "status": "FAIL", "error": str(e)})
        print(f"  ❌ FAIL: {name} - {e}")
        return False

# Agents
def agent_a():
    return AgentRef(agent="assistant", org="openai", key="ed25519:pk_assistant")

def agent_b():
    return AgentRef(agent="translator", org="deepl", key="ed25519:pk_translator")

# =============================================================================
# 1. SIMPLE QUERY-RESPONSE HANDSHAKE
# =============================================================================
print("\n" + "="*60)
print("1. SIMPLE QUERY-RESPONSE HANDSHAKE")
print("="*60)

def test_simple_handshake():
    """Agent A sends HELLO, Agent B responds, then query/response"""
    conversation = []
    
    # Step 1: Agent A says HELLO
    hello_a = Message(
        operation=Operation.HELLO,
        sender=agent_a(),
        recipient=agent_b(),
        payload={
            "protocol": "moltspeak",
            "version": "0.1",
            "capabilities": ["query", "task", "stream"]
        }
    )
    conversation.append(hello_a)
    assert hello_a.operation == Operation.HELLO
    assert hello_a.reply_to is None  # First message, no ref
    
    # Step 2: Agent B responds with HELLO (ref to A's hello)
    hello_b = Message(
        operation=Operation.HELLO,
        sender=agent_b(),
        recipient=agent_a(),
        reply_to=hello_a.message_id,  # Chain to A's hello
        payload={
            "protocol": "moltspeak",
            "version": "0.1",
            "capabilities": ["translate", "respond"]
        }
    )
    conversation.append(hello_b)
    assert hello_b.reply_to == hello_a.message_id  # Ref correctly chains
    
    # Step 3: Agent A sends QUERY
    query_a = Message(
        operation=Operation.QUERY,
        sender=agent_a(),
        recipient=agent_b(),
        reply_to=hello_b.message_id,  # Continue conversation
        payload={
            "domain": "translation",
            "intent": "translate",
            "params": {
                "text": "Hello, world!",
                "source_lang": "en",
                "target_lang": "es"
            }
        }
    )
    conversation.append(query_a)
    assert query_a.reply_to == hello_b.message_id
    
    # Step 4: Agent B responds
    respond_b = Message(
        operation=Operation.RESPOND,
        sender=agent_b(),
        recipient=agent_a(),
        reply_to=query_a.message_id,
        payload={
            "status": "success",
            "data": {
                "translated": "¡Hola, mundo!",
                "source_lang": "en",
                "target_lang": "es",
                "confidence": 0.98
            }
        }
    )
    conversation.append(respond_b)
    assert respond_b.reply_to == query_a.message_id
    
    # Verify complete chain
    assert len(conversation) == 4
    assert conversation[0].reply_to is None
    assert conversation[1].reply_to == conversation[0].message_id
    assert conversation[2].reply_to == conversation[1].message_id
    assert conversation[3].reply_to == conversation[2].message_id
    
    # Validate all messages
    for msg in conversation:
        errors = msg.validate()
        assert len(errors) == 0, f"Validation failed: {errors}"

test("simple handshake with query-response", test_simple_handshake)


# =============================================================================
# 2. TASK WITH STATUS UPDATES (STREAMING)
# =============================================================================
print("\n" + "="*60)
print("2. TASK WITH STATUS UPDATES (STREAMING)")
print("="*60)

def test_task_with_streaming():
    """Agent A sends TASK, Agent B streams progress updates"""
    conversation = []
    
    # Step 1: Agent A sends TASK (translate document)
    task_msg = Message(
        operation=Operation.TASK,
        sender=agent_a(),
        recipient=agent_b(),
        payload={
            "action": "translate_document",
            "params": {
                "document_id": "doc-12345",
                "document_name": "quarterly_report.pdf",
                "source_lang": "en",
                "target_lang": "de",
                "pages": 50
            },
            "async": True,
            "callback": "https://openai.example/webhooks/task"
        }
    )
    conversation.append(task_msg)
    
    # Step 2: Agent B accepts (RESPOND with status)
    accept_msg = Message(
        operation=Operation.RESPOND,
        sender=agent_b(),
        recipient=agent_a(),
        reply_to=task_msg.message_id,
        payload={
            "status": "success",
            "data": {
                "task_id": "task-abc123",
                "accepted": True,
                "estimated_time_ms": 60000,
                "message": "Task accepted, processing started"
            }
        }
    )
    conversation.append(accept_msg)
    assert accept_msg.reply_to == task_msg.message_id
    
    # Step 3: Agent B streams progress (25%)
    stream_25 = Message(
        operation=Operation.STREAM,
        sender=agent_b(),
        recipient=agent_a(),
        reply_to=task_msg.message_id,  # All streams ref original task
        payload={
            "task_id": "task-abc123",
            "seq": 1,
            "total": 4,
            "delta": {
                "progress": 25,
                "pages_processed": 12,
                "status": "processing"
            }
        }
    )
    conversation.append(stream_25)
    assert stream_25.reply_to == task_msg.message_id
    
    # Step 4: Agent B streams progress (50%)
    stream_50 = Message(
        operation=Operation.STREAM,
        sender=agent_b(),
        recipient=agent_a(),
        reply_to=task_msg.message_id,
        payload={
            "task_id": "task-abc123",
            "seq": 2,
            "total": 4,
            "delta": {
                "progress": 50,
                "pages_processed": 25,
                "status": "processing"
            }
        }
    )
    conversation.append(stream_50)
    
    # Step 5: Agent B streams progress (75%)
    stream_75 = Message(
        operation=Operation.STREAM,
        sender=agent_b(),
        recipient=agent_a(),
        reply_to=task_msg.message_id,
        payload={
            "task_id": "task-abc123",
            "seq": 3,
            "total": 4,
            "delta": {
                "progress": 75,
                "pages_processed": 37,
                "status": "processing"
            }
        }
    )
    conversation.append(stream_75)
    
    # Step 6: Final RESPOND with complete result
    complete_msg = Message(
        operation=Operation.RESPOND,
        sender=agent_b(),
        recipient=agent_a(),
        reply_to=task_msg.message_id,  # Refs original task
        payload={
            "status": "success",
            "data": {
                "task_id": "task-abc123",
                "progress": 100,
                "pages_processed": 50,
                "status": "complete",
                "result": {
                    "output_document_id": "doc-67890",
                    "output_document_name": "quarterly_report_de.pdf",
                    "word_count": 15420,
                    "processing_time_ms": 58230
                }
            }
        }
    )
    conversation.append(complete_msg)
    
    # Verify stream chain - all ref the original task
    assert all(msg.reply_to == task_msg.message_id 
               for msg in conversation[1:])
    
    # Verify sequence numbers
    stream_msgs = [m for m in conversation if m.operation == Operation.STREAM]
    seqs = [m.payload["seq"] for m in stream_msgs]
    assert seqs == [1, 2, 3]

test("task with status streaming updates", test_task_with_streaming)


# =============================================================================
# 3. ERROR RECOVERY FLOW
# =============================================================================
print("\n" + "="*60)
print("3. ERROR RECOVERY FLOW")
print("="*60)

def test_error_recovery():
    """Agent A sends invalid query, gets error, corrects and succeeds"""
    conversation = []
    
    # Step 1: Agent A sends invalid QUERY (missing required param)
    bad_query = Message(
        operation=Operation.QUERY,
        sender=agent_a(),
        recipient=agent_b(),
        payload={
            "domain": "translation",
            "intent": "translate",
            "params": {
                "text": "Hello, world!",
                # Missing target_lang - intentional error
            }
        }
    )
    conversation.append(bad_query)
    
    # Step 2: Agent B returns ERROR
    error_msg = Message(
        operation=Operation.ERROR,
        sender=agent_b(),
        recipient=agent_a(),
        reply_to=bad_query.message_id,
        payload={
            "code": "E_VALIDATION",
            "message": "Missing required parameter: target_lang",
            "details": {
                "field": "params.target_lang",
                "constraint": "required",
                "provided_params": ["text"]
            },
            "retry": True,  # Indicates client can retry with correction
            "docs": "https://deepl.example/docs/translate#parameters"
        }
    )
    conversation.append(error_msg)
    assert error_msg.reply_to == bad_query.message_id
    assert error_msg.payload["code"] == "E_VALIDATION"
    assert error_msg.payload["retry"] == True
    
    # Step 3: Agent A sends corrected QUERY
    good_query = Message(
        operation=Operation.QUERY,
        sender=agent_a(),
        recipient=agent_b(),
        reply_to=error_msg.message_id,  # Chain from error
        payload={
            "domain": "translation",
            "intent": "translate",
            "params": {
                "text": "Hello, world!",
                "source_lang": "en",
                "target_lang": "fr"  # Now provided
            }
        }
    )
    conversation.append(good_query)
    assert good_query.reply_to == error_msg.message_id
    
    # Step 4: Agent B returns success
    success_msg = Message(
        operation=Operation.RESPOND,
        sender=agent_b(),
        recipient=agent_a(),
        reply_to=good_query.message_id,
        payload={
            "status": "success",
            "data": {
                "translated": "Bonjour, le monde!",
                "source_lang": "en",
                "target_lang": "fr",
                "confidence": 0.99
            }
        }
    )
    conversation.append(success_msg)
    
    # Verify recovery chain
    assert conversation[0].reply_to is None
    assert conversation[1].reply_to == conversation[0].message_id  # error refs bad query
    assert conversation[2].reply_to == conversation[1].message_id  # correction refs error
    assert conversation[3].reply_to == conversation[2].message_id  # success refs correction

test("error recovery flow", test_error_recovery)


# =============================================================================
# 4. CONSENT FLOW (PII HANDLING)
# =============================================================================
print("\n" + "="*60)
print("4. CONSENT FLOW (PII HANDLING)")
print("="*60)

def test_consent_flow():
    """Agent A sends query with PII, Agent B requests consent, A grants, B responds"""
    conversation = []
    
    # Step 1: Agent A sends QUERY containing PII
    pii_query = Message(
        operation=Operation.QUERY,
        sender=agent_a(),
        recipient=agent_b(),
        classification="pii",  # Marked as containing PII
        payload={
            "domain": "user_profile",
            "intent": "translate_profile",
            "params": {
                "user_name": "John Doe",
                "user_email": "john.doe@example.com",
                "bio": "Software engineer from San Francisco",
                "target_lang": "ja"
            }
        },
        pii_meta={
            "types": ["name", "email", "location"],
            "consent": {
                "granted_by": "user-12345",
                "purpose": "profile translation",
                "proof": "consent-token-abc"
            },
            "mask_fields": ["user_email"]
        }
    )
    conversation.append(pii_query)
    assert pii_query.classification == "pii"
    
    # Step 2: Agent B requests additional consent (needs to store temporarily)
    consent_request = Message(
        operation=Operation.CONSENT,
        sender=agent_b(),
        recipient=agent_a(),
        reply_to=pii_query.message_id,
        classification="pii",
        payload={
            "request": True,
            "reason": "temporary_storage",
            "purpose": "Translation requires temporary storage of PII for processing",
            "duration_ms": 3600000,  # 1 hour
            "data_types": ["name", "email", "location"],
            "processing": {
                "stored": False,
                "shared": False,
                "retention_policy": "delete_after_processing"
            }
        }
    )
    conversation.append(consent_request)
    assert consent_request.reply_to == pii_query.message_id
    assert consent_request.payload["request"] == True
    
    # Step 3: Agent A grants consent
    consent_grant = Message(
        operation=Operation.CONSENT,
        sender=agent_a(),
        recipient=agent_b(),
        reply_to=consent_request.message_id,
        classification="pii",
        payload={
            "grant": True,
            "scope": {
                "data_types": ["name", "email", "location"],
                "purpose": "profile translation",
                "duration_ms": 3600000
            },
            "proof": "consent-grant-xyz789",
            "granted_by": "user-12345",
            "audit_log": True
        }
    )
    conversation.append(consent_grant)
    assert consent_grant.reply_to == consent_request.message_id
    assert consent_grant.payload["grant"] == True
    
    # Step 4: Agent B responds with translated profile
    translated_response = Message(
        operation=Operation.RESPOND,
        sender=agent_b(),
        recipient=agent_a(),
        reply_to=consent_grant.message_id,
        classification="pii",  # Response also contains PII
        payload={
            "status": "success",
            "data": {
                "translated_name": "ジョン・ドウ",
                "translated_bio": "サンフランシスコのソフトウェアエンジニア",
                "source_lang": "en",
                "target_lang": "ja"
            },
            "pii_processed": {
                "consent_proof": "consent-grant-xyz789",
                "data_deleted": True,
                "processing_completed": True
            }
        },
        pii_meta={
            "types": ["name", "location"],
            "consent": {
                "granted_by": "user-12345",
                "purpose": "profile translation",
                "proof": "consent-grant-xyz789"
            }
        }
    )
    conversation.append(translated_response)
    
    # Verify consent chain
    assert len(conversation) == 4
    assert conversation[1].reply_to == conversation[0].message_id  # consent request
    assert conversation[2].reply_to == conversation[1].message_id  # consent grant
    assert conversation[3].reply_to == conversation[2].message_id  # final response
    
    # Verify all PII messages have correct classification
    for msg in conversation:
        assert msg.classification == "pii"

test("consent flow with PII", test_consent_flow)


# =============================================================================
# 5. REF FIELD CHAIN VERIFICATION
# =============================================================================
print("\n" + "="*60)
print("5. REF FIELD CHAIN VERIFICATION")
print("="*60)

def test_ref_chain_integrity():
    """Verify ref field correctly creates message chains"""
    # Build a 10-message conversation
    messages = []
    
    # First message - no ref
    msg = Message(
        operation=Operation.HELLO,
        sender=agent_a(),
        recipient=agent_b(),
        payload={"protocol": "moltspeak", "version": "0.1"}
    )
    messages.append(msg)
    
    # Chain 9 more messages alternating senders
    ops = [Operation.HELLO, Operation.QUERY, Operation.RESPOND, 
           Operation.QUERY, Operation.STREAM, Operation.STREAM, 
           Operation.RESPOND, Operation.QUERY, Operation.RESPOND]
    
    for i, op in enumerate(ops):
        sender = agent_a() if i % 2 == 0 else agent_b()
        recipient = agent_b() if i % 2 == 0 else agent_a()
        
        msg = Message(
            operation=op,
            sender=sender,
            recipient=recipient,
            reply_to=messages[-1].message_id,  # Chain to previous
            payload={"seq": i + 1}
        )
        messages.append(msg)
    
    # Verify chain integrity
    assert messages[0].reply_to is None, "First message should have no ref"
    
    for i in range(1, len(messages)):
        assert messages[i].reply_to == messages[i-1].message_id, \
            f"Message {i} ref should point to message {i-1}"
    
    # Verify wire format contains 're' field
    for i, msg in enumerate(messages):
        wire = msg.to_dict()
        if i == 0:
            assert "re" not in wire, "First message wire should not have 're'"
        else:
            assert wire["re"] == messages[i-1].message_id, \
                f"Wire 're' field should match reply_to"

test("ref chain integrity over 10 messages", test_ref_chain_integrity)


def test_ref_roundtrip():
    """Verify ref field survives JSON serialization"""
    original = Message(
        operation=Operation.QUERY,
        sender=agent_a(),
        recipient=agent_b(),
        reply_to="previous-msg-uuid-12345",
        payload={"domain": "test"}
    )
    
    # Serialize to JSON
    json_str = original.to_json()
    
    # Parse back
    parsed = Message.from_json(json_str)
    
    # Verify ref preserved
    assert parsed.reply_to == original.reply_to
    assert parsed.reply_to == "previous-msg-uuid-12345"

test("ref field survives JSON roundtrip", test_ref_roundtrip)


# =============================================================================
# SUMMARY
# =============================================================================
print("\n" + "="*60)
print("CONVERSATION FLOW TEST SUMMARY - PYTHON")
print("="*60)
print(f"  Total: {results['passed'] + results['failed']}")
print(f"  ✅ Passed: {results['passed']}")
print(f"  ❌ Failed: {results['failed']}")
print("="*60)

# Exit with error code if any failed
sys.exit(0 if results['failed'] == 0 else 1)
