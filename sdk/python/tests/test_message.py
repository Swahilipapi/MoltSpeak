"""
Tests for MoltSpeak message handling
"""
import pytest
import json
from moltspeak import (
    Message,
    MessageBuilder,
    Agent,
    AgentIdentity,
    Classification,
)
from moltspeak.message import Operation, AgentRef


class TestMessage:
    """Test Message class"""
    
    def test_create_message(self):
        """Test basic message creation"""
        msg = Message(
            operation=Operation.QUERY,
            sender=AgentRef(agent="agent-a", org="org-a"),
            recipient=AgentRef(agent="agent-b", org="org-b"),
            payload={"domain": "weather"},
            classification="pub",
        )
        
        assert msg.operation == Operation.QUERY
        assert msg.sender.agent == "agent-a"
        assert msg.recipient.agent == "agent-b"
        assert msg.message_id is not None
        assert msg.timestamp is not None
    
    def test_message_to_dict(self):
        """Test serialization to compact format"""
        msg = Message(
            operation=Operation.QUERY,
            sender=AgentRef(agent="agent-a", org="org-a"),
            recipient=AgentRef(agent="agent-b", org="org-b"),
            payload={"domain": "test"},
            classification="int",
        )
        
        d = msg.to_dict()
        
        assert d["v"] == "0.1"
        assert d["op"] == "query"
        assert d["from"]["agent"] == "agent-a"
        assert d["to"]["agent"] == "agent-b"
        assert d["cls"] == "int"
        assert "id" in d
        assert "ts" in d
    
    def test_message_round_trip(self):
        """Test serialization/deserialization round trip"""
        original = Message(
            operation=Operation.TASK,
            sender=AgentRef(agent="a", org="o"),
            recipient=AgentRef(agent="b", org="p"),
            payload={"action": "create", "task_id": "t1"},
            classification="conf",
        )
        
        json_str = original.to_json()
        restored = Message.from_json(json_str)
        
        assert restored.operation == original.operation
        assert restored.sender.agent == original.sender.agent
        assert restored.payload == original.payload
        assert restored.classification == original.classification
    
    def test_message_validation(self):
        """Test message validation"""
        # Valid message
        msg = Message(
            operation=Operation.QUERY,
            sender=AgentRef(agent="a", org="o"),
            recipient=AgentRef(agent="b", org="p"),
            payload={},
            classification="pub",
        )
        errors = msg.validate()
        assert len(errors) == 0
        
        # Invalid classification
        msg.classification = "invalid"
        errors = msg.validate()
        assert len(errors) > 0
        assert "classification" in errors[0].lower()
    
    def test_pii_requires_meta(self):
        """Test PII classification requires pii_meta"""
        msg = Message(
            operation=Operation.QUERY,
            sender=AgentRef(agent="a", org="o"),
            recipient=AgentRef(agent="b", org="p"),
            payload={},
            classification="pii",
        )
        
        errors = msg.validate()
        assert any("pii_meta" in e.lower() for e in errors)


class TestMessageBuilder:
    """Test MessageBuilder class"""
    
    def test_fluent_building(self):
        """Test fluent builder pattern"""
        msg = (
            MessageBuilder(Operation.QUERY)
            .from_agent("sender", "sender-org")
            .to_agent("recipient", "recipient-org")
            .with_payload({"domain": "test"})
            .classified_as("pub")
            .build()
        )
        
        assert msg.sender.agent == "sender"
        assert msg.recipient.agent == "recipient"
        assert msg.payload["domain"] == "test"
    
    def test_expires_in(self):
        """Test relative expiration"""
        import time
        before = int(time.time() * 1000)
        
        msg = (
            MessageBuilder(Operation.QUERY)
            .from_agent("a", "o")
            .to_agent("b", "p")
            .expires_in(60)
            .build()
        )
        
        after = int(time.time() * 1000)
        
        assert msg.expires is not None
        assert msg.expires >= before + 60000
        assert msg.expires <= after + 60000
    
    def test_pii_builder(self):
        """Test PII metadata building"""
        msg = (
            MessageBuilder(Operation.TASK)
            .from_agent("a", "o")
            .to_agent("b", "p")
            .with_payload({"action": "send"})
            .with_pii(
                types=["email", "name"],
                consent_token="token123",
                purpose="communication"
            )
            .build()
        )
        
        assert msg.classification == "pii"
        assert msg.pii_meta is not None
        assert "email" in msg.pii_meta["types"]
        assert msg.pii_meta["consent"]["proof"] == "token123"
    
    def test_capabilities_required(self):
        """Test capability requirements"""
        msg = (
            MessageBuilder(Operation.TOOL)
            .from_agent("a", "o")
            .to_agent("b", "p")
            .with_payload({"action": "invoke", "tool": "code-exec"})
            .requires_capabilities(["code.execute", "sandbox.create"])
            .build()
        )
        
        assert msg.capabilities_required == ["code.execute", "sandbox.create"]
    
    def test_missing_sender_raises(self):
        """Test that missing sender raises error"""
        builder = (
            MessageBuilder(Operation.QUERY)
            .to_agent("b", "p")
            .with_payload({})
        )
        
        with pytest.raises(ValueError, match="Sender"):
            builder.build()


class TestAgent:
    """Test Agent class"""
    
    def test_create_agent(self):
        """Test agent creation"""
        agent = Agent.create("test-agent", "test-org", capabilities=["query"])
        
        assert agent.identity.agent_id == "test-agent"
        assert agent.identity.org == "test-org"
        assert agent.identity.public_key is not None
        assert agent.identity.signing_key is not None
    
    def test_sign_message(self):
        """Test message signing"""
        agent = Agent.create("signer", "org")
        
        msg = Message(
            operation=Operation.QUERY,
            sender=AgentRef(agent="signer", org="org"),
            recipient=AgentRef(agent="other", org="other-org"),
            payload={"test": True},
            classification="pub",
        )
        
        signed = agent.sign(msg)
        
        assert signed.signature is not None
        assert signed.signature.startswith("ed25519:")
    
    def test_verify_signature(self):
        """Test signature verification"""
        agent = Agent.create("signer", "org")
        
        msg = Message(
            operation=Operation.QUERY,
            sender=AgentRef(agent="signer", org="org"),
            recipient=AgentRef(agent="other", org="other-org"),
            payload={"test": True},
            classification="pub",
        )
        
        signed = agent.sign(msg)
        
        # Verify with correct key
        is_valid = agent.verify(signed, agent.identity.public_key)
        assert is_valid
    
    def test_create_query(self):
        """Test query creation helper"""
        agent = Agent.create("qa", "org")
        
        query = agent.query(
            to_agent="weather",
            to_org="weather-org",
            domain="weather",
            intent="forecast",
            params={"loc": "NYC"},
        )
        
        assert query.operation == Operation.QUERY
        assert query.payload["domain"] == "weather"
        assert query.payload["params"]["loc"] == "NYC"
        assert query.signature is not None


class TestAgentIdentity:
    """Test AgentIdentity class"""
    
    def test_generate_identity(self):
        """Test identity generation"""
        identity = AgentIdentity.generate("agent", "org")
        
        assert identity.agent_id == "agent"
        assert identity.org == "org"
        assert len(identity.signing_key) > 0
        assert len(identity.public_key) > 0
    
    def test_public_identity(self):
        """Test public identity extraction"""
        identity = AgentIdentity.generate("agent", "org")
        pub = identity.public_identity()
        
        assert pub["agent"] == "agent"
        assert pub["org"] == "org"
        assert "key" in pub
        assert identity.signing_key not in str(pub)  # Private key not exposed
    
    def test_fingerprint(self):
        """Test fingerprint generation"""
        identity = AgentIdentity.generate("agent", "org")
        fp = identity.fingerprint()
        
        assert len(fp) == 16
        assert all(c in "0123456789abcdef" for c in fp)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
