/**
 * MoltSpeak JavaScript SDK
 * 
 * Secure, efficient agent-to-agent communication.
 */

export { Message, MessageBuilder, MessageLimits } from './message';
export { Agent, AgentIdentity } from './agent';
export { Session, SessionManager } from './session';
export { 
  Query, 
  Respond, 
  Task, 
  Stream, 
  Tool, 
  Consent, 
  ErrorPayload,
  Operation 
} from './operations';
export { 
  Classification, 
  PIIMeta, 
  PIIDetector, 
  ClassificationValidator 
} from './classification';
export {
  generateKeyPair,
  signMessage,
  verifySignature,
  encryptMessage,
  decryptMessage,
} from './crypto';
export {
  MoltSpeakError,
  ValidationError,
  SignatureError,
  CapabilityError,
  ConsentError,
  PIIError,
  RateLimitError,
  TimeoutError,
  AuthenticationError,
  ProtocolError,
} from './errors';
export type {
  AgentRef,
  MessagePayload,
  PIIMetaData,
} from './types';

export const VERSION = '0.1.0';
