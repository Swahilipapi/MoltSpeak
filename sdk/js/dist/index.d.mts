/**
 * MoltSpeak Type Definitions
 */
/**
 * Reference to an agent
 */
interface AgentRef {
    agent: string;
    org: string;
    key?: string;
    enc_key?: string;
}
/**
 * Message payload (varies by operation)
 */
type MessagePayload = Record<string, unknown>;
/**
 * PII consent information
 */
interface PIIConsent {
    granted_by: string;
    purpose: string;
    proof: string;
    expires?: number;
    scope?: string;
}
/**
 * PII metadata for classified messages
 */
interface PIIMetaData {
    types: string[];
    consent: PIIConsent;
    mask_fields?: string[];
}
/**
 * Wire format message structure
 */
interface WireMessage {
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
 * Session state
 */
interface SessionState {
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

/**
 * MoltSpeak Operations
 */
/**
 * Core operation types
 */
declare enum Operation {
    HELLO = "hello",
    VERIFY = "verify",
    QUERY = "query",
    RESPOND = "respond",
    TASK = "task",
    STREAM = "stream",
    TOOL = "tool",
    CONSENT = "consent",
    ERROR = "error"
}
/**
 * Query operation payload
 */
interface Query {
    domain: string;
    intent: string;
    params?: Record<string, unknown>;
    response_format?: {
        type?: string;
        schema?: string;
        fields?: string[];
    };
    [key: string]: unknown;
}
/**
 * Response operation payload
 */
interface Respond {
    status: 'success' | 'error' | 'partial';
    data: unknown;
    schema?: string;
    [key: string]: unknown;
}
/**
 * Task operation payload
 */
interface Task {
    action: 'create' | 'status' | 'cancel' | 'complete';
    task_id: string;
    type?: string;
    description?: string;
    params?: Record<string, unknown>;
    constraints?: Record<string, unknown>;
    deadline?: number;
    priority?: 'low' | 'normal' | 'high' | 'urgent';
    callback?: {
        on_complete?: boolean;
        on_progress?: boolean;
    };
    subtasks?: Array<{
        id: string;
        type: string;
        delegate_to?: string;
        depends_on?: string[];
        params?: Record<string, unknown>;
    }>;
}
/**
 * Stream operation payload
 */
interface Stream {
    action: 'start' | 'chunk' | 'end' | 'error';
    stream_id: string;
    type?: string;
    data?: unknown;
    seq?: number;
    progress?: number;
    total_chunks?: number;
    checksum?: string;
}
/**
 * Tool operation payload
 */
interface Tool {
    action: 'invoke' | 'list' | 'describe';
    tool?: string;
    input?: Record<string, unknown>;
    timeout_ms?: number;
}
/**
 * Consent operation payload
 */
interface Consent {
    action: 'request' | 'grant' | 'revoke' | 'verify';
    data_types: string[];
    purpose: string;
    human?: string;
    duration?: 'session' | '24h' | '7d' | 'permanent';
    consent_token?: string;
}
/**
 * Error operation payload
 */
interface ErrorPayload {
    code: string;
    category: 'protocol' | 'validation' | 'auth' | 'privacy' | 'transport' | 'execution';
    message: string;
    recoverable: boolean;
    field?: string;
    suggestion?: {
        action: string;
        delay_ms?: number;
        capability?: string;
        data_types?: string[];
    };
    context?: Record<string, unknown>;
    [key: string]: unknown;
}

/**
 * MoltSpeak Message handling
 */

/**
 * Core MoltSpeak message
 */
declare class Message {
    version: string;
    messageId: string;
    timestamp: number;
    operation: Operation;
    sender: AgentRef;
    recipient: AgentRef;
    payload: MessagePayload;
    classification: string;
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
    });
    /**
     * Convert to compact wire format
     */
    toWire(): WireMessage;
    /**
     * Serialize to JSON
     */
    toJSON(pretty?: boolean): string;
    /**
     * Parse from wire format
     */
    static fromWire(wire: WireMessage): Message;
    /**
     * Parse from JSON
     */
    static fromJSON(json: string): Message;
    /**
     * Validate message structure
     */
    validate(): string[];
}
/**
 * Fluent message builder
 */
declare class MessageBuilder {
    private operation;
    private sender?;
    private recipient?;
    private payload;
    private classification;
    private replyTo?;
    private expires?;
    private capabilities?;
    private piiMeta?;
    private extensions?;
    constructor(operation: Operation);
    /**
     * Set sender agent
     */
    from(agent: string, org: string, key?: string): this;
    /**
     * Set recipient agent
     */
    to(agent: string, org: string): this;
    /**
     * Set message payload
     */
    withPayload(payload: MessagePayload): this;
    /**
     * Set classification
     */
    classifiedAs(cls: string): this;
    /**
     * Set reply reference
     */
    inReplyTo(messageId: string): this;
    /**
     * Set expiration (absolute timestamp)
     */
    expiresAt(timestamp: number): this;
    /**
     * Set expiration (relative seconds)
     */
    expiresIn(seconds: number): this;
    /**
     * Set required capabilities
     */
    requiresCapabilities(caps: string[]): this;
    /**
     * Add PII metadata
     */
    withPII(types: string[], consentToken: string, purpose: string): this;
    /**
     * Add extension
     */
    withExtension(namespace: string, data: Record<string, unknown>): this;
    /**
     * Build the message
     */
    build(): Message;
}

/**
 * MoltSpeak Agent identity and management
 */

/**
 * Agent cryptographic identity
 */
interface AgentIdentity {
    agentId: string;
    org: string;
    signingKey: string;
    publicKey: string;
    encryptionKey?: string;
    encryptionPublic?: string;
    capabilities?: string[];
}
/**
 * Main Agent class
 */
declare class Agent {
    identity: AgentIdentity;
    private sessions;
    constructor(identity: AgentIdentity);
    /**
     * Create a new agent with fresh identity
     */
    static create(agentId: string, org: string, capabilities?: string[]): Agent;
    /**
     * Load agent from identity object
     */
    static fromIdentity(identity: AgentIdentity): Agent;
    /**
     * Get public identity reference
     */
    getPublicRef(): AgentRef;
    /**
     * Sign a message
     */
    sign(message: Message): Message;
    /**
     * Verify a message signature
     */
    verify(message: Message, senderPublicKey: string): boolean;
    /**
     * Create and sign a message
     */
    createMessage(operation: Operation, toAgent: string, toOrg: string, payload: MessagePayload, options?: {
        classification?: string;
        replyTo?: string;
        expires?: number;
        capabilities?: string[];
    }): Message;
    /**
     * Create a query message
     */
    query(toAgent: string, toOrg: string, domain: string, intent: string, params?: Record<string, unknown>, options?: {
        classification?: string;
    }): Message;
    /**
     * Create a response to a message
     */
    respondTo(original: Message, status: 'success' | 'error' | 'partial', data: unknown, options?: {
        classification?: string;
    }): Message;
    /**
     * Create an error response
     */
    errorTo(original: Message, code: string, category: 'protocol' | 'validation' | 'auth' | 'privacy' | 'transport' | 'execution', message: string, recoverable?: boolean): Message;
}

/**
 * MoltSpeak Session management
 */

/**
 * Session between two agents
 */
declare class Session implements SessionState {
    sessionId: string;
    localAgent: string;
    remoteAgent: string;
    remoteOrg: string;
    remotePublicKey: string;
    sessionKey?: Uint8Array;
    capabilities: string[];
    extensions: string[];
    createdAt: number;
    expiresAt: number | null;
    lastActivity: number;
    messageCount: number;
    constructor(params: {
        sessionId: string;
        localAgent: string;
        remoteAgent: string;
        remoteOrg: string;
        remotePublicKey: string;
        capabilities?: string[];
        extensions?: string[];
        ttlSeconds?: number;
    });
    /**
     * Create a new session
     */
    static create(localAgent: string, remoteAgent: string, remoteOrg: string, remotePublicKey: string, ttlSeconds?: number): Session;
    /**
     * Check if session has expired
     */
    isExpired(): boolean;
    /**
     * Check if session is valid
     */
    isValid(): boolean;
    /**
     * Update activity timestamp
     */
    touch(): void;
    /**
     * Check if remote has capability
     */
    hasCapability(capability: string): boolean;
    /**
     * Extend session expiration
     */
    extend(ttlSeconds?: number): void;
}
/**
 * Manage multiple sessions
 */
declare class SessionManager {
    private sessions;
    private byRemote;
    maxSessions: number;
    defaultTTL: number;
    constructor(maxSessions?: number, defaultTTL?: number);
    /**
     * Create and store a new session
     */
    create(localAgent: string, remoteAgent: string, remoteOrg: string, remotePublicKey: string, ttlSeconds?: number): Session;
    /**
     * Get session by ID
     */
    get(sessionId: string): Session | null;
    /**
     * Get active session for remote agent
     */
    getForRemote(remoteAgent: string): Session | null;
    /**
     * Remove a session
     */
    remove(sessionId: string): void;
    /**
     * Cleanup expired sessions
     */
    private cleanupExpired;
    /**
     * Count active sessions
     */
    activeCount(): number;
    /**
     * List all active sessions
     */
    list(): Session[];
}

/**
 * MoltSpeak Data Classification
 */

/**
 * Classification levels
 */
declare enum Classification {
    PUBLIC = "pub",
    INTERNAL = "int",
    CONFIDENTIAL = "conf",
    PII = "pii",
    SECRET = "sec"
}
/**
 * PII metadata
 */
interface PIIMeta {
    types: string[];
    consentGrantedBy: string;
    consentPurpose: string;
    consentProof: string;
    consentExpires?: number;
    maskFields?: string[];
    scope?: string;
}
/**
 * PII pattern detection
 */
declare class PIIDetector {
    private static patterns;
    /**
     * Detect PII in text
     */
    static detect(text: string): Record<string, string[]>;
    /**
     * Check if text contains any PII
     */
    static containsPII(text: string): boolean;
    /**
     * Mask PII in text
     */
    static mask(text: string, maskChar?: string): string;
    /**
     * Redact PII in text
     */
    static redact(text: string, piiType?: string): string;
}
/**
 * Classification validation
 */
declare class ClassificationValidator {
    /**
     * Validate classification compliance
     */
    static validate(message: WireMessage): string[];
    /**
     * Check if classification allows logging
     */
    static canLog(classification: string): boolean;
    /**
     * Check if classification requires encryption
     */
    static mustEncrypt(classification: string): boolean;
}

/**
 * MoltSpeak Cryptographic utilities
 *
 * Uses TweetNaCl for Ed25519 signing and X25519 encryption.
 */
/**
 * Generate an Ed25519 signing keypair
 */
declare function generateKeyPair(): {
    privateKey: string;
    publicKey: string;
};
/**
 * Sign a message with Ed25519
 */
declare function signMessage(message: string, privateKeyB64: string): string;
/**
 * Verify an Ed25519 signature
 */
declare function verifySignature(message: string, signatureB64: string, publicKeyB64: string): boolean;
/**
 * Encrypt a message using X25519 + XSalsa20-Poly1305
 */
declare function encryptMessage(message: string, recipientPublicB64: string, senderPrivateB64: string): {
    ciphertext: string;
    nonce: string;
};
/**
 * Decrypt a message
 */
declare function decryptMessage(ciphertextB64: string, nonceB64: string, senderPublicB64: string, recipientPrivateB64: string): string | null;

/**
 * MoltSpeak Errors
 */
/**
 * Base MoltSpeak error
 */
declare class MoltSpeakError extends Error {
    code: string;
    recoverable: boolean;
    constructor(message: string, code?: string, recoverable?: boolean);
}
/**
 * Message validation failed
 */
declare class ValidationError extends MoltSpeakError {
    field?: string;
    constructor(message: string, field?: string);
}
/**
 * Signature verification failed
 */
declare class SignatureError extends MoltSpeakError {
    constructor(message?: string);
}
/**
 * Required capability not held
 */
declare class CapabilityError extends MoltSpeakError {
    capability: string;
    constructor(capability: string);
}
/**
 * PII transmitted without consent
 */
declare class ConsentError extends MoltSpeakError {
    piiTypes: string[];
    constructor(piiTypes?: string[]);
}
/**
 * Rate limit exceeded
 */
declare class RateLimitError extends MoltSpeakError {
    retryAfterMs?: number;
    constructor(retryAfterMs?: number);
}

/**
 * MoltSpeak JavaScript SDK
 *
 * Secure, efficient agent-to-agent communication.
 */

declare const VERSION = "0.1.0";

export { Agent, type AgentIdentity, type AgentRef, CapabilityError, Classification, ClassificationValidator, type Consent, ConsentError, type ErrorPayload, Message, MessageBuilder, type MessagePayload, MoltSpeakError, Operation, PIIDetector, type PIIMeta, type PIIMetaData, type Query, RateLimitError, type Respond, Session, SessionManager, SignatureError, type Stream, type Task, type Tool, VERSION, ValidationError, decryptMessage, encryptMessage, generateKeyPair, signMessage, verifySignature };
