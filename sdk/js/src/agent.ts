/**
 * MoltSpeak Agent identity and management
 */

import { Message, MessageBuilder } from './message';
import { Operation, query, respond, error } from './operations';
import { generateKeyPair, signMessage, verifySignature } from './crypto';
import type { AgentRef, MessagePayload } from './types';

/**
 * Agent cryptographic identity
 */
export interface AgentIdentity {
  agentId: string;
  org: string;
  signingKey: string;  // Ed25519 private key (base64)
  publicKey: string;   // Ed25519 public key (base64)
  encryptionKey?: string;  // X25519 private key
  encryptionPublic?: string;  // X25519 public key
  capabilities?: string[];
}

/**
 * Create a new agent identity
 */
export function createIdentity(
  agentId: string,
  org: string,
  capabilities?: string[]
): AgentIdentity {
  const { privateKey, publicKey } = generateKeyPair();
  return {
    agentId,
    org,
    signingKey: privateKey,
    publicKey,
    capabilities: capabilities || [],
  };
}

/**
 * Get public-only identity (safe to share)
 */
export function publicIdentity(identity: AgentIdentity): AgentRef {
  return {
    agent: identity.agentId,
    org: identity.org,
    key: `ed25519:${identity.publicKey}`,
    enc_key: identity.encryptionPublic
      ? `x25519:${identity.encryptionPublic}`
      : undefined,
  };
}

/**
 * Get fingerprint of identity
 */
export function fingerprint(identity: AgentIdentity): string {
  // Simple hash of public key for display
  const hash = simpleHash(identity.publicKey);
  return hash.substring(0, 16);
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(16, '0');
}

/**
 * Main Agent class
 */
export class Agent {
  identity: AgentIdentity;
  private sessions: Map<string, unknown> = new Map();

  constructor(identity: AgentIdentity) {
    this.identity = identity;
  }

  /**
   * Create a new agent with fresh identity
   */
  static create(agentId: string, org: string, capabilities?: string[]): Agent {
    const identity = createIdentity(agentId, org, capabilities);
    return new Agent(identity);
  }

  /**
   * Load agent from identity object
   */
  static fromIdentity(identity: AgentIdentity): Agent {
    return new Agent(identity);
  }

  /**
   * Get public identity reference
   */
  getPublicRef(): AgentRef {
    return publicIdentity(this.identity);
  }

  /**
   * Sign a message
   */
  sign(message: Message): Message {
    // Get message dict without signature
    const wire = message.toWire();
    delete wire.sig;

    // Sign canonical JSON
    const canonical = JSON.stringify(wire, Object.keys(wire).sort());
    const signature = signMessage(canonical, this.identity.signingKey);

    message.signature = `ed25519:${signature}`;
    return message;
  }

  /**
   * Verify a message signature
   */
  verify(message: Message, senderPublicKey: string): boolean {
    if (!message.signature) return false;

    // Strip signature prefix
    let sig = message.signature;
    if (sig.startsWith('ed25519:')) {
      sig = sig.substring(8);
    }

    // Get message dict without signature
    const wire = message.toWire();
    delete wire.sig;

    // Verify against canonical JSON
    const canonical = JSON.stringify(wire, Object.keys(wire).sort());

    // Strip key prefix
    let pubKey = senderPublicKey;
    if (pubKey.startsWith('ed25519:')) {
      pubKey = pubKey.substring(8);
    }

    return verifySignature(canonical, sig, pubKey);
  }

  /**
   * Create and sign a message
   */
  createMessage(
    operation: Operation,
    toAgent: string,
    toOrg: string,
    payload: MessagePayload,
    options: {
      classification?: string;
      replyTo?: string;
      expires?: number;
      capabilities?: string[];
    } = {}
  ): Message {
    const message = new Message({
      operation,
      sender: {
        agent: this.identity.agentId,
        org: this.identity.org,
        key: `ed25519:${this.identity.publicKey}`,
      },
      recipient: { agent: toAgent, org: toOrg },
      payload,
      classification: options.classification,
      replyTo: options.replyTo,
      expires: options.expires,
      capabilitiesRequired: options.capabilities,
    });

    return this.sign(message);
  }

  /**
   * Create a query message
   */
  query(
    toAgent: string,
    toOrg: string,
    domain: string,
    intent: string,
    params?: Record<string, unknown>,
    options?: { classification?: string }
  ): Message {
    return this.createMessage(
      Operation.QUERY,
      toAgent,
      toOrg,
      query(domain, intent, params),
      options
    );
  }

  /**
   * Create a response to a message
   */
  respondTo(
    original: Message,
    status: 'success' | 'error' | 'partial',
    data: unknown,
    options?: { classification?: string }
  ): Message {
    return this.createMessage(
      Operation.RESPOND,
      original.sender.agent,
      original.sender.org,
      respond(status, data),
      { ...options, replyTo: original.messageId }
    );
  }

  /**
   * Create an error response
   */
  errorTo(
    original: Message,
    code: string,
    category: 'protocol' | 'validation' | 'auth' | 'privacy' | 'transport' | 'execution',
    message: string,
    recoverable = false
  ): Message {
    return this.createMessage(
      Operation.ERROR,
      original.sender.agent,
      original.sender.org,
      error(code, category, message, recoverable),
      { replyTo: original.messageId }
    );
  }
}
