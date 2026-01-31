/**
 * MoltSpeak Operations
 */

/**
 * Core operation types
 */
export enum Operation {
  HELLO = 'hello',
  VERIFY = 'verify',
  QUERY = 'query',
  RESPOND = 'respond',
  TASK = 'task',
  STREAM = 'stream',
  TOOL = 'tool',
  CONSENT = 'consent',
  ERROR = 'error',
}

/**
 * Query operation payload
 */
export interface Query {
  domain: string;
  intent: string;
  params?: Record<string, unknown>;
  response_format?: {
    type?: string;
    schema?: string;
    fields?: string[];
  };
}

/**
 * Create a query payload
 */
export function query(
  domain: string,
  intent: string,
  params?: Record<string, unknown>
): Query {
  return { domain, intent, params };
}

/**
 * Response operation payload
 */
export interface Respond {
  status: 'success' | 'error' | 'partial';
  data: unknown;
  schema?: string;
}

/**
 * Create a response payload
 */
export function respond(
  status: 'success' | 'error' | 'partial',
  data: unknown,
  schema?: string
): Respond {
  return { status, data, schema };
}

/**
 * Task operation payload
 */
export interface Task {
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
 * Create a task payload
 */
export function task(
  action: Task['action'],
  taskId: string,
  options?: Partial<Omit<Task, 'action' | 'task_id'>>
): Task {
  return {
    action,
    task_id: taskId,
    ...options,
  };
}

/**
 * Stream operation payload
 */
export interface Stream {
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
 * Create a stream payload
 */
export function stream(
  action: Stream['action'],
  streamId: string,
  options?: Partial<Omit<Stream, 'action' | 'stream_id'>>
): Stream {
  return {
    action,
    stream_id: streamId,
    ...options,
  };
}

/**
 * Tool operation payload
 */
export interface Tool {
  action: 'invoke' | 'list' | 'describe';
  tool?: string;
  input?: Record<string, unknown>;
  timeout_ms?: number;
}

/**
 * Create a tool payload
 */
export function tool(
  action: Tool['action'],
  toolName?: string,
  input?: Record<string, unknown>
): Tool {
  return {
    action,
    tool: toolName,
    input,
  };
}

/**
 * Consent operation payload
 */
export interface Consent {
  action: 'request' | 'grant' | 'revoke' | 'verify';
  data_types: string[];
  purpose: string;
  human?: string;
  duration?: 'session' | '24h' | '7d' | 'permanent';
  consent_token?: string;
}

/**
 * Create a consent payload
 */
export function consent(
  action: Consent['action'],
  dataTypes: string[],
  purpose: string,
  options?: Partial<Omit<Consent, 'action' | 'data_types' | 'purpose'>>
): Consent {
  return {
    action,
    data_types: dataTypes,
    purpose,
    ...options,
  };
}

/**
 * Error operation payload
 */
export interface ErrorPayload {
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
}

/**
 * Create an error payload
 */
export function error(
  code: string,
  category: ErrorPayload['category'],
  message: string,
  recoverable = false,
  suggestion?: ErrorPayload['suggestion']
): ErrorPayload {
  return {
    code,
    category,
    message,
    recoverable,
    suggestion,
  };
}

// Common error factories
export const errors = {
  parse: (message: string) => error('E_PARSE', 'protocol', message, false),
  validation: (message: string, field?: string) => ({
    ...error('E_SCHEMA', 'validation', message, true),
    field,
  }),
  auth: (message = 'Authentication failed') => error('E_AUTH_FAILED', 'auth', message, false),
  capability: (capability: string) =>
    error(
      'E_CAPABILITY',
      'auth',
      `Required capability not held: ${capability}`,
      false,
      { action: 'request_capability', capability }
    ),
  consent: (piiTypes: string[]) =>
    error(
      'E_CONSENT',
      'privacy',
      `PII transmitted without consent: ${piiTypes.join(', ')}`,
      true,
      { action: 'request_consent', data_types: piiTypes }
    ),
  rateLimit: (retryAfterMs: number) =>
    error('E_RATE_LIMIT', 'transport', 'Rate limit exceeded', true, {
      action: 'retry_after',
      delay_ms: retryAfterMs,
    }),
};
