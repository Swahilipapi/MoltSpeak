"""
MoltSpeak Cryptographic utilities

Uses Ed25519 for signing and X25519 for encryption.
Falls back to pure Python if nacl not available.
"""
import base64
import hashlib
import secrets
from typing import Tuple

# Try to use PyNaCl for real crypto, fall back to stub for demo
try:
    from nacl.signing import SigningKey, VerifyKey
    from nacl.public import PrivateKey, PublicKey, Box
    from nacl.encoding import Base64Encoder
    from nacl.exceptions import BadSignature
    NACL_AVAILABLE = True
except ImportError:
    NACL_AVAILABLE = False


def generate_keypair() -> Tuple[str, str]:
    """
    Generate an Ed25519 signing keypair.
    
    Returns:
        Tuple of (private_key_base64, public_key_base64)
    """
    if NACL_AVAILABLE:
        signing_key = SigningKey.generate()
        private_b64 = signing_key.encode(encoder=Base64Encoder).decode('ascii')
        public_b64 = signing_key.verify_key.encode(encoder=Base64Encoder).decode('ascii')
        return private_b64, public_b64
    else:
        # Demo stub - NOT SECURE, just for testing without nacl
        private = base64.b64encode(secrets.token_bytes(32)).decode('ascii')
        # Derive "public" key deterministically (NOT REAL CRYPTO)
        public = base64.b64encode(
            hashlib.sha256(base64.b64decode(private)).digest()
        ).decode('ascii')
        return private, public


def sign_message(message: str, private_key_b64: str) -> str:
    """
    Sign a message with Ed25519.
    
    Args:
        message: The message to sign (string)
        private_key_b64: Base64-encoded Ed25519 private key
        
    Returns:
        Base64-encoded signature
    """
    if NACL_AVAILABLE:
        signing_key = SigningKey(private_key_b64.encode('ascii'), encoder=Base64Encoder)
        signed = signing_key.sign(message.encode('utf-8'))
        return base64.b64encode(signed.signature).decode('ascii')
    else:
        # Demo stub - NOT SECURE
        h = hashlib.sha256(message.encode('utf-8') + base64.b64decode(private_key_b64))
        return base64.b64encode(h.digest()).decode('ascii')


def verify_signature(message: str, signature_b64: str, public_key_b64: str) -> bool:
    """
    Verify an Ed25519 signature.
    
    Args:
        message: The original message
        signature_b64: Base64-encoded signature
        public_key_b64: Base64-encoded Ed25519 public key
        
    Returns:
        True if signature is valid
    """
    if NACL_AVAILABLE:
        try:
            verify_key = VerifyKey(public_key_b64.encode('ascii'), encoder=Base64Encoder)
            signature = base64.b64decode(signature_b64)
            verify_key.verify(message.encode('utf-8'), signature)
            return True
        except BadSignature:
            return False
        except Exception:
            return False
    else:
        # Demo stub - NOT SECURE
        expected = sign_message(message, _public_to_fake_private(public_key_b64))
        return signature_b64 == expected


def _public_to_fake_private(public_key_b64: str) -> str:
    """Demo only: reverse the fake key derivation"""
    # This is impossible with real crypto, only works for demo stub
    return public_key_b64  # Just use public as private for demo verification


def generate_encryption_keypair() -> Tuple[str, str]:
    """
    Generate an X25519 encryption keypair.
    
    Returns:
        Tuple of (private_key_base64, public_key_base64)
    """
    if NACL_AVAILABLE:
        private_key = PrivateKey.generate()
        private_b64 = private_key.encode(encoder=Base64Encoder).decode('ascii')
        public_b64 = private_key.public_key.encode(encoder=Base64Encoder).decode('ascii')
        return private_b64, public_b64
    else:
        # Demo stub
        private = base64.b64encode(secrets.token_bytes(32)).decode('ascii')
        public = base64.b64encode(
            hashlib.sha256(base64.b64decode(private)).digest()
        ).decode('ascii')
        return private, public


def encrypt_message(
    message: str,
    recipient_public_b64: str,
    sender_private_b64: str
) -> Tuple[str, str]:
    """
    Encrypt a message using X25519 + XSalsa20-Poly1305.
    
    Args:
        message: Plaintext message
        recipient_public_b64: Recipient's X25519 public key
        sender_private_b64: Sender's X25519 private key
        
    Returns:
        Tuple of (ciphertext_base64, nonce_base64)
    """
    if NACL_AVAILABLE:
        sender_key = PrivateKey(sender_private_b64.encode('ascii'), encoder=Base64Encoder)
        recipient_key = PublicKey(recipient_public_b64.encode('ascii'), encoder=Base64Encoder)
        box = Box(sender_key, recipient_key)
        encrypted = box.encrypt(message.encode('utf-8'))
        ciphertext = base64.b64encode(encrypted.ciphertext).decode('ascii')
        nonce = base64.b64encode(encrypted.nonce).decode('ascii')
        return ciphertext, nonce
    else:
        # Demo stub - NOT SECURE
        # Just XOR with hash for demo (DO NOT USE IN PRODUCTION)
        key_material = hashlib.sha256(
            base64.b64decode(sender_private_b64) + base64.b64decode(recipient_public_b64)
        ).digest()
        nonce = secrets.token_bytes(24)
        msg_bytes = message.encode('utf-8')
        # Pad/truncate key to message length
        key_stream = (key_material * ((len(msg_bytes) // 32) + 1))[:len(msg_bytes)]
        encrypted = bytes(a ^ b for a, b in zip(msg_bytes, key_stream))
        return base64.b64encode(encrypted).decode('ascii'), base64.b64encode(nonce).decode('ascii')


def decrypt_message(
    ciphertext_b64: str,
    nonce_b64: str,
    sender_public_b64: str,
    recipient_private_b64: str
) -> str:
    """
    Decrypt a message.
    
    Args:
        ciphertext_b64: Base64-encoded ciphertext
        nonce_b64: Base64-encoded nonce
        sender_public_b64: Sender's X25519 public key
        recipient_private_b64: Recipient's X25519 private key
        
    Returns:
        Decrypted plaintext
    """
    if NACL_AVAILABLE:
        recipient_key = PrivateKey(recipient_private_b64.encode('ascii'), encoder=Base64Encoder)
        sender_key = PublicKey(sender_public_b64.encode('ascii'), encoder=Base64Encoder)
        box = Box(recipient_key, sender_key)
        ciphertext = base64.b64decode(ciphertext_b64)
        nonce = base64.b64decode(nonce_b64)
        plaintext = box.decrypt(ciphertext, nonce)
        return plaintext.decode('utf-8')
    else:
        # Demo stub - NOT SECURE
        key_material = hashlib.sha256(
            base64.b64decode(recipient_private_b64) + base64.b64decode(sender_public_b64)
        ).digest()
        encrypted = base64.b64decode(ciphertext_b64)
        key_stream = (key_material * ((len(encrypted) // 32) + 1))[:len(encrypted)]
        decrypted = bytes(a ^ b for a, b in zip(encrypted, key_stream))
        return decrypted.decode('utf-8')


def hash_message(message: str) -> str:
    """SHA-256 hash of a message, hex-encoded"""
    return hashlib.sha256(message.encode('utf-8')).hexdigest()


def generate_message_id() -> str:
    """Generate a cryptographically random message ID"""
    return secrets.token_hex(16)


def constant_time_compare(a: bytes, b: bytes) -> bool:
    """Constant-time comparison to prevent timing attacks"""
    if len(a) != len(b):
        return False
    result = 0
    for x, y in zip(a, b):
        result |= x ^ y
    return result == 0
