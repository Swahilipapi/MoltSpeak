/**
 * MoltSpeak Data Classification
 */

import type { PIIMetaData, WireMessage } from './types';

/**
 * Classification levels
 */
export enum Classification {
  PUBLIC = 'pub',
  INTERNAL = 'int',
  CONFIDENTIAL = 'conf',
  PII = 'pii',
  SECRET = 'sec',
}

/**
 * PII metadata
 */
export interface PIIMeta {
  types: string[];
  consentGrantedBy: string;
  consentPurpose: string;
  consentProof: string;
  consentExpires?: number;
  maskFields?: string[];
  scope?: string;
}

/**
 * Create PII metadata
 */
export function createPIIMeta(
  types: string[],
  grantedBy: string,
  purpose: string,
  proof: string,
  options?: {
    expires?: number;
    maskFields?: string[];
    scope?: string;
  }
): PIIMetaData {
  return {
    types,
    consent: {
      granted_by: grantedBy,
      purpose,
      proof,
      expires: options?.expires,
      scope: options?.scope,
    },
    mask_fields: options?.maskFields,
  };
}

/**
 * PII pattern detection
 */
export class PIIDetector {
  private static patterns: Record<string, RegExp> = {
    email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    phone: /\+?[1-9]\d{1,14}/g,
    ssn: /\d{3}-\d{2}-\d{4}/g,
    credit_card: /\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}/g,
    ip_address: /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/g,
    date_of_birth: /\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/g,
  };

  /**
   * Detect PII in text
   */
  static detect(text: string): Record<string, string[]> {
    const results: Record<string, string[]> = {};

    for (const [piiType, pattern] of Object.entries(this.patterns)) {
      const matches = text.match(pattern);
      if (matches && matches.length > 0) {
        results[piiType] = [...new Set(matches)]; // Deduplicate
      }
    }

    return results;
  }

  /**
   * Check if text contains any PII
   */
  static containsPII(text: string): boolean {
    return Object.keys(this.detect(text)).length > 0;
  }

  /**
   * Mask PII in text
   */
  static mask(text: string, maskChar = '*'): string {
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
  static redact(text: string, piiType?: string): string {
    let result = text;
    const patternsToUse = piiType
      ? { [piiType]: this.patterns[piiType] }
      : this.patterns;

    for (const [type, pattern] of Object.entries(patternsToUse)) {
      if (pattern) {
        result = result.replace(pattern, `[REDACTED:${type.toUpperCase()}]`);
      }
    }

    return result;
  }
}

/**
 * Classification validation
 */
export class ClassificationValidator {
  /**
   * Validate classification compliance
   */
  static validate(message: WireMessage): string[] {
    const errors: string[] = [];
    const payloadStr = JSON.stringify(message.p);

    // Check for PII in non-PII classified messages
    if (message.cls !== Classification.PII) {
      const piiFound = PIIDetector.detect(payloadStr);
      if (Object.keys(piiFound).length > 0) {
        errors.push(
          `PII detected but classification is '${message.cls}': ${Object.keys(piiFound).join(', ')}`
        );
      }
    }

    // Check PII messages have consent
    if (message.cls === Classification.PII) {
      if (!message.pii_meta) {
        errors.push('PII classification requires pii_meta with consent');
      } else if (!message.pii_meta.consent?.proof) {
        errors.push('PII classification requires consent proof');
      }
    }

    // Check secrets aren't transmitted externally
    if (message.cls === Classification.SECRET) {
      if (message.from.org !== message.to.org) {
        errors.push('SECRET classification cannot be transmitted across organizations');
      }
    }

    return errors;
  }

  /**
   * Check if classification allows logging
   */
  static canLog(classification: string): boolean {
    return classification !== Classification.SECRET;
  }

  /**
   * Check if classification requires encryption
   */
  static mustEncrypt(classification: string): boolean {
    return [
      Classification.CONFIDENTIAL,
      Classification.PII,
      Classification.SECRET,
    ].includes(classification as Classification);
  }
}
