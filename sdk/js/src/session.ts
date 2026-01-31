/**
 * MoltSpeak Session management
 */

import type { SessionState } from './types';

/**
 * Session between two agents
 */
export class Session implements SessionState {
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
  }) {
    const now = Date.now();
    this.sessionId = params.sessionId;
    this.localAgent = params.localAgent;
    this.remoteAgent = params.remoteAgent;
    this.remoteOrg = params.remoteOrg;
    this.remotePublicKey = params.remotePublicKey;
    this.capabilities = params.capabilities || [];
    this.extensions = params.extensions || [];
    this.createdAt = now;
    this.expiresAt = params.ttlSeconds ? now + params.ttlSeconds * 1000 : null;
    this.lastActivity = now;
    this.messageCount = 0;
  }

  /**
   * Create a new session
   */
  static create(
    localAgent: string,
    remoteAgent: string,
    remoteOrg: string,
    remotePublicKey: string,
    ttlSeconds = 3600
  ): Session {
    return new Session({
      sessionId: crypto.randomUUID(),
      localAgent,
      remoteAgent,
      remoteOrg,
      remotePublicKey,
      ttlSeconds,
    });
  }

  /**
   * Check if session has expired
   */
  isExpired(): boolean {
    if (this.expiresAt === null) return false;
    return Date.now() > this.expiresAt;
  }

  /**
   * Check if session is valid
   */
  isValid(): boolean {
    return !this.isExpired();
  }

  /**
   * Update activity timestamp
   */
  touch(): void {
    this.lastActivity = Date.now();
    this.messageCount++;
  }

  /**
   * Check if remote has capability
   */
  hasCapability(capability: string): boolean {
    return this.capabilities.includes(capability);
  }

  /**
   * Extend session expiration
   */
  extend(ttlSeconds = 3600): void {
    this.expiresAt = Date.now() + ttlSeconds * 1000;
  }
}

/**
 * Manage multiple sessions
 */
export class SessionManager {
  private sessions: Map<string, Session> = new Map();
  private byRemote: Map<string, string[]> = new Map();
  maxSessions: number;
  defaultTTL: number;

  constructor(maxSessions = 100, defaultTTL = 3600) {
    this.maxSessions = maxSessions;
    this.defaultTTL = defaultTTL;
  }

  /**
   * Create and store a new session
   */
  create(
    localAgent: string,
    remoteAgent: string,
    remoteOrg: string,
    remotePublicKey: string,
    ttlSeconds?: number
  ): Session {
    // Cleanup expired first
    this.cleanupExpired();

    // Check limits
    if (this.sessions.size >= this.maxSessions) {
      // Remove oldest
      let oldest: Session | null = null;
      for (const session of this.sessions.values()) {
        if (!oldest || session.lastActivity < oldest.lastActivity) {
          oldest = session;
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

    // Track by remote agent
    const remoteList = this.byRemote.get(remoteAgent) || [];
    remoteList.push(session.sessionId);
    this.byRemote.set(remoteAgent, remoteList);

    return session;
  }

  /**
   * Get session by ID
   */
  get(sessionId: string): Session | null {
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
  getForRemote(remoteAgent: string): Session | null {
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
  remove(sessionId: string): void {
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
  private cleanupExpired(): void {
    for (const [id, session] of this.sessions) {
      if (session.isExpired()) {
        this.remove(id);
      }
    }
  }

  /**
   * Count active sessions
   */
  activeCount(): number {
    this.cleanupExpired();
    return this.sessions.size;
  }

  /**
   * List all active sessions
   */
  list(): Session[] {
    this.cleanupExpired();
    return Array.from(this.sessions.values());
  }
}
