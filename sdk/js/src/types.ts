/**
 * MoltSpeak Type Definitions
 */

/**
 * Reference to an agent
 */
export interface AgentRef {
  agent: string;
  org: string;
  key?: string;
  enc_key?: string;
}

/**
 * Message payload (varies by operation)
 */
export type MessagePayload = Record<string, unknown>;

/**
 * PII consent information
 */
export interface PIIConsent {
  granted_by: string;
  purpose: string;
  proof: string;
  expires?: number;
  scope?: string;
}

/**
 * PII metadata for classified messages
 */
export interface PIIMetaData {
  types: string[];
  consent: PIIConsent;
  mask_fields?: string[];
}

/**
 * Wire format message structure
 */
export interface WireMessage {
  v: string;
  id: string;
  ts: number;
  op: string;
  from: AgentRef;
  to: AgentRef;
  p: MessagePayload;
  cls: string;
  sig?: string;
  re?: string;
  exp?: number;
  cap?: string[];
  pii_meta?: PIIMetaData;
  ext?: Record<string, unknown>;
}

/**
 * Envelope structure for transport
 */
export interface Envelope {
  moltspeak: string;
  envelope: {
    encrypted: boolean;
    compressed?: boolean;
    encoding?: string;
    algorithm?: string;
    sender_public?: string;
    nonce?: string;
  };
  message?: WireMessage;
  ciphertext?: string;
}

/**
 * Error suggestion
 */
export interface ErrorSuggestion {
  action: string;
  delay_ms?: number;
  capability?: string;
  data_types?: string[];
}

/**
 * Session state
 */
export interface SessionState {
  sessionId: string;
  localAgent: string;
  remoteAgent: string;
  remoteOrg: string;
  remotePublicKey: string;
  capabilities: string[];
  extensions: string[];
  createdAt: number;
  expiresAt: number | null;
  lastActivity: number;
  messageCount: number;
}
