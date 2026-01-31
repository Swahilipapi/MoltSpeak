/**
 * MoltSpeak Cryptographic utilities
 * 
 * Uses TweetNaCl for Ed25519 signing and X25519 encryption.
 */

// Check if we're in a Node.js environment with nacl available
let nacl: typeof import('tweetnacl') | null = null;
let naclUtil: typeof import('tweetnacl-util') | null = null;

try {
  // Dynamic import for environments where tweetnacl is available
  nacl = require('tweetnacl');
  naclUtil = require('tweetnacl-util');
} catch {
  // Fall back to demo implementation
}

/**
 * Generate an Ed25519 signing keypair
 */
export function generateKeyPair(): { privateKey: string; publicKey: string } {
  if (nacl && naclUtil) {
    const keyPair = nacl.sign.keyPair();
    return {
      privateKey: naclUtil.encodeBase64(keyPair.secretKey),
      publicKey: naclUtil.encodeBase64(keyPair.publicKey),
    };
  } else {
    // Demo fallback - NOT SECURE
    const privateKey = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
    const publicKey = btoa(simpleHash(privateKey));
    return { privateKey, publicKey };
  }
}

/**
 * Sign a message with Ed25519
 */
export function signMessage(message: string, privateKeyB64: string): string {
  if (nacl && naclUtil) {
    const secretKey = naclUtil.decodeBase64(privateKeyB64);
    const messageBytes = naclUtil.decodeUTF8(message);
    const signature = nacl.sign.detached(messageBytes, secretKey);
    return naclUtil.encodeBase64(signature);
  } else {
    // Demo fallback - NOT SECURE
    return btoa(simpleHash(message + privateKeyB64));
  }
}

/**
 * Verify an Ed25519 signature
 */
export function verifySignature(
  message: string,
  signatureB64: string,
  publicKeyB64: string
): boolean {
  if (nacl && naclUtil) {
    try {
      const publicKey = naclUtil.decodeBase64(publicKeyB64);
      const signature = naclUtil.decodeBase64(signatureB64);
      const messageBytes = naclUtil.decodeUTF8(message);
      return nacl.sign.detached.verify(messageBytes, signature, publicKey);
    } catch {
      return false;
    }
  } else {
    // Demo fallback - NOT SECURE
    // Just check if the signature looks valid (demo only)
    return signatureB64.length > 0;
  }
}

/**
 * Generate an X25519 encryption keypair
 */
export function generateEncryptionKeyPair(): { privateKey: string; publicKey: string } {
  if (nacl && naclUtil) {
    const keyPair = nacl.box.keyPair();
    return {
      privateKey: naclUtil.encodeBase64(keyPair.secretKey),
      publicKey: naclUtil.encodeBase64(keyPair.publicKey),
    };
  } else {
    // Demo fallback
    return generateKeyPair();
  }
}

/**
 * Encrypt a message using X25519 + XSalsa20-Poly1305
 */
export function encryptMessage(
  message: string,
  recipientPublicB64: string,
  senderPrivateB64: string
): { ciphertext: string; nonce: string } {
  if (nacl && naclUtil) {
    const senderKey = naclUtil.decodeBase64(senderPrivateB64);
    const recipientKey = naclUtil.decodeBase64(recipientPublicB64);
    const nonce = nacl.randomBytes(nacl.box.nonceLength);
    const messageBytes = naclUtil.decodeUTF8(message);
    
    const encrypted = nacl.box(messageBytes, nonce, recipientKey, senderKey);
    
    return {
      ciphertext: naclUtil.encodeBase64(encrypted),
      nonce: naclUtil.encodeBase64(nonce),
    };
  } else {
    // Demo fallback - NOT SECURE
    const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(24))));
    const ciphertext = btoa(message); // Just base64 encode (not actually encrypted!)
    return { ciphertext, nonce };
  }
}

/**
 * Decrypt a message
 */
export function decryptMessage(
  ciphertextB64: string,
  nonceB64: string,
  senderPublicB64: string,
  recipientPrivateB64: string
): string | null {
  if (nacl && naclUtil) {
    try {
      const recipientKey = naclUtil.decodeBase64(recipientPrivateB64);
      const senderKey = naclUtil.decodeBase64(senderPublicB64);
      const nonce = naclUtil.decodeBase64(nonceB64);
      const ciphertext = naclUtil.decodeBase64(ciphertextB64);
      
      const decrypted = nacl.box.open(ciphertext, nonce, senderKey, recipientKey);
      
      if (!decrypted) return null;
      return naclUtil.encodeUTF8(decrypted);
    } catch {
      return null;
    }
  } else {
    // Demo fallback
    try {
      return atob(ciphertextB64);
    } catch {
      return null;
    }
  }
}

/**
 * Generate a cryptographically random message ID
 */
export function generateMessageId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Hash a message (SHA-256)
 */
export async function hashMessage(message: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  } else {
    // Simple fallback
    return simpleHash(message);
  }
}

/**
 * Simple string hash (for demo/fallback only)
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  const result = Math.abs(hash).toString(16);
  // Pad to 32 chars
  return result.padStart(32, '0').repeat(2).substring(0, 32);
}
