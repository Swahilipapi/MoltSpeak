# MoltSpeak Foundation Improvements

## v0.0.1 - Polish & Hardening (Week 1)

### 1. TypeScript Strict Mode
```json
// tsconfig.json additions
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true
  }
}
```

### 2. Better Error Classes
```typescript
// Create typed errors with context
class MoltSpeakError extends Error {
  constructor(
    public code: string,
    message: string,
    public context?: Record<string, unknown>
  ) {
    super(`[${code}] ${message}`);
    this.name = 'MoltSpeakError';
  }
}

class ValidationError extends MoltSpeakError { }
class SignatureError extends MoltSpeakError { }
class PIIError extends MoltSpeakError { }
```

### 3. Input Validation Hardening
- [ ] Validate all string lengths (prevent DoS)
- [ ] Add max recursion depth for nested payloads
- [ ] Validate UUID format strictly
- [ ] Check timestamp drift (reject messages > 5min old)
- [ ] Sanitize agent/org names (alphanumeric + limited special chars)

### 4. Add CHANGELOG.md
- Following Keep a Changelog format
- Document all breaking changes

### 5. API Reference Docs
- Generate from TypeScript with typedoc
- Host on website /docs/api/

### 6. Edge Case Tests
- [ ] Empty strings everywhere
- [ ] Unicode handling (emoji in agent names?)
- [ ] Max size messages (1MB boundary)
- [ ] Deeply nested payloads (100 levels)
- [ ] Concurrent sign/verify operations
- [ ] Clock skew scenarios

### 7. Browser Bundle
- [ ] Verify crypto polyfills for older browsers
- [ ] Create minified browser bundle
- [ ] Add browser test suite (playwright)

---

## v0.0.2 - Feature Additions (Week 2-3)

### 1. Conversation Tracking
```typescript
interface Conversation {
  id: string;
  messages: Message[];
  startedAt: number;
  participants: AgentRef[];
}

class ConversationManager {
  // Track request-response pairs
  correlate(request: Message, response: Message): void;
  getThread(messageId: string): Message[];
}
```

### 2. Middleware System
```typescript
type Middleware = (msg: Message, next: () => Promise<Message>) => Promise<Message>;

agent.use(loggingMiddleware);
agent.use(rateLimitMiddleware);
agent.use(retryMiddleware);
```

### 3. Retry Logic with Backoff
```typescript
interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  retryableErrors: string[];
}

// Built-in exponential backoff
await agent.send(message, { retry: true });
```

### 4. Structured Logging Hooks
```typescript
agent.on('message:sent', (msg, meta) => { });
agent.on('message:received', (msg, meta) => { });
agent.on('error', (error, context) => { });
agent.on('pii:detected', (findings) => { });
```

### 5. Metrics Collection
```typescript
interface Metrics {
  messagesSent: number;
  messagesReceived: number;
  bytesTransferred: number;
  avgLatencyMs: number;
  errorRate: number;
  piiBlockedCount: number;
}

const stats = agent.getMetrics();
```

### 6. Stream Operation Support
```typescript
// Currently stubbed - implement properly
async function* streamResponse(query: Message): AsyncGenerator<Message> {
  yield createStream(query.id, { chunk: 1, data: '...' });
  yield createStream(query.id, { chunk: 2, data: '...' });
  yield createStreamEnd(query.id);
}
```

### 7. Optional Compression
```typescript
// For large payloads
const message = builder
  .payload(largeData)
  .compress('gzip')  // or 'brotli'
  .build();
```

### 8. Rate Limit Handling
```typescript
class RateLimiter {
  constructor(config: { requestsPerSecond: number });
  async acquire(): Promise<void>;
  
  // Respect server rate limit headers
  updateFromResponse(headers: Headers): void;
}
```

---

## v0.1.0 - Production Ready (Month 2)

### 1. Conformance Test Suite
- Official test vectors
- Cross-SDK validation (JS ↔ Python)
- Fuzzing with atheris/jsfuzz

### 2. Security Audit
- Third-party crypto review
- Penetration testing
- OWASP compliance check

### 3. Performance Benchmarks
- Latency benchmarks (p50, p95, p99)
- Throughput benchmarks
- Memory usage profiling
- Compare vs alternatives (JSON-RPC, gRPC)

### 4. Reference Relay Implementation
- Simple WebSocket relay
- Docker-compose for local dev
- Relay discovery protocol

### 5. Integration Examples
- LangChain integration
- AutoGen integration  
- CrewAI integration
- Clawdbot skill

---

## Quick Wins (Do Today)

1. **Add `.nvmrc`** - Pin Node version
2. **Add `.python-version`** - Pin Python version  
3. **Add `CHANGELOG.md`** - Empty with format
4. **Enable strict TS** - One tsconfig change
5. **Add timestamp validation** - Reject stale messages
6. **Add size limits to validation** - Prevent DoS
