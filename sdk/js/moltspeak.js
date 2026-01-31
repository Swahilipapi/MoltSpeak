/**
 * MoltSpeak SDK for JavaScript/Node.js
 * 
 * A reference implementation of the MoltSpeak protocol for agent-to-agent communication.
 * Zero external dependencies. Works in Node.js and browsers.
 * 
 * @version 0.1.0
 * @license MIT
 */

'use strict';

// ============================================================================
// Constants
// ============================================================================

const PROTOCOL_VERSION = '0.1';

/** Valid operation types */
const OPERATIONS = Object.freeze({
  HELLO: 'hello',
  VERIFY: 'verify',
  QUERY: 'query',
  RESPOND: 'respond',
  TASK: 'task',
  STREAM: 'stream',
  TOOL: 'tool',
  CONSENT: 'consent',
  ERROR: 'error'
});

/** Data classification levels */
const CLASSIFICATIONS = Object.freeze({
  PUBLIC: 'pub',
  INTERNAL: 'int',
  CONFIDENTIAL: 'conf',
  PII: 'pii',
  SECRET: 'sec'
});

/** Error codes */
const ERROR_CODES = Object.freeze({
  E_PARSE: 'E_PARSE',
  E_VERSION: 'E_VERSION',
  E_SCHEMA: 'E_SCHEMA',
  E_MISSING_FIELD: 'E_MISSING_FIELD',
  E_INVALID_PARAM: 'E_INVALID_PARAM',
  E_AUTH_FAILED: 'E_AUTH_FAILED',
  E_SIGNATURE: 'E_SIGNATURE',
  E_CAPABILITY: 'E_CAPABILITY',
  E_CONSENT: 'E_CONSENT',
  E_CLASSIFICATION: 'E_CLASSIFICATION',
  E_RATE_LIMIT: 'E_RATE_LIMIT',
  E_TIMEOUT: 'E_TIMEOUT',
  E_TASK_FAILED: 'E_TASK_FAILED',
  E_INTERNAL: 'E_INTERNAL'
});

/** Message size limits */
const SIZE_LIMITS = Object.freeze({
  SINGLE_MESSAGE: 1 * 1024 * 1024,     // 1 MB
  BATCH_MESSAGE: 10 * 1024 * 1024,     // 10 MB
  STREAM_CHUNK: 64 * 1024,             // 64 KB
  SESSION_TOTAL: 100 * 1024 * 1024     // 100 MB
});

// ============================================================================
// PII Detection Patterns
// ============================================================================

/**
 * PII detection patterns - regular expressions for identifying sensitive data
 */
const PII_PATTERNS = Object.freeze({
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  phone: /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
  ssn: /\b\d{3}[-]?\d{2}[-]?\d{4}\b/g,
  creditCard: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
  ipv4: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
  // Addresses (simplified - street patterns)
  address: /\b\d{1,5}\s+(?:[A-Za-z]+\s+){1,4}(?:Street|St|Avenue|Ave|Boulevard|Blvd|Road|Rd|Lane|Ln|Drive|Dr|Court|Ct|Way|Place|Pl)\b/gi,
  // Date of birth patterns
  dob: /\b(?:0?[1-9]|1[0-2])[-/](?:0?[1-9]|[12]\d|3[01])[-/](?:19|20)\d{2}\b/g
});

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate a UUID v4
 * @returns {string} A random UUID
 */
function generateUUID() {
  // Use crypto API if available, otherwise fallback to Math.random
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  // Fallback UUID generation
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Get current timestamp in milliseconds
 * @returns {number} Unix timestamp in milliseconds
 */
function now() {
  return Date.now();
}

/**
 * Deep clone an object
 * @param {*} obj - Object to clone
 * @returns {*} Cloned object
 */
function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(deepClone);
  }
  const cloned = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      cloned[key] = deepClone(obj[key]);
    }
  }
  return cloned;
}

/**
 * Calculate byte size of a string (UTF-8)
 * @param {string} str - String to measure
 * @returns {number} Byte size
 */
function byteSize(str) {
  if (typeof Buffer !== 'undefined') {
    return Buffer.byteLength(str, 'utf8');
  }
  // Browser fallback
  return new Blob([str]).size;
}

// ============================================================================
// PII Detection
// ============================================================================

/**
 * Detect PII in a string or object
 * @param {string|object} data - Data to scan for PII
 * @returns {object} Detection results with found PII types and locations
 */
function detectPII(data) {
  const results = {
    hasPII: false,
    findings: [],
    types: new Set()
  };

  const textToScan = typeof data === 'string' 
    ? data 
    : JSON.stringify(data);

  for (const [type, pattern] of Object.entries(PII_PATTERNS)) {
    // Reset regex lastIndex
    pattern.lastIndex = 0;
    const matches = textToScan.match(pattern);
    
    if (matches && matches.length > 0) {
      results.hasPII = true;
      results.types.add(type);
      results.findings.push({
        type,
        count: matches.length,
        // Don't include actual matches for privacy
        preview: `${matches.length} potential ${type} pattern(s) found`
      });
    }
  }

  results.types = Array.from(results.types);
  return results;
}

/**
 * Mask PII in a string
 * @param {string} text - Text containing potential PII
 * @param {object} options - Masking options
 * @param {string[]} [options.types] - PII types to mask (default: all)
 * @param {string} [options.maskChar='*'] - Character to use for masking
 * @returns {string} Text with PII masked
 */
function maskPII(text, options = {}) {
  const { types = Object.keys(PII_PATTERNS), maskChar = '*' } = options;
  let masked = text;

  for (const type of types) {
    const pattern = PII_PATTERNS[type];
    if (pattern) {
      pattern.lastIndex = 0;
      masked = masked.replace(pattern, (match) => {
        // Keep first and last char for context, mask the middle
        if (match.length <= 4) {
          return maskChar.repeat(match.length);
        }
        return match[0] + maskChar.repeat(match.length - 2) + match[match.length - 1];
      });
    }
  }

  return masked;
}

// ============================================================================
// Message Validation
// ============================================================================

/**
 * Validation result object
 * @typedef {object} ValidationResult
 * @property {boolean} valid - Whether the message is valid
 * @property {string[]} errors - List of validation errors
 * @property {string[]} warnings - List of warnings (non-fatal issues)
 */

/**
 * Validate an MoltSpeak message
 * @param {object} message - Message to validate
 * @param {object} options - Validation options
 * @param {boolean} [options.strict=true] - Strict mode (all required fields)
 * @param {boolean} [options.checkPII=true] - Check for untagged PII
 * @returns {ValidationResult} Validation result
 */
function validateMessage(message, options = {}) {
  const { strict = true, checkPII = true } = options;
  const result = {
    valid: true,
    errors: [],
    warnings: []
  };

  // Must be an object
  if (!message || typeof message !== 'object') {
    result.valid = false;
    result.errors.push('Message must be a non-null object');
    return result;
  }

  // Required fields check
  const requiredFields = ['v', 'id', 'ts', 'op'];
  if (strict) {
    requiredFields.push('from', 'cls');
  }

  for (const field of requiredFields) {
    if (message[field] === undefined || message[field] === null) {
      result.valid = false;
      result.errors.push(`Missing required field: ${field}`);
    }
  }

  // Version check
  if (message.v && message.v !== PROTOCOL_VERSION) {
    result.warnings.push(`Protocol version mismatch: expected ${PROTOCOL_VERSION}, got ${message.v}`);
  }

  // Operation check
  if (message.op && !Object.values(OPERATIONS).includes(message.op)) {
    result.warnings.push(`Unknown operation: ${message.op}`);
  }

  // Classification check
  if (message.cls && !Object.values(CLASSIFICATIONS).includes(message.cls)) {
    result.valid = false;
    result.errors.push(`Invalid classification: ${message.cls}. Must be one of: ${Object.values(CLASSIFICATIONS).join(', ')}`);
  }

  // Timestamp validation
  if (message.ts) {
    if (typeof message.ts !== 'number') {
      result.valid = false;
      result.errors.push('Timestamp (ts) must be a number');
    } else if (message.ts < 0) {
      result.valid = false;
      result.errors.push('Timestamp (ts) must be positive');
    } else {
      // Reject messages older than 5 minutes (replay attack prevention)
      const MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes
      const messageAge = now() - message.ts;
      if (messageAge > MAX_AGE_MS) {
        result.valid = false;
        result.errors.push(`Message timestamp too old: ${Math.floor(messageAge / 1000)}s ago (max ${MAX_AGE_MS / 1000}s)`);
      }
    }
  }

  // ID format check (should be UUID-like)
  if (message.id && typeof message.id === 'string') {
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(message.id)) {
      result.warnings.push('Message ID should be a valid UUID format');
    }
  }

  // From field structure
  if (message.from && typeof message.from === 'object') {
    if (!message.from.agent) {
      result.warnings.push('from.agent is recommended');
    }
  }

  // To field structure
  if (message.to && typeof message.to === 'object') {
    if (!message.to.agent) {
      result.warnings.push('to.agent is recommended');
    }
  }

  // Size check
  const messageStr = JSON.stringify(message);
  const size = byteSize(messageStr);
  if (size > SIZE_LIMITS.SINGLE_MESSAGE) {
    result.valid = false;
    result.errors.push(`Message exceeds size limit: ${size} bytes > ${SIZE_LIMITS.SINGLE_MESSAGE} bytes`);
  }

  // PII check (if not already tagged as PII classification)
  if (checkPII && message.cls !== CLASSIFICATIONS.PII) {
    const piiResult = detectPII(message.p || {});
    if (piiResult.hasPII) {
      result.valid = false;
      result.errors.push(`PII detected without consent: ${piiResult.types.join(', ')}. Set cls to 'pii' with consent metadata.`);
    }
  }

  // Expiry check
  if (message.exp) {
    if (typeof message.exp !== 'number') {
      result.valid = false;
      result.errors.push('Expiry (exp) must be a number');
    } else if (message.exp < now()) {
      result.warnings.push('Message has expired');
    }
  }

  return result;
}

/**
 * Validate an envelope
 * @param {object} envelope - Envelope to validate
 * @returns {ValidationResult} Validation result
 */
function validateEnvelope(envelope) {
  const result = {
    valid: true,
    errors: [],
    warnings: []
  };

  if (!envelope || typeof envelope !== 'object') {
    result.valid = false;
    result.errors.push('Envelope must be a non-null object');
    return result;
  }

  // Check moltspeak version
  if (!envelope.moltspeak) {
    result.valid = false;
    result.errors.push('Missing moltspeak version in envelope');
  }

  // Check envelope metadata
  if (!envelope.envelope && !envelope.ciphertext) {
    result.valid = false;
    result.errors.push('Envelope must contain either envelope metadata or ciphertext');
  }

  // If encrypted, check required fields
  if (envelope.envelope && envelope.envelope.encrypted) {
    if (!envelope.ciphertext) {
      result.valid = false;
      result.errors.push('Encrypted envelope missing ciphertext');
    }
    if (!envelope.envelope.algorithm) {
      result.valid = false;
      result.errors.push('Encrypted envelope missing algorithm');
    }
  }

  // If not encrypted, check for message
  if (envelope.envelope && !envelope.envelope.encrypted && !envelope.message) {
    result.valid = false;
    result.errors.push('Unencrypted envelope missing message');
  }

  return result;
}

// ============================================================================
// Message Building
// ============================================================================

/**
 * Agent identity object
 * @typedef {object} AgentIdentity
 * @property {string} agent - Agent identifier
 * @property {string} [org] - Organization
 * @property {string} [key] - Public signing key
 * @property {string} [enc_key] - Public encryption key
 */

/**
 * Message builder class for fluent message construction
 */
class MessageBuilder {
  /**
   * Create a new MessageBuilder
   * @param {string} operation - The operation type
   */
  constructor(operation) {
    this._message = {
      v: PROTOCOL_VERSION,
      id: generateUUID(),
      ts: now(),
      op: operation,
      cls: CLASSIFICATIONS.INTERNAL // Default classification
    };
  }

  /**
   * Set the sender
   * @param {AgentIdentity} from - Sender identity
   * @returns {MessageBuilder} This builder for chaining
   */
  from(from) {
    this._message.from = from;
    return this;
  }

  /**
   * Set the recipient
   * @param {AgentIdentity} to - Recipient identity
   * @returns {MessageBuilder} This builder for chaining
   */
  to(to) {
    this._message.to = to;
    return this;
  }

  /**
   * Set the payload
   * @param {object} payload - Message payload
   * @returns {MessageBuilder} This builder for chaining
   */
  payload(payload) {
    this._message.p = payload;
    return this;
  }

  /**
   * Set the classification
   * @param {string} cls - Classification level
   * @param {object} [piiMeta] - PII metadata (if cls is 'pii')
   * @returns {MessageBuilder} This builder for chaining
   */
  classification(cls, piiMeta = null) {
    this._message.cls = cls;
    if (cls === CLASSIFICATIONS.PII && piiMeta) {
      this._message.pii_meta = piiMeta;
    }
    return this;
  }

  /**
   * Set reply-to reference
   * @param {string} messageId - Original message ID
   * @returns {MessageBuilder} This builder for chaining
   */
  replyTo(messageId) {
    this._message.re = messageId;
    return this;
  }

  /**
   * Set message expiry
   * @param {number} expiryMs - Expiry timestamp in milliseconds
   * @returns {MessageBuilder} This builder for chaining
   */
  expiresAt(expiryMs) {
    this._message.exp = expiryMs;
    return this;
  }

  /**
   * Set message expiry as duration from now
   * @param {number} durationMs - Duration in milliseconds
   * @returns {MessageBuilder} This builder for chaining
   */
  expiresIn(durationMs) {
    this._message.exp = now() + durationMs;
    return this;
  }

  /**
   * Set required capabilities
   * @param {string[]} caps - Required capabilities
   * @returns {MessageBuilder} This builder for chaining
   */
  requireCapabilities(caps) {
    this._message.cap = caps;
    return this;
  }

  /**
   * Add extensions
   * @param {object} extensions - Extension data (namespaced)
   * @returns {MessageBuilder} This builder for chaining
   */
  extensions(extensions) {
    this._message.ext = extensions;
    return this;
  }

  /**
   * Build the message
   * @param {object} options - Build options
   * @param {boolean} [options.validate=true] - Validate before returning
   * @returns {object} The built message
   * @throws {Error} If validation fails
   */
  build(options = {}) {
    const { validate = true } = options;
    
    if (validate) {
      const result = validateMessage(this._message, { strict: false });
      if (!result.valid) {
        throw new Error(`Invalid message: ${result.errors.join('; ')}`);
      }
    }

    return deepClone(this._message);
  }
}

// ============================================================================
// Message Factory Functions
// ============================================================================

/**
 * Create a new message builder
 * @param {string} operation - Operation type
 * @returns {MessageBuilder} A new message builder
 */
function createMessage(operation) {
  return new MessageBuilder(operation);
}

/**
 * Create a HELLO message for handshake
 * @param {AgentIdentity} identity - Agent identity
 * @param {object} capabilities - Agent capabilities
 * @returns {object} HELLO message
 */
function createHello(identity, capabilities = {}) {
  return createMessage(OPERATIONS.HELLO)
    .from(identity)
    .payload({
      protocol_versions: [PROTOCOL_VERSION],
      capabilities: capabilities.operations || ['query', 'respond'],
      extensions: capabilities.extensions || [],
      max_message_size: SIZE_LIMITS.SINGLE_MESSAGE,
      supported_cls: Object.values(CLASSIFICATIONS)
    })
    .classification(CLASSIFICATIONS.INTERNAL)
    .build();
}

/**
 * Create a QUERY message
 * @param {object} query - Query parameters
 * @param {string} query.domain - Query domain
 * @param {string} query.intent - Query intent
 * @param {object} [query.params] - Query parameters
 * @param {AgentIdentity} from - Sender identity
 * @param {AgentIdentity} to - Recipient identity
 * @returns {object} QUERY message
 */
function createQuery(query, from, to) {
  return createMessage(OPERATIONS.QUERY)
    .from(from)
    .to(to)
    .payload(query)
    .classification(CLASSIFICATIONS.INTERNAL)
    .build();
}

/**
 * Create a RESPOND message
 * @param {string} replyToId - Original message ID
 * @param {object} response - Response data
 * @param {AgentIdentity} from - Sender identity
 * @param {AgentIdentity} to - Recipient identity
 * @returns {object} RESPOND message
 */
function createResponse(replyToId, response, from, to) {
  return createMessage(OPERATIONS.RESPOND)
    .from(from)
    .to(to)
    .replyTo(replyToId)
    .payload({
      status: 'success',
      data: response
    })
    .classification(CLASSIFICATIONS.INTERNAL)
    .build();
}

/**
 * Create a TASK message
 * @param {object} task - Task definition
 * @param {AgentIdentity} from - Sender identity
 * @param {AgentIdentity} to - Recipient identity
 * @returns {object} TASK message
 */
function createTask(task, from, to) {
  const taskPayload = {
    action: 'create',
    task_id: task.id || `task-${generateUUID().slice(0, 8)}`,
    type: task.type || 'general',
    description: task.description,
    constraints: task.constraints || {},
    priority: task.priority || 'normal'
  };

  if (task.deadline) {
    taskPayload.deadline = task.deadline;
  }

  if (task.callback) {
    taskPayload.callback = task.callback;
  }

  return createMessage(OPERATIONS.TASK)
    .from(from)
    .to(to)
    .payload(taskPayload)
    .classification(CLASSIFICATIONS.INTERNAL)
    .build();
}

/**
 * Create an ERROR message
 * @param {string} replyToId - Original message ID that caused the error
 * @param {object} error - Error details
 * @param {string} error.code - Error code
 * @param {string} error.message - Error message
 * @param {AgentIdentity} from - Sender identity
 * @param {AgentIdentity} to - Recipient identity
 * @returns {object} ERROR message
 */
function createError(replyToId, error, from, to) {
  return createMessage(OPERATIONS.ERROR)
    .from(from)
    .to(to)
    .replyTo(replyToId)
    .payload({
      code: error.code || ERROR_CODES.E_INTERNAL,
      category: error.category || 'execution',
      message: error.message,
      field: error.field,
      recoverable: error.recoverable ?? true,
      suggestion: error.suggestion
    })
    .classification(CLASSIFICATIONS.INTERNAL)
    .build();
}

// ============================================================================
// Envelope Functions
// ============================================================================

/**
 * Wrap a message in an envelope
 * @param {object} message - Message to wrap
 * @param {object} options - Envelope options
 * @param {boolean} [options.compressed=false] - Whether to compress
 * @returns {object} Envelope containing the message
 */
function wrapInEnvelope(message, options = {}) {
  return {
    moltspeak: PROTOCOL_VERSION,
    envelope: {
      encrypted: false,
      compressed: options.compressed || false,
      encoding: 'utf-8'
    },
    message
  };
}

/**
 * Unwrap a message from an envelope
 * @param {object} envelope - Envelope to unwrap
 * @returns {object} The contained message
 * @throws {Error} If envelope is invalid or encrypted
 */
function unwrapEnvelope(envelope) {
  const validation = validateEnvelope(envelope);
  if (!validation.valid) {
    throw new Error(`Invalid envelope: ${validation.errors.join('; ')}`);
  }

  if (envelope.envelope && envelope.envelope.encrypted) {
    throw new Error('Cannot unwrap encrypted envelope without decryption key');
  }

  return envelope.message;
}

// ============================================================================
// Encoding/Decoding
// ============================================================================

/**
 * Encode a message to JSON string
 * @param {object} message - Message to encode
 * @param {object} options - Encoding options
 * @param {boolean} [options.pretty=false] - Pretty print
 * @param {boolean} [options.envelope=false] - Wrap in envelope
 * @returns {string} JSON encoded message
 */
function encode(message, options = {}) {
  const { pretty = false, envelope = false } = options;
  
  const data = envelope ? wrapInEnvelope(message) : message;
  
  return pretty 
    ? JSON.stringify(data, null, 2)
    : JSON.stringify(data);
}

/**
 * Decode a JSON string to message
 * @param {string} json - JSON string to decode
 * @param {object} options - Decoding options
 * @param {boolean} [options.validate=true] - Validate after decoding
 * @param {boolean} [options.unwrapEnvelope=true] - Unwrap if envelope
 * @returns {object} Decoded message
 * @throws {Error} If JSON is invalid or validation fails
 */
function decode(json, options = {}) {
  const { validate = true, unwrapEnvelope: unwrap = true } = options;
  
  let data;
  try {
    data = JSON.parse(json);
  } catch (e) {
    throw new Error(`Invalid JSON: ${e.message}`);
  }

  // Check if it's an envelope
  let message;
  if (data.moltspeak && data.envelope) {
    if (unwrap) {
      message = unwrapEnvelope(data);
    } else {
      return data;
    }
  } else {
    message = data;
  }

  if (validate) {
    const result = validateMessage(message, { strict: false, checkPII: false });
    if (!result.valid) {
      throw new Error(`Invalid message: ${result.errors.join('; ')}`);
    }
  }

  return message;
}

// ============================================================================
// Signing (Placeholder - actual crypto implementation would go here)
// ============================================================================

/**
 * Sign a message (placeholder - requires actual crypto implementation)
 * @param {object} message - Message to sign
 * @param {string} privateKey - Private key for signing (ed25519 format expected)
 * @returns {object} Message with signature
 */
function sign(message, privateKey) {
  // NOTE: This is a placeholder. In production, use actual Ed25519 signing.
  // The real implementation would:
  // 1. Serialize message deterministically (sorted keys)
  // 2. Sign with Ed25519 private key
  // 3. Encode signature as base64
  
  if (!privateKey) {
    throw new Error('Private key required for signing');
  }

  const msgCopy = deepClone(message);
  
  // Create a deterministic string representation
  const sortedKeys = Object.keys(msgCopy).filter(k => k !== 'sig').sort();
  const payload = sortedKeys.map(k => JSON.stringify(msgCopy[k])).join('|');
  
  // Placeholder signature (in reality, use proper Ed25519)
  // This creates a mock signature for testing purposes
  const mockSig = Buffer && Buffer.from 
    ? Buffer.from(payload).toString('base64').slice(0, 64)
    : btoa(payload).slice(0, 64);
  
  msgCopy.sig = `ed25519:${mockSig}`;
  
  return msgCopy;
}

/**
 * Verify a message signature (placeholder - requires actual crypto implementation)
 * @param {object} message - Signed message to verify
 * @param {string} publicKey - Public key for verification
 * @returns {boolean} Whether signature is valid
 */
function verify(message, publicKey) {
  // NOTE: This is a placeholder. In production, use actual Ed25519 verification.
  
  if (!message.sig) {
    return false;
  }

  if (!publicKey) {
    throw new Error('Public key required for verification');
  }

  // In a real implementation, this would:
  // 1. Extract signature from message
  // 2. Serialize message deterministically (same as signing)
  // 3. Verify signature with Ed25519 public key
  
  // Placeholder: just check signature format
  return message.sig.startsWith('ed25519:') && message.sig.length > 16;
}

// ============================================================================
// Natural Language Encoding (for CLI)
// ============================================================================

/**
 * Parse natural language into a structured message
 * This is a simplified parser - extend as needed
 * @param {string} text - Natural language text
 * @param {AgentIdentity} from - Sender identity
 * @returns {object} Structured MoltSpeak message
 */
function parseNaturalLanguage(text, from) {
  const lower = text.toLowerCase().trim();
  
  // Detect query patterns
  if (lower.startsWith('query ') || lower.startsWith('ask ') || lower.startsWith('what is ')) {
    const query = text.replace(/^(query|ask|what is)\s+/i, '');
    return createQuery(
      { domain: 'general', intent: 'information', params: { query } },
      from,
      { agent: 'unknown' }
    );
  }
  
  // Detect task patterns
  if (lower.startsWith('do ') || lower.startsWith('task ') || lower.startsWith('please ')) {
    const description = text.replace(/^(do|task|please)\s+/i, '');
    return createTask(
      { description, type: 'general' },
      from,
      { agent: 'unknown' }
    );
  }
  
  // Default: treat as query
  return createQuery(
    { domain: 'general', intent: 'natural', params: { text } },
    from,
    { agent: 'unknown' }
  );
}

/**
 * Convert a structured message to natural language description
 * @param {object} message - MoltSpeak message
 * @returns {string} Natural language description
 */
function toNaturalLanguage(message) {
  const op = message.op;
  const p = message.p || {};
  const from = message.from?.agent || 'unknown agent';
  const to = message.to?.agent || 'unknown recipient';
  
  switch (op) {
    case OPERATIONS.HELLO:
      return `${from} initiates handshake with capabilities: ${(p.capabilities || []).join(', ')}`;
    
    case OPERATIONS.QUERY:
      if (p.params?.text) {
        return `${from} asks ${to}: "${p.params.text}"`;
      }
      return `${from} queries ${to} about ${p.domain || 'unknown domain'}: ${p.intent || 'unknown intent'}`;
    
    case OPERATIONS.RESPOND:
      return `${from} responds to ${to}: ${JSON.stringify(p.data || p)}`;
    
    case OPERATIONS.TASK:
      return `${from} assigns task to ${to}: "${p.description || 'unknown task'}" (priority: ${p.priority || 'normal'})`;
    
    case OPERATIONS.ERROR:
      return `${from} reports error to ${to}: [${p.code}] ${p.message}`;
    
    case OPERATIONS.CONSENT:
      return `${from} requests consent from ${to} for: ${(p.data_types || []).join(', ')}`;
    
    default:
      return `${from} sends ${op} to ${to}`;
  }
}

// ============================================================================
// Exports
// ============================================================================

module.exports = {
  // Constants
  PROTOCOL_VERSION,
  OPERATIONS,
  CLASSIFICATIONS,
  ERROR_CODES,
  SIZE_LIMITS,
  PII_PATTERNS,

  // Utilities
  generateUUID,
  now,
  deepClone,
  byteSize,

  // PII
  detectPII,
  maskPII,

  // Validation
  validateMessage,
  validateEnvelope,

  // Message Building
  MessageBuilder,
  createMessage,
  createHello,
  createQuery,
  createResponse,
  createTask,
  createError,

  // Envelope
  wrapInEnvelope,
  unwrapEnvelope,

  // Encoding/Decoding
  encode,
  decode,

  // Signing
  sign,
  verify,

  // Natural Language
  parseNaturalLanguage,
  toNaturalLanguage
};
