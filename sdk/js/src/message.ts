/**
 * MoltSpeak Message handling
 */

import type { AgentRef, MessagePayload, WireMessage, PIIMetaData } from './types';
import { Operation } from './operations';

// UUID v4 implementation (browser-compatible fallback)
function uuidv4Fallback(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Use crypto.randomUUID if available, fallback otherwise
const uuidv4 = typeof crypto !== 'undefined' && crypto.randomUUID
  ? () => crypto.randomUUID()
  : uuidv4Fallback;

/**
 * Core MoltSpeak message
 */
export class Message {
  version: string = '0.1';
  messageId: string;
  timestamp: number;
  operation: Operation;
  sender: AgentRef;
  recipient: AgentRef;
  payload: MessagePayload;
  classification: string = 'int';
  signature?: string;
  replyTo?: string;
  expires?: number;
  capabilitiesRequired?: string[];
  piiMeta?: PIIMetaData;
  extensions?: Record<string, unknown>;

  constructor(params: {
    operation: Operation;
    sender: AgentRef;
    recipient: AgentRef;
    payload: MessagePayload;
    classification?: string;
    messageId?: string;
    timestamp?: number;
    signature?: string;
    replyTo?: string;
    expires?: number;
    capabilitiesRequired?: string[];
    piiMeta?: PIIMetaData;
    extensions?: Record<string, unknown>;
  }) {
    this.operation = params.operation;
    this.sender = params.sender;
    this.recipient = params.recipient;
    this.payload = params.payload;
    this.classification = params.classification || 'int';
    this.messageId = params.messageId || uuidv4();
    this.timestamp = params.timestamp || Date.now();
    this.signature = params.signature;
    this.replyTo = params.replyTo;
    this.expires = params.expires;
    this.capabilitiesRequired = params.capabilitiesRequired;
    this.piiMeta = params.piiMeta;
    this.extensions = params.extensions;
  }

  /**
   * Convert to compact wire format
   */
  toWire(): WireMessage {
    const msg: WireMessage = {
      v: this.version,
      id: this.messageId,
      ts: this.timestamp,
      op: this.operation,
      from: this.sender,
      to: this.recipient,
      p: this.payload,
      cls: this.classification,
    };

    if (this.signature) msg.sig = this.signature;
    if (this.replyTo) msg.re = this.replyTo;
    if (this.expires) msg.exp = this.expires;
    if (this.capabilitiesRequired) msg.cap = this.capabilitiesRequired;
    if (this.piiMeta) msg.pii_meta = this.piiMeta;
    if (this.extensions) msg.ext = this.extensions;

    return msg;
  }

  /**
   * Serialize to JSON
   */
  toJSON(pretty = false): string {
    return JSON.stringify(this.toWire(), null, pretty ? 2 : undefined);
  }

  /**
   * Parse from wire format
   */
  static fromWire(wire: WireMessage): Message {
    return new Message({
      operation: wire.op as Operation,
      sender: wire.from,
      recipient: wire.to,
      payload: wire.p,
      classification: wire.cls,
      messageId: wire.id,
      timestamp: wire.ts,
      signature: wire.sig,
      replyTo: wire.re,
      expires: wire.exp,
      capabilitiesRequired: wire.cap,
      piiMeta: wire.pii_meta,
      extensions: wire.ext,
    });
  }

  /**
   * Parse from JSON
   */
  static fromJSON(json: string): Message {
    return Message.fromWire(JSON.parse(json));
  }

  /**
   * Validate message structure
   */
  validate(): string[] {
    const errors: string[] = [];

    if (!this.messageId) errors.push('Message ID required');
    if (!this.timestamp) errors.push('Timestamp required');
    if (!this.operation) errors.push('Operation required');
    if (!this.sender) errors.push('Sender required');
    if (!this.recipient) errors.push('Recipient required');

    const validCls = ['pub', 'int', 'conf', 'pii', 'sec'];
    if (!validCls.includes(this.classification)) {
      errors.push(`Invalid classification: ${this.classification}`);
    }

    if (this.classification === 'pii' && !this.piiMeta) {
      errors.push('PII classification requires pii_meta');
    }

    return errors;
  }
}

/**
 * Fluent message builder
 */
export class MessageBuilder {
  private operation: Operation;
  private sender?: AgentRef;
  private recipient?: AgentRef;
  private payload: MessagePayload = {};
  private classification: string = 'int';
  private replyTo?: string;
  private expires?: number;
  private capabilities?: string[];
  private piiMeta?: PIIMetaData;
  private extensions?: Record<string, unknown>;

  constructor(operation: Operation) {
    this.operation = operation;
  }

  /**
   * Set sender agent
   */
  from(agent: string, org: string, key?: string): this {
    this.sender = { agent, org, key };
    return this;
  }

  /**
   * Set recipient agent
   */
  to(agent: string, org: string): this {
    this.recipient = { agent, org };
    return this;
  }

  /**
   * Set message payload
   */
  withPayload(payload: MessagePayload): this {
    this.payload = payload;
    return this;
  }

  /**
   * Set classification
   */
  classifiedAs(cls: string): this {
    this.classification = cls;
    return this;
  }

  /**
   * Set reply reference
   */
  inReplyTo(messageId: string): this {
    this.replyTo = messageId;
    return this;
  }

  /**
   * Set expiration (absolute timestamp)
   */
  expiresAt(timestamp: number): this {
    this.expires = timestamp;
    return this;
  }

  /**
   * Set expiration (relative seconds)
   */
  expiresIn(seconds: number): this {
    this.expires = Date.now() + seconds * 1000;
    return this;
  }

  /**
   * Set required capabilities
   */
  requiresCapabilities(caps: string[]): this {
    this.capabilities = caps;
    return this;
  }

  /**
   * Add PII metadata
   */
  withPII(types: string[], consentToken: string, purpose: string): this {
    this.classification = 'pii';
    this.piiMeta = {
      types,
      consent: {
        granted_by: '',
        purpose,
        proof: consentToken,
      },
    };
    return this;
  }

  /**
   * Add extension
   */
  withExtension(namespace: string, data: Record<string, unknown>): this {
    if (!this.extensions) this.extensions = {};
    this.extensions[namespace] = data;
    return this;
  }

  /**
   * Build the message
   */
  build(): Message {
    if (!this.sender) throw new Error('Sender is required');
    if (!this.recipient) throw new Error('Recipient is required');

    return new Message({
      operation: this.operation,
      sender: this.sender,
      recipient: this.recipient,
      payload: this.payload,
      classification: this.classification,
      replyTo: this.replyTo,
      expires: this.expires,
      capabilitiesRequired: this.capabilities,
      piiMeta: this.piiMeta,
      extensions: this.extensions,
    });
  }
}
