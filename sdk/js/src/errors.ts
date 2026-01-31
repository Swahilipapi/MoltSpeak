/**
 * MoltSpeak Errors
 */

/**
 * Base MoltSpeak error
 */
export class MoltSpeakError extends Error {
  code: string;
  recoverable: boolean;

  constructor(message: string, code = 'E_INTERNAL', recoverable = false) {
    super(message);
    this.name = 'MoltSpeakError';
    this.code = code;
    this.recoverable = recoverable;
  }
}

/**
 * Message validation failed
 */
export class ValidationError extends MoltSpeakError {
  field?: string;

  constructor(message: string, field?: string) {
    super(message, 'E_SCHEMA', true);
    this.name = 'ValidationError';
    this.field = field;
  }
}

/**
 * Signature verification failed
 */
export class SignatureError extends MoltSpeakError {
  constructor(message = 'Signature verification failed') {
    super(message, 'E_SIGNATURE', false);
    this.name = 'SignatureError';
  }
}

/**
 * Required capability not held
 */
export class CapabilityError extends MoltSpeakError {
  capability: string;

  constructor(capability: string) {
    super(`Required capability not held: ${capability}`, 'E_CAPABILITY', false);
    this.name = 'CapabilityError';
    this.capability = capability;
  }
}

/**
 * PII transmitted without consent
 */
export class ConsentError extends MoltSpeakError {
  piiTypes: string[];

  constructor(piiTypes: string[] = []) {
    super(`PII transmitted without consent: ${piiTypes.join(', ')}`, 'E_CONSENT', true);
    this.name = 'ConsentError';
    this.piiTypes = piiTypes;
  }
}

/**
 * PII handling error (detection, redaction, or policy violation)
 */
export class PIIError extends MoltSpeakError {
  detectedTypes: string[];
  action?: 'block' | 'redact' | 'warn';

  constructor(message: string, detectedTypes: string[] = [], action?: 'block' | 'redact' | 'warn') {
    super(message, 'E_PII', true);
    this.name = 'PIIError';
    this.detectedTypes = detectedTypes;
    this.action = action;
  }
}

/**
 * Rate limit exceeded
 */
export class RateLimitError extends MoltSpeakError {
  retryAfterMs?: number;

  constructor(retryAfterMs?: number) {
    super('Rate limit exceeded', 'E_RATE_LIMIT', true);
    this.name = 'RateLimitError';
    this.retryAfterMs = retryAfterMs;
  }
}

/**
 * Operation timed out
 */
export class TimeoutError extends MoltSpeakError {
  constructor(message = 'Operation timed out') {
    super(message, 'E_TIMEOUT', true);
    this.name = 'TimeoutError';
  }
}

/**
 * Authentication failed
 */
export class AuthenticationError extends MoltSpeakError {
  constructor(message = 'Authentication failed') {
    super(message, 'E_AUTH_FAILED', false);
    this.name = 'AuthenticationError';
  }
}

/**
 * Protocol-level error
 */
export class ProtocolError extends MoltSpeakError {
  constructor(message: string, code = 'E_PARSE') {
    super(message, code, false);
    this.name = 'ProtocolError';
  }
}
