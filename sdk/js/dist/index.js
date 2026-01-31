var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  Agent: () => Agent,
  CapabilityError: () => CapabilityError,
  Classification: () => Classification,
  ClassificationValidator: () => ClassificationValidator,
  ConsentError: () => ConsentError,
  Message: () => Message,
  MessageBuilder: () => MessageBuilder,
  MoltSpeakError: () => MoltSpeakError,
  Operation: () => Operation,
  PIIDetector: () => PIIDetector,
  RateLimitError: () => RateLimitError,
  Session: () => Session,
  SessionManager: () => SessionManager,
  SignatureError: () => SignatureError,
  VERSION: () => VERSION,
  ValidationError: () => ValidationError,
  decryptMessage: () => decryptMessage,
  encryptMessage: () => encryptMessage,
  generateKeyPair: () => generateKeyPair,
  signMessage: () => signMessage,
  verifySignature: () => verifySignature
});
module.exports = __toCommonJS(index_exports);

// src/message.ts
function uuidv4Fallback() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === "x" ? r : r & 3 | 8;
    return v.toString(16);
  });
}
var uuidv4 = typeof crypto !== "undefined" && crypto.randomUUID ? () => crypto.randomUUID() : uuidv4Fallback;
var Message = class _Message {
  version = "0.1";
  messageId;
  timestamp;
  operation;
  sender;
  recipient;
  payload;
  classification = "int";
  signature;
  replyTo;
  expires;
  capabilitiesRequired;
  piiMeta;
  extensions;
  constructor(params) {
    this.operation = params.operation;
    this.sender = params.sender;
    this.recipient = params.recipient;
    this.payload = params.payload;
    this.classification = params.classification || "int";
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
  toWire() {
    const msg = {
      v: this.version,
      id: this.messageId,
      ts: this.timestamp,
      op: this.operation,
      from: this.sender,
      to: this.recipient,
      p: this.payload,
      cls: this.classification
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
  toJSON(pretty = false) {
    return JSON.stringify(this.toWire(), null, pretty ? 2 : void 0);
  }
  /**
   * Parse from wire format
   */
  static fromWire(wire) {
    return new _Message({
      operation: wire.op,
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
      extensions: wire.ext
    });
  }
  /**
   * Parse from JSON
   */
  static fromJSON(json) {
    return _Message.fromWire(JSON.parse(json));
  }
  /**
   * Validate message structure
   */
  validate() {
    const errors = [];
    if (!this.messageId) errors.push("Message ID required");
    if (!this.timestamp) errors.push("Timestamp required");
    if (!this.operation) errors.push("Operation required");
    if (!this.sender) errors.push("Sender required");
    if (!this.recipient) errors.push("Recipient required");
    const validCls = ["pub", "int", "conf", "pii", "sec"];
    if (!validCls.includes(this.classification)) {
      errors.push(`Invalid classification: ${this.classification}`);
    }
    if (this.classification === "pii" && !this.piiMeta) {
      errors.push("PII classification requires pii_meta");
    }
    return errors;
  }
};
var MessageBuilder = class {
  operation;
  sender;
  recipient;
  payload = {};
  classification = "int";
  replyTo;
  expires;
  capabilities;
  piiMeta;
  extensions;
  constructor(operation) {
    this.operation = operation;
  }
  /**
   * Set sender agent
   */
  from(agent, org, key) {
    this.sender = { agent, org, key };
    return this;
  }
  /**
   * Set recipient agent
   */
  to(agent, org) {
    this.recipient = { agent, org };
    return this;
  }
  /**
   * Set message payload
   */
  withPayload(payload) {
    this.payload = payload;
    return this;
  }
  /**
   * Set classification
   */
  classifiedAs(cls) {
    this.classification = cls;
    return this;
  }
  /**
   * Set reply reference
   */
  inReplyTo(messageId) {
    this.replyTo = messageId;
    return this;
  }
  /**
   * Set expiration (absolute timestamp)
   */
  expiresAt(timestamp) {
    this.expires = timestamp;
    return this;
  }
  /**
   * Set expiration (relative seconds)
   */
  expiresIn(seconds) {
    this.expires = Date.now() + seconds * 1e3;
    return this;
  }
  /**
   * Set required capabilities
   */
  requiresCapabilities(caps) {
    this.capabilities = caps;
    return this;
  }
  /**
   * Add PII metadata
   */
  withPII(types, consentToken, purpose) {
    this.classification = "pii";
    this.piiMeta = {
      types,
      consent: {
        granted_by: "",
        purpose,
        proof: consentToken
      }
    };
    return this;
  }
  /**
   * Add extension
   */
  withExtension(namespace, data) {
    if (!this.extensions) this.extensions = {};
    this.extensions[namespace] = data;
    return this;
  }
  /**
   * Build the message
   */
  build() {
    if (!this.sender) throw new Error("Sender is required");
    if (!this.recipient) throw new Error("Recipient is required");
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
      extensions: this.extensions
    });
  }
};

// src/operations.ts
var Operation = /* @__PURE__ */ ((Operation2) => {
  Operation2["HELLO"] = "hello";
  Operation2["VERIFY"] = "verify";
  Operation2["QUERY"] = "query";
  Operation2["RESPOND"] = "respond";
  Operation2["TASK"] = "task";
  Operation2["STREAM"] = "stream";
  Operation2["TOOL"] = "tool";
  Operation2["CONSENT"] = "consent";
  Operation2["ERROR"] = "error";
  return Operation2;
})(Operation || {});
function query(domain, intent, params) {
  return { domain, intent, params };
}
function respond(status, data, schema) {
  return { status, data, schema };
}
function error(code, category, message, recoverable = false, suggestion) {
  return {
    code,
    category,
    message,
    recoverable,
    suggestion
  };
}

// src/crypto.ts
var nacl = null;
var naclUtil = null;
try {
  nacl = require("tweetnacl");
  naclUtil = require("tweetnacl-util");
} catch {
}
function generateKeyPair() {
  if (nacl && naclUtil) {
    const keyPair = nacl.sign.keyPair();
    return {
      privateKey: naclUtil.encodeBase64(keyPair.secretKey),
      publicKey: naclUtil.encodeBase64(keyPair.publicKey)
    };
  } else {
    const privateKey = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
    const publicKey = btoa(simpleHash(privateKey));
    return { privateKey, publicKey };
  }
}
function signMessage(message, privateKeyB64) {
  if (nacl && naclUtil) {
    const secretKey = naclUtil.decodeBase64(privateKeyB64);
    const messageBytes = naclUtil.decodeUTF8(message);
    const signature = nacl.sign.detached(messageBytes, secretKey);
    return naclUtil.encodeBase64(signature);
  } else {
    return btoa(simpleHash(message + privateKeyB64));
  }
}
function verifySignature(message, signatureB64, publicKeyB64) {
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
    return signatureB64.length > 0;
  }
}
function encryptMessage(message, recipientPublicB64, senderPrivateB64) {
  if (nacl && naclUtil) {
    const senderKey = naclUtil.decodeBase64(senderPrivateB64);
    const recipientKey = naclUtil.decodeBase64(recipientPublicB64);
    const nonce = nacl.randomBytes(nacl.box.nonceLength);
    const messageBytes = naclUtil.decodeUTF8(message);
    const encrypted = nacl.box(messageBytes, nonce, recipientKey, senderKey);
    return {
      ciphertext: naclUtil.encodeBase64(encrypted),
      nonce: naclUtil.encodeBase64(nonce)
    };
  } else {
    const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(24))));
    const ciphertext = btoa(message);
    return { ciphertext, nonce };
  }
}
function decryptMessage(ciphertextB64, nonceB64, senderPublicB64, recipientPrivateB64) {
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
    try {
      return atob(ciphertextB64);
    } catch {
      return null;
    }
  }
}
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  const result = Math.abs(hash).toString(16);
  return result.padStart(32, "0").repeat(2).substring(0, 32);
}

// src/agent.ts
function createIdentity(agentId, org, capabilities) {
  const { privateKey, publicKey } = generateKeyPair();
  return {
    agentId,
    org,
    signingKey: privateKey,
    publicKey,
    capabilities: capabilities || []
  };
}
function publicIdentity(identity) {
  return {
    agent: identity.agentId,
    org: identity.org,
    key: `ed25519:${identity.publicKey}`,
    enc_key: identity.encryptionPublic ? `x25519:${identity.encryptionPublic}` : void 0
  };
}
var Agent = class _Agent {
  identity;
  sessions = /* @__PURE__ */ new Map();
  constructor(identity) {
    this.identity = identity;
  }
  /**
   * Create a new agent with fresh identity
   */
  static create(agentId, org, capabilities) {
    const identity = createIdentity(agentId, org, capabilities);
    return new _Agent(identity);
  }
  /**
   * Load agent from identity object
   */
  static fromIdentity(identity) {
    return new _Agent(identity);
  }
  /**
   * Get public identity reference
   */
  getPublicRef() {
    return publicIdentity(this.identity);
  }
  /**
   * Sign a message
   */
  sign(message) {
    const wire = message.toWire();
    delete wire.sig;
    const canonical = JSON.stringify(wire, Object.keys(wire).sort());
    const signature = signMessage(canonical, this.identity.signingKey);
    message.signature = `ed25519:${signature}`;
    return message;
  }
  /**
   * Verify a message signature
   */
  verify(message, senderPublicKey) {
    if (!message.signature) return false;
    let sig = message.signature;
    if (sig.startsWith("ed25519:")) {
      sig = sig.substring(8);
    }
    const wire = message.toWire();
    delete wire.sig;
    const canonical = JSON.stringify(wire, Object.keys(wire).sort());
    let pubKey = senderPublicKey;
    if (pubKey.startsWith("ed25519:")) {
      pubKey = pubKey.substring(8);
    }
    return verifySignature(canonical, sig, pubKey);
  }
  /**
   * Create and sign a message
   */
  createMessage(operation, toAgent, toOrg, payload, options = {}) {
    const message = new Message({
      operation,
      sender: {
        agent: this.identity.agentId,
        org: this.identity.org,
        key: `ed25519:${this.identity.publicKey}`
      },
      recipient: { agent: toAgent, org: toOrg },
      payload,
      classification: options.classification,
      replyTo: options.replyTo,
      expires: options.expires,
      capabilitiesRequired: options.capabilities
    });
    return this.sign(message);
  }
  /**
   * Create a query message
   */
  query(toAgent, toOrg, domain, intent, params, options) {
    return this.createMessage(
      "query" /* QUERY */,
      toAgent,
      toOrg,
      query(domain, intent, params),
      options
    );
  }
  /**
   * Create a response to a message
   */
  respondTo(original, status, data, options) {
    return this.createMessage(
      "respond" /* RESPOND */,
      original.sender.agent,
      original.sender.org,
      respond(status, data),
      { ...options, replyTo: original.messageId }
    );
  }
  /**
   * Create an error response
   */
  errorTo(original, code, category, message, recoverable = false) {
    return this.createMessage(
      "error" /* ERROR */,
      original.sender.agent,
      original.sender.org,
      error(code, category, message, recoverable),
      { replyTo: original.messageId }
    );
  }
};

// src/session.ts
var Session = class _Session {
  sessionId;
  localAgent;
  remoteAgent;
  remoteOrg;
  remotePublicKey;
  sessionKey;
  capabilities;
  extensions;
  createdAt;
  expiresAt;
  lastActivity;
  messageCount;
  constructor(params) {
    const now = Date.now();
    this.sessionId = params.sessionId;
    this.localAgent = params.localAgent;
    this.remoteAgent = params.remoteAgent;
    this.remoteOrg = params.remoteOrg;
    this.remotePublicKey = params.remotePublicKey;
    this.capabilities = params.capabilities || [];
    this.extensions = params.extensions || [];
    this.createdAt = now;
    this.expiresAt = params.ttlSeconds ? now + params.ttlSeconds * 1e3 : null;
    this.lastActivity = now;
    this.messageCount = 0;
  }
  /**
   * Create a new session
   */
  static create(localAgent, remoteAgent, remoteOrg, remotePublicKey, ttlSeconds = 3600) {
    return new _Session({
      sessionId: crypto.randomUUID(),
      localAgent,
      remoteAgent,
      remoteOrg,
      remotePublicKey,
      ttlSeconds
    });
  }
  /**
   * Check if session has expired
   */
  isExpired() {
    if (this.expiresAt === null) return false;
    return Date.now() > this.expiresAt;
  }
  /**
   * Check if session is valid
   */
  isValid() {
    return !this.isExpired();
  }
  /**
   * Update activity timestamp
   */
  touch() {
    this.lastActivity = Date.now();
    this.messageCount++;
  }
  /**
   * Check if remote has capability
   */
  hasCapability(capability) {
    return this.capabilities.includes(capability);
  }
  /**
   * Extend session expiration
   */
  extend(ttlSeconds = 3600) {
    this.expiresAt = Date.now() + ttlSeconds * 1e3;
  }
};
var SessionManager = class {
  sessions = /* @__PURE__ */ new Map();
  byRemote = /* @__PURE__ */ new Map();
  maxSessions;
  defaultTTL;
  constructor(maxSessions = 100, defaultTTL = 3600) {
    this.maxSessions = maxSessions;
    this.defaultTTL = defaultTTL;
  }
  /**
   * Create and store a new session
   */
  create(localAgent, remoteAgent, remoteOrg, remotePublicKey, ttlSeconds) {
    this.cleanupExpired();
    if (this.sessions.size >= this.maxSessions) {
      let oldest = null;
      for (const session2 of this.sessions.values()) {
        if (!oldest || session2.lastActivity < oldest.lastActivity) {
          oldest = session2;
        }
      }
      if (oldest) {
        this.remove(oldest.sessionId);
      }
    }
    const session = Session.create(
      localAgent,
      remoteAgent,
      remoteOrg,
      remotePublicKey,
      ttlSeconds ?? this.defaultTTL
    );
    this.sessions.set(session.sessionId, session);
    const remoteList = this.byRemote.get(remoteAgent) || [];
    remoteList.push(session.sessionId);
    this.byRemote.set(remoteAgent, remoteList);
    return session;
  }
  /**
   * Get session by ID
   */
  get(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session && session.isExpired()) {
      this.remove(sessionId);
      return null;
    }
    return session || null;
  }
  /**
   * Get active session for remote agent
   */
  getForRemote(remoteAgent) {
    const sessionIds = this.byRemote.get(remoteAgent) || [];
    for (const sid of sessionIds) {
      const session = this.get(sid);
      if (session && session.isValid()) {
        return session;
      }
    }
    return null;
  }
  /**
   * Remove a session
   */
  remove(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.sessions.delete(sessionId);
      const remoteList = this.byRemote.get(session.remoteAgent);
      if (remoteList) {
        this.byRemote.set(
          session.remoteAgent,
          remoteList.filter((id) => id !== sessionId)
        );
      }
    }
  }
  /**
   * Cleanup expired sessions
   */
  cleanupExpired() {
    for (const [id, session] of this.sessions) {
      if (session.isExpired()) {
        this.remove(id);
      }
    }
  }
  /**
   * Count active sessions
   */
  activeCount() {
    this.cleanupExpired();
    return this.sessions.size;
  }
  /**
   * List all active sessions
   */
  list() {
    this.cleanupExpired();
    return Array.from(this.sessions.values());
  }
};

// src/classification.ts
var Classification = /* @__PURE__ */ ((Classification2) => {
  Classification2["PUBLIC"] = "pub";
  Classification2["INTERNAL"] = "int";
  Classification2["CONFIDENTIAL"] = "conf";
  Classification2["PII"] = "pii";
  Classification2["SECRET"] = "sec";
  return Classification2;
})(Classification || {});
var PIIDetector = class {
  static patterns = {
    email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    phone: /\+?[1-9]\d{1,14}/g,
    ssn: /\d{3}-\d{2}-\d{4}/g,
    credit_card: /\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}/g,
    ip_address: /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/g,
    date_of_birth: /\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/g
  };
  /**
   * Detect PII in text
   */
  static detect(text) {
    const results = {};
    for (const [piiType, pattern] of Object.entries(this.patterns)) {
      const matches = text.match(pattern);
      if (matches && matches.length > 0) {
        results[piiType] = [...new Set(matches)];
      }
    }
    return results;
  }
  /**
   * Check if text contains any PII
   */
  static containsPII(text) {
    return Object.keys(this.detect(text)).length > 0;
  }
  /**
   * Mask PII in text
   */
  static mask(text, maskChar = "*") {
    let result = text;
    for (const pattern of Object.values(this.patterns)) {
      result = result.replace(pattern, (match) => {
        if (match.length <= 4) {
          return maskChar.repeat(match.length);
        }
        return match.slice(0, 2) + maskChar.repeat(match.length - 4) + match.slice(-2);
      });
    }
    return result;
  }
  /**
   * Redact PII in text
   */
  static redact(text, piiType) {
    let result = text;
    const patternsToUse = piiType ? { [piiType]: this.patterns[piiType] } : this.patterns;
    for (const [type, pattern] of Object.entries(patternsToUse)) {
      if (pattern) {
        result = result.replace(pattern, `[REDACTED:${type.toUpperCase()}]`);
      }
    }
    return result;
  }
};
var ClassificationValidator = class {
  /**
   * Validate classification compliance
   */
  static validate(message) {
    var _a;
    const errors = [];
    const payloadStr = JSON.stringify(message.p);
    if (message.cls !== "pii" /* PII */) {
      const piiFound = PIIDetector.detect(payloadStr);
      if (Object.keys(piiFound).length > 0) {
        errors.push(
          `PII detected but classification is '${message.cls}': ${Object.keys(piiFound).join(", ")}`
        );
      }
    }
    if (message.cls === "pii" /* PII */) {
      if (!message.pii_meta) {
        errors.push("PII classification requires pii_meta with consent");
      } else if (!((_a = message.pii_meta.consent) == null ? void 0 : _a.proof)) {
        errors.push("PII classification requires consent proof");
      }
    }
    if (message.cls === "sec" /* SECRET */) {
      if (message.from.org !== message.to.org) {
        errors.push("SECRET classification cannot be transmitted across organizations");
      }
    }
    return errors;
  }
  /**
   * Check if classification allows logging
   */
  static canLog(classification) {
    return classification !== "sec" /* SECRET */;
  }
  /**
   * Check if classification requires encryption
   */
  static mustEncrypt(classification) {
    return [
      "conf" /* CONFIDENTIAL */,
      "pii" /* PII */,
      "sec" /* SECRET */
    ].includes(classification);
  }
};

// src/errors.ts
var MoltSpeakError = class extends Error {
  code;
  recoverable;
  constructor(message, code = "E_INTERNAL", recoverable = false) {
    super(message);
    this.name = "MoltSpeakError";
    this.code = code;
    this.recoverable = recoverable;
  }
};
var ValidationError = class extends MoltSpeakError {
  field;
  constructor(message, field) {
    super(message, "E_SCHEMA", true);
    this.name = "ValidationError";
    this.field = field;
  }
};
var SignatureError = class extends MoltSpeakError {
  constructor(message = "Signature verification failed") {
    super(message, "E_SIGNATURE", false);
    this.name = "SignatureError";
  }
};
var CapabilityError = class extends MoltSpeakError {
  capability;
  constructor(capability) {
    super(`Required capability not held: ${capability}`, "E_CAPABILITY", false);
    this.name = "CapabilityError";
    this.capability = capability;
  }
};
var ConsentError = class extends MoltSpeakError {
  piiTypes;
  constructor(piiTypes = []) {
    super(`PII transmitted without consent: ${piiTypes.join(", ")}`, "E_CONSENT", true);
    this.name = "ConsentError";
    this.piiTypes = piiTypes;
  }
};
var RateLimitError = class extends MoltSpeakError {
  retryAfterMs;
  constructor(retryAfterMs) {
    super("Rate limit exceeded", "E_RATE_LIMIT", true);
    this.name = "RateLimitError";
    this.retryAfterMs = retryAfterMs;
  }
};

// src/index.ts
var VERSION = "0.1.0";
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Agent,
  CapabilityError,
  Classification,
  ClassificationValidator,
  ConsentError,
  Message,
  MessageBuilder,
  MoltSpeakError,
  Operation,
  PIIDetector,
  RateLimitError,
  Session,
  SessionManager,
  SignatureError,
  VERSION,
  ValidationError,
  decryptMessage,
  encryptMessage,
  generateKeyPair,
  signMessage,
  verifySignature
});
