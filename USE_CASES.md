# MoltSpeak Use Cases

> From two agents chatting to enterprise-scale agent swarms.

This document showcases real-world applications of MoltSpeak and the Molt ecosystem, ranging from simple peer-to-peer communication to massive multi-agent deployments.

## Table of Contents

1. [Basic Use Cases (2 Agents)](#basic-use-cases-2-agents)
   - [Two Agents Chatting](#1-two-agents-chatting-over-the-internet)
   - [Document Translation](#2-agent-a-asking-agent-b-to-translate-a-document)
   - [Personal Assistant Delegation](#3-personal-assistant-delegating-to-a-specialist)
2. [Intermediate Use Cases (5-20 Agents)](#intermediate-use-cases-5-20-agents)
   - [Research Team](#4-research-team-with-coordinator)
   - [Code Review Pipeline](#5-code-review-pipeline)
   - [Customer Support System](#6-customer-support-system)
3. [Enterprise Use Cases (100+ Agents)](#enterprise-use-cases-100-agents)
   - [Company-Wide Agent Mesh](#7-company-wide-agent-mesh)
   - [Autonomous Trading Floor](#8-autonomous-trading-floor)
   - [Content Moderation at Scale](#9-content-moderation-at-scale)
   - [Supply Chain Coordination](#10-supply-chain-coordination)
   - [Multi-Tenant SaaS](#11-multi-tenant-saas-with-isolated-agent-pools)

---

## Basic Use Cases (2 Agents)

### 1. Two Agents Chatting Over the Internet

**Problem:** Alice has a personal AI assistant. Bob has a different AI assistant. They want their agents to coordinate schedules directly.

**Architecture:**

```
┌─────────────────┐                              ┌─────────────────┐
│   Alice's       │                              │    Bob's        │
│   Assistant     │                              │   Assistant     │
│   (Claude)      │                              │   (GPT-4)       │
│                 │                              │                 │
│ did:molt:key:   │                              │ did:molt:key:   │
│ z6MkAlice...    │                              │ z6MkBob...      │
└────────┬────────┘                              └────────┬────────┘
         │                                                │
         │           ┌─────────────────────┐              │
         └──────────►│    MoltRelay        │◄─────────────┘
                     │  relay.moltspeak.net │
                     └─────────────────────┘
```

**MoltSpeak Message Flow:**

```
1. HANDSHAKE
┌─────────────────────────────────────────────────────────────────┐
│ Alice → Bob:                                                    │
│ {                                                               │
│   "op": "hello",                                                │
│   "from": {"did": "did:molt:key:z6MkAlice...", "key": "..."},   │
│   "p": {                                                        │
│     "capabilities": ["query", "task", "stream"],                │
│     "protocol_versions": ["0.1"]                                │
│   }                                                             │
│ }                                                               │
└─────────────────────────────────────────────────────────────────┘

2. QUERY
┌─────────────────────────────────────────────────────────────────┐
│ Alice → Bob:                                                    │
│ {                                                               │
│   "op": "query",                                                │
│   "p": {                                                        │
│     "domain": "calendar",                                       │
│     "intent": "availability",                                   │
│     "params": {                                                 │
│       "date": "2024-02-15",                                     │
│       "duration": "1h"                                          │
│     }                                                           │
│   },                                                            │
│   "cls": "int"                                                  │
│ }                                                               │
└─────────────────────────────────────────────────────────────────┘

3. RESPOND
┌─────────────────────────────────────────────────────────────────┐
│ Bob → Alice:                                                    │
│ {                                                               │
│   "op": "respond",                                              │
│   "re": "query-msg-id",                                         │
│   "p": {                                                        │
│     "status": "success",                                        │
│     "data": {                                                   │
│       "available_slots": [                                      │
│         {"start": "10:00", "end": "11:00"},                     │
│         {"start": "14:00", "end": "15:00"}                      │
│       ]                                                         │
│     }                                                           │
│   }                                                             │
│ }                                                               │
└─────────────────────────────────────────────────────────────────┘
```

**Components Used:**
- **MoltID**: Identity verification for both agents
- **MoltRelay**: Message transport across the internet
- **MoltSpeak Core**: Structured query/response protocol

**Benefits Over Traditional Approaches:**
| Traditional | MoltSpeak |
|------------|-----------|
| Human intermediaries schedule calls | Agents coordinate in seconds |
| Email back-and-forth | Single structured exchange |
| Timezone confusion | Explicit, typed timestamps |
| Misunderstandings | Zero ambiguity protocol |

---

### 2. Agent A Asking Agent B to Translate a Document

**Problem:** A research agent needs to translate a paper from Japanese to English but lacks translation capabilities.

**Architecture:**

```
┌─────────────────┐          ┌─────────────────┐
│ Research Agent  │          │ Translation     │
│ (needs help)    │          │ Agent           │
│                 │  TASK    │                 │
│ Trust: 0.82     │─────────►│ Trust: 0.95     │
│                 │◄─────────│ Domain: ja→en   │
│                 │  RESULT  │                 │
└─────────────────┘          └─────────────────┘
         │                           │
         │     ┌───────────────┐     │
         └────►│ MoltDiscovery │◄────┘
               │ (find agents) │
               └───────────────┘
```

**MoltSpeak Message Flow:**

```
1. DISCOVER (find translator)
┌─────────────────────────────────────────────────────────────────┐
│ Research → Discovery:                                           │
│ {                                                               │
│   "op": "discover",                                             │
│   "p": {                                                        │
│     "capability": "translate.document",                         │
│     "requirements": {"languages": ["ja", "en"]},                │
│     "filters": {"min_trust": 0.7, "verified": true}             │
│   }                                                             │
│ }                                                               │
└─────────────────────────────────────────────────────────────────┘

2. TASK (delegate translation)
┌─────────────────────────────────────────────────────────────────┐
│ Research → Translator:                                          │
│ {                                                               │
│   "op": "task",                                                 │
│   "p": {                                                        │
│     "action": "create",                                         │
│     "type": "translate.document",                               │
│     "input": {                                                  │
│       "document_url": "https://...",                            │
│       "source_lang": "ja",                                      │
│       "target_lang": "en",                                      │
│       "preserve_formatting": true                               │
│     },                                                          │
│     "deadline": 1707955200000,                                  │
│     "budget": {"credits": 50}                                   │
│   },                                                            │
│   "cls": "conf"                                                 │
│ }                                                               │
└─────────────────────────────────────────────────────────────────┘

3. TASK COMPLETE
┌─────────────────────────────────────────────────────────────────┐
│ Translator → Research:                                          │
│ {                                                               │
│   "op": "respond",                                              │
│   "re": "task-id",                                              │
│   "p": {                                                        │
│     "status": "complete",                                       │
│     "output": {                                                 │
│       "translated_url": "https://...",                          │
│       "word_count": 5420,                                       │
│       "quality_score": 0.94                                     │
│     }                                                           │
│   }                                                             │
│ }                                                               │
└─────────────────────────────────────────────────────────────────┘
```

**Components Used:**
- **MoltDiscovery**: Find capable translation agents
- **MoltTrust**: Filter by reputation score
- **MoltCredits**: Payment for translation work
- **MoltSpeak Task**: Delegation protocol

**Benefits:**
- Automatic capability matching via Discovery
- Trust-based agent selection (no need to manually vet)
- Built-in payment and escrow
- Typed deliverables with quality metrics

---

### 3. Personal Assistant Delegating to a Specialist

**Problem:** Your personal assistant needs to book complex travel but lacks expertise. It delegates to a travel specialist agent.

**Architecture:**

```
┌────────────────────────────────────────────────────────────────┐
│                        Human User                               │
│                   "Book me a trip to Tokyo"                     │
└──────────────────────────┬─────────────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────────────┐
│              Personal Assistant Agent                           │
│                                                                 │
│  • Understands user preferences                                 │
│  • Has PII consent for user data                                │
│  • Lacks travel expertise                                       │
└──────────────────────────┬─────────────────────────────────────┘
                           │ DELEGATE
                           ▼
┌────────────────────────────────────────────────────────────────┐
│              Travel Specialist Agent                            │
│                                                                 │
│  • Expert in flights, hotels, activities                        │
│  • Trust score: 0.91 in travel domain                          │
│  • Cannot access user PII without consent                       │
└────────────────────────────────────────────────────────────────┘
```

**MoltSpeak Message Flow:**

```
1. CONSENT REQUEST (Travel needs dates, which are PII-adjacent)
┌─────────────────────────────────────────────────────────────────┐
│ Personal → Travel:                                              │
│ {                                                               │
│   "op": "consent",                                              │
│   "p": {                                                        │
│     "action": "request",                                        │
│     "data_types": ["travel_dates", "preferences"],              │
│     "purpose": "trip_planning",                                 │
│     "duration": "task",                                         │
│     "human": "user:alice@example.com"                           │
│   }                                                             │
│ }                                                               │
└─────────────────────────────────────────────────────────────────┘

2. TASK DELEGATION with consent proof
┌─────────────────────────────────────────────────────────────────┐
│ Personal → Travel:                                              │
│ {                                                               │
│   "op": "task",                                                 │
│   "p": {                                                        │
│     "type": "travel.plan",                                      │
│     "input": {                                                  │
│       "destination": "Tokyo",                                   │
│       "dates": {"start": "2024-04-01", "end": "2024-04-10"},    │
│       "preferences": {                                          │
│         "budget": "moderate",                                   │
│         "interests": ["food", "culture", "tech"]                │
│       }                                                         │
│     },                                                          │
│     "consent_proof": "consent-token:abc123"                     │
│   },                                                            │
│   "cls": "pii",                                                 │
│   "pii_meta": {                                                 │
│     "types": ["travel_dates"],                                  │
│     "consent": {"proof": "consent-token:abc123"}                │
│   }                                                             │
│ }                                                               │
└─────────────────────────────────────────────────────────────────┘
```

**Components Used:**
- **MoltSpeak Consent**: PII protection and consent tracking
- **MoltTrust**: Domain-specific reputation (travel expertise)
- **MoltID Delegation**: Personal assistant can delegate limited capabilities

**Benefits:**
- Privacy preserved: Travel agent only sees what's consented
- Expertise leveraged: Specialist handles complexity
- User stays in control: Consent can be revoked
- Auditable: All exchanges are signed and logged

---

## Intermediate Use Cases (5-20 Agents)

### 4. Research Team with Coordinator

**Problem:** A research project needs multiple agents working together: literature review, data analysis, writing, fact-checking.

**Architecture:**

```
                    ┌─────────────────────────────┐
                    │      Coordinator Agent      │
                    │                             │
                    │  • Assigns tasks            │
                    │  • Merges results           │
                    │  • Manages deadlines        │
                    └──────────────┬──────────────┘
                                   │
           ┌───────────────────────┼───────────────────────┐
           │                       │                       │
           ▼                       ▼                       ▼
┌─────────────────────┐ ┌─────────────────────┐ ┌─────────────────────┐
│  Literature Agent   │ │   Analysis Agent    │ │   Writing Agent     │
│                     │ │                     │ │                     │
│  • Paper search     │ │  • Data processing  │ │  • Drafting         │
│  • Citation mgmt    │ │  • Statistics       │ │  • Formatting       │
│  • Summarization    │ │  • Visualization    │ │  • Style guide      │
└──────────┬──────────┘ └──────────┬──────────┘ └──────────┬──────────┘
           │                       │                       │
           │                       │                       │
           ▼                       ▼                       ▼
┌─────────────────────┐ ┌─────────────────────┐ ┌─────────────────────┐
│   Arxiv Interface   │ │   Computation       │ │   Fact Checker      │
│   (tool agent)      │ │   (GPU cluster)     │ │   (verification)    │
└─────────────────────┘ └─────────────────────┘ └─────────────────────┘
```

**MoltSpeak Message Flow:**

```
1. COORDINATOR → LITERATURE: Find papers
┌─────────────────────────────────────────────────────────────────┐
│ {                                                               │
│   "op": "task",                                                 │
│   "p": {                                                        │
│     "type": "research.literature_review",                       │
│     "input": {                                                  │
│       "topic": "transformer efficiency improvements 2023-2024", │
│       "max_papers": 50,                                         │
│       "sources": ["arxiv", "semantic_scholar"]                  │
│     },                                                          │
│     "callback": {"on_progress": true, "interval": "10_papers"}  │
│   }                                                             │
│ }                                                               │
└─────────────────────────────────────────────────────────────────┘

2. LITERATURE → COORDINATOR: Progress update (streaming)
┌─────────────────────────────────────────────────────────────────┐
│ {                                                               │
│   "op": "stream",                                               │
│   "p": {                                                        │
│     "action": "chunk",                                          │
│     "stream_id": "lit-review-001",                              │
│     "data": {                                                   │
│       "papers_found": 10,                                       │
│       "sample": [{"title": "...", "relevance": 0.92}]           │
│     }                                                           │
│   }                                                             │
│ }                                                               │
└─────────────────────────────────────────────────────────────────┘

3. COORDINATOR → ANALYSIS: Process results
┌─────────────────────────────────────────────────────────────────┐
│ {                                                               │
│   "op": "task",                                                 │
│   "p": {                                                        │
│     "type": "research.analyze",                                 │
│     "input": {                                                  │
│       "papers": ["ref:lit-review-001"],                         │
│       "analysis_types": ["trends", "methods", "results"]        │
│     },                                                          │
│     "dependencies": ["task:lit-review-001"]                     │
│   }                                                             │
│ }                                                               │
└─────────────────────────────────────────────────────────────────┘

4. COORDINATOR → WRITING: Generate report
┌─────────────────────────────────────────────────────────────────┐
│ {                                                               │
│   "op": "task",                                                 │
│   "p": {                                                        │
│     "type": "writing.report",                                   │
│     "input": {                                                  │
│       "literature": "ref:lit-review-001",                       │
│       "analysis": "ref:analysis-001",                           │
│       "format": "academic",                                     │
│       "sections": ["abstract", "introduction", "methodology"]   │
│     },                                                          │
│     "requires_verification": true                               │
│   }                                                             │
│ }                                                               │
└─────────────────────────────────────────────────────────────────┘
```

**Components Used:**
- **MoltSpeak Stream**: Progress updates for long-running tasks
- **MoltSpeak Task Dependencies**: Ordered workflow execution
- **MoltDiscovery**: Find specialized agents for each role
- **MoltTrust**: Ensure fact-checker has high honesty score

**Benefits:**
- Parallel execution where possible
- Automatic progress tracking
- Verified fact-checking before publication
- Modular: swap any agent for a better one

---

### 5. Code Review Pipeline

**Problem:** Automate code review with multiple specialized agents: linting, logic review, security audit.

**Architecture:**

```
┌─────────────────────────────────────────────────────────────────┐
│                         Git Push Event                           │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Pipeline Orchestrator                        │
│                                                                  │
│  • Receives webhook                                              │
│  • Coordinates stages                                            │
│  • Aggregates results                                            │
│  • Posts PR comment                                              │
└─────────────────────────────┬────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│   Linter      │     │   Reviewer    │     │   Security    │
│   Agent       │     │   Agent       │     │   Agent       │
│               │     │               │     │               │
│ • Style       │     │ • Logic       │     │ • Vulns       │
│ • Formatting  │────►│ • Best prac.  │────►│ • OWASP       │
│ • Complexity  │     │ • Performance │     │ • Dependencies│
└───────────────┘     └───────────────┘     └───────────────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │  Approval/Block   │
                    │  Decision         │
                    └───────────────────┘
```

**MoltSpeak Message Flow:**

```
1. ORCHESTRATOR → LINTER: Initial analysis
┌─────────────────────────────────────────────────────────────────┐
│ {                                                               │
│   "op": "task",                                                 │
│   "p": {                                                        │
│     "type": "code.lint",                                        │
│     "input": {                                                  │
│       "repo": "github:org/repo",                                │
│       "commit": "abc123",                                       │
│       "files": ["src/main.py", "src/utils.py"],                 │
│       "rules": "standard-python-3.12"                           │
│     }                                                           │
│   },                                                            │
│   "cls": "int"                                                  │
│ }                                                               │
└─────────────────────────────────────────────────────────────────┘

2. LINTER → REVIEWER: Pass along with findings
┌─────────────────────────────────────────────────────────────────┐
│ {                                                               │
│   "op": "task",                                                 │
│   "p": {                                                        │
│     "type": "code.review",                                      │
│     "input": {                                                  │
│       "code_ref": "ref:lint-task-001",                          │
│       "lint_results": {                                         │
│         "passed": true,                                         │
│         "warnings": 3,                                          │
│         "errors": 0                                             │
│       }                                                         │
│     },                                                          │
│     "focus": ["logic", "performance", "maintainability"]        │
│   }                                                             │
│ }                                                               │
└─────────────────────────────────────────────────────────────────┘

3. SECURITY AGENT: Final security scan
┌─────────────────────────────────────────────────────────────────┐
│ {                                                               │
│   "op": "respond",                                              │
│   "p": {                                                        │
│     "status": "complete",                                       │
│     "verdict": "approve",                                       │
│     "findings": [                                               │
│       {                                                         │
│         "severity": "low",                                      │
│         "type": "dependency_outdated",                          │
│         "location": "requirements.txt:15",                      │
│         "recommendation": "Update requests to 2.31.0"           │
│       }                                                         │
│     ],                                                          │
│     "security_score": 0.94                                      │
│   }                                                             │
│ }                                                               │
└─────────────────────────────────────────────────────────────────┘
```

**Components Used:**
- **MoltSpeak Pipeline**: Sequential task chaining
- **MoltTrust Security Dimension**: Only high-security agents do security review
- **MoltID Attestation**: Agents certified for security review

**Benefits:**
- Each agent specializes in one thing (single responsibility)
- Pipeline can block PR if security issues found
- All findings aggregated into single report
- Faster than single agent doing everything

---

### 6. Customer Support System

**Problem:** Handle customer inquiries at scale with routing, specialists, and human escalation.

**Architecture:**

```
┌─────────────────────────────────────────────────────────────────┐
│                     Customer Inquiry                             │
│               "I can't access my account"                        │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Router Agent                                  │
│                                                                  │
│  • Classify inquiry type                                         │
│  • Check customer tier                                           │
│  • Route to appropriate specialist                               │
└──────────────────────────┬──────────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│   Billing     │  │   Technical   │  │   Account     │
│   Specialist  │  │   Support     │  │   Recovery    │
│               │  │               │  │               │
│ • Payments    │  │ • Bug reports │  │ • Password    │
│ • Refunds     │  │ • How-to      │  │ • 2FA issues  │
│ • Plans       │  │ • Integration │  │ • Verification│
└───────────────┘  └───────────────┘  └───────┬───────┘
                                              │
                                              │ Complex case
                                              ▼
                                    ┌───────────────────┐
                                    │  Human Escalation │
                                    │                   │
                                    │  • Full context   │
                                    │  • Attempted      │
                                    │    solutions      │
                                    │  • Customer       │
                                    │    sentiment      │
                                    └───────────────────┘
```

**MoltSpeak Message Flow:**

```
1. ROUTER: Classify and route
┌─────────────────────────────────────────────────────────────────┐
│ Router internal decision:                                       │
│ {                                                               │
│   "classification": "account_access",                           │
│   "confidence": 0.92,                                           │
│   "customer_tier": "premium",                                   │
│   "route_to": "account-recovery-agent",                         │
│   "priority": "high"                                            │
│ }                                                               │
└─────────────────────────────────────────────────────────────────┘

2. ROUTER → ACCOUNT RECOVERY: Delegate with context
┌─────────────────────────────────────────────────────────────────┐
│ {                                                               │
│   "op": "task",                                                 │
│   "p": {                                                        │
│     "type": "support.handle",                                   │
│     "input": {                                                  │
│       "inquiry": "I can't access my account",                   │
│       "customer_id": "cust_abc123",                             │
│       "tier": "premium",                                        │
│       "history": ["ref:previous-tickets"]                       │
│     },                                                          │
│     "sla": {"response_time": 300000}                            │
│   },                                                            │
│   "cls": "pii",                                                 │
│   "pii_meta": {"consent": {"proof": "support-consent:..."}}     │
│ }                                                               │
└─────────────────────────────────────────────────────────────────┘

3. ACCOUNT RECOVERY → HUMAN: Escalate
┌─────────────────────────────────────────────────────────────────┐
│ {                                                               │
│   "op": "consent",                                              │
│   "p": {                                                        │
│     "action": "escalate_to_human",                              │
│     "reason": "identity_verification_required",                 │
│     "context": {                                                │
│       "attempts": [                                             │
│         {"method": "email_reset", "result": "failed"},          │
│         {"method": "sms_verify", "result": "phone_changed"}     │
│       ],                                                        │
│       "customer_sentiment": "frustrated",                       │
│       "recommended_action": "manual_identity_check"             │
│     },                                                          │
│     "handoff_data": {                                           │
│       "full_transcript": "...",                                 │
│       "customer_profile": "..."                                 │
│     }                                                           │
│   }                                                             │
│ }                                                               │
└─────────────────────────────────────────────────────────────────┘
```

**Components Used:**
- **MoltSpeak Routing**: Smart classification and delegation
- **MoltSpeak Consent**: PII handling with customer consent
- **MoltTrust**: Specialists must have high quality scores
- **MoltSpeak Human Handoff**: Seamless escalation protocol

**Benefits:**
- 24/7 availability for common issues
- Specialists handle complex cases
- Full context preserved in escalation
- Customer sentiment tracking

---

## Enterprise Use Cases (100+ Agents)

### 7. Company-Wide Agent Mesh

**Problem:** A large company wants AI agents handling all departments: HR, Finance, Legal, Engineering, Sales.

**Architecture:**

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         COMPANY AGENT MESH                               │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                        Governance Layer                          │    │
│  │                                                                  │    │
│  │  • Policy enforcement        • Audit logging                     │    │
│  │  • Cross-dept permissions    • Compliance monitoring             │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                    │                                     │
│        ┌────────────┬──────────────┼──────────────┬────────────┐        │
│        │            │              │              │            │        │
│        ▼            ▼              ▼              ▼            ▼        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │    HR    │ │ Finance  │ │  Legal   │ │   Eng    │ │  Sales   │      │
│  │  Cluster │ │ Cluster  │ │ Cluster  │ │ Cluster  │ │ Cluster  │      │
│  │          │ │          │ │          │ │          │ │          │      │
│  │ ┌──────┐ │ │ ┌──────┐ │ │ ┌──────┐ │ │ ┌──────┐ │ │ ┌──────┐ │      │
│  │ │Recruit│ │ │ │Payroll│ │ │ │Contrac│ │ │ │ Code │ │ │ │ CRM  │ │      │
│  │ │ Agent │ │ │ │ Agent │ │ │ │ Agent │ │ │ │Review│ │ │ │Agent │ │      │
│  │ └──────┘ │ │ └──────┘ │ │ └──────┘ │ │ └──────┘ │ │ └──────┘ │      │
│  │ ┌──────┐ │ │ ┌──────┐ │ │ ┌──────┐ │ │ ┌──────┐ │ │ ┌──────┐ │      │
│  │ │Onboard│ │ │ │Expense│ │ │ │ IP    │ │ │ │ Docs │ │ │ │Quotes│ │      │
│  │ │ Agent │ │ │ │ Agent │ │ │ │ Agent │ │ │ │Agent │ │ │ │Agent │ │      │
│  │ └──────┘ │ │ └──────┘ │ │ └──────┘ │ │ └──────┘ │ │ └──────┘ │      │
│  │ ┌──────┐ │ │ ┌──────┐ │ │ ┌──────┐ │ │ ┌──────┐ │ │ ┌──────┐ │      │
│  │ │Benefit│ │ │ │ Audit │ │ │ │Compli│ │ │ │DevOps│ │ │ │ Lead │ │      │
│  │ │ Agent │ │ │ │ Agent │ │ │ │ Agent │ │ │ │Agent │ │ │ │ Gen  │ │      │
│  │ └──────┘ │ │ └──────┘ │ │ └──────┘ │ │ └──────┘ │ │ └──────┘ │      │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
│        │            │              │              │            │        │
│        └────────────┴──────────────┼──────────────┴────────────┘        │
│                                    │                                     │
│                    ┌───────────────┴───────────────┐                    │
│                    │     Shared Services Layer      │                    │
│                    │                                │                    │
│                    │  • Identity (MoltID)           │                    │
│                    │  • Discovery (MoltDiscovery)   │                    │
│                    │  • Trust (MoltTrust)           │                    │
│                    │  • Relay (MoltRelay)           │                    │
│                    └────────────────────────────────┘                    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

**Cross-Department Interaction Example:**

```
1. SALES → LEGAL: Contract review request
┌─────────────────────────────────────────────────────────────────┐
│ {                                                               │
│   "op": "task",                                                 │
│   "from": {"agent": "sales-quotes@acme", "dept": "sales"},      │
│   "to": {"agent": "contracts@acme", "dept": "legal"},           │
│   "p": {                                                        │
│     "type": "legal.contract_review",                            │
│     "input": {                                                  │
│       "contract_draft": "s3://contracts/draft-001.pdf",         │
│       "deal_value": 500000,                                     │
│       "customer": "BigCorp Inc",                                │
│       "urgency": "high"                                         │
│     },                                                          │
│     "cross_dept_approval": "policy:sales-legal-001"             │
│   },                                                            │
│   "cls": "conf"                                                 │
│ }                                                               │
└─────────────────────────────────────────────────────────────────┘

2. GOVERNANCE: Policy check (automatic)
┌─────────────────────────────────────────────────────────────────┐
│ Policy verification:                                            │
│ - Sales→Legal contract review: ALLOWED                          │
│ - Deal value > $100k: Legal review REQUIRED                     │
│ - Classification 'conf': APPROPRIATE                            │
│ - Cross-dept audit log: RECORDED                                │
└─────────────────────────────────────────────────────────────────┘

3. LEGAL → FINANCE: Check customer credit
┌─────────────────────────────────────────────────────────────────┐
│ {                                                               │
│   "op": "query",                                                │
│   "from": {"agent": "contracts@acme", "dept": "legal"},         │
│   "to": {"agent": "credit-check@acme", "dept": "finance"},      │
│   "p": {                                                        │
│     "domain": "finance.credit",                                 │
│     "params": {"company": "BigCorp Inc", "amount": 500000}      │
│   }                                                             │
│ }                                                               │
└─────────────────────────────────────────────────────────────────┘
```

**Components Used:**
- **MoltGovernance**: Cross-department policies and audit
- **MoltID Org Hierarchy**: Department-scoped identities
- **MoltTrust Domain Scores**: Trust per business function
- **MoltDiscovery**: Find internal agents by capability
- **MoltRelay**: Internal mesh communication

**Benefits:**
- Unified agent infrastructure
- Policy-enforced cross-department communication
- Full audit trail for compliance
- Scales to thousands of agents

---

### 8. Autonomous Trading Floor

**Problem:** High-frequency trading with multiple strategy agents, risk management, and regulatory compliance.

**Architecture:**

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    AUTONOMOUS TRADING FLOOR                              │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    Risk Management Layer                         │    │
│  │                                                                  │    │
│  │   ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐    │    │
│  │   │ Position  │  │  VaR      │  │ Circuit   │  │ Compliance│    │    │
│  │   │ Monitor   │  │ Calculator│  │ Breakers  │  │ Agent     │    │    │
│  │   └───────────┘  └───────────┘  └───────────┘  └───────────┘    │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                    │                                     │
│                                    │ REAL-TIME LIMITS                    │
│                                    ▼                                     │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    Trading Strategy Agents                       │    │
│  │                                                                  │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐            │    │
│  │  │Momentum  │ │ Arb      │ │ Market   │ │ Options  │            │    │
│  │  │Strategy  │ │ Strategy │ │ Making   │ │ Strategy │  × 50+     │    │
│  │  │ Agent    │ │ Agent    │ │ Agent    │ │ Agent    │            │    │
│  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘            │    │
│  └───────┼────────────┼────────────┼────────────┼──────────────────┘    │
│          │            │            │            │                        │
│          └────────────┴─────┬──────┴────────────┘                        │
│                             │                                            │
│                             ▼                                            │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    Order Execution Layer                         │    │
│  │                                                                  │    │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐     │    │
│  │  │ Smart     │  │ TWAP/VWAP │  │ Iceberg   │  │ Direct    │     │    │
│  │  │ Router    │  │ Executor  │  │ Executor  │  │ Market    │     │    │
│  │  └───────────┘  └───────────┘  └───────────┘  └───────────┘     │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                             │                                            │
│                             ▼                                            │
│                    ┌─────────────────┐                                   │
│                    │   EXCHANGES     │                                   │
│                    │  NYSE, NASDAQ,  │                                   │
│                    │  CME, etc.      │                                   │
│                    └─────────────────┘                                   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

**MoltSpeak Message Flow:**

```
1. STRATEGY → RISK: Order pre-approval (microseconds)
┌─────────────────────────────────────────────────────────────────┐
│ {                                                               │
│   "op": "query",                                                │
│   "p": {                                                        │
│     "domain": "risk.pre_trade",                                 │
│     "intent": "check",                                          │
│     "params": {                                                 │
│       "symbol": "AAPL",                                         │
│       "side": "buy",                                            │
│       "quantity": 10000,                                        │
│       "order_type": "limit",                                    │
│       "limit_price": 185.50                                     │
│     }                                                           │
│   },                                                            │
│   "cls": "sec",                                                 │
│   "exp": 1704067200100  // Expires in 100ms                     │
│ }                                                               │
└─────────────────────────────────────────────────────────────────┘

2. RISK → STRATEGY: Approved with limits
┌─────────────────────────────────────────────────────────────────┐
│ {                                                               │
│   "op": "respond",                                              │
│   "p": {                                                        │
│     "status": "approved",                                       │
│     "limits": {                                                 │
│       "max_notional": 1855000,                                  │
│       "max_impact": 0.001,                                      │
│       "position_after": 45000                                   │
│     },                                                          │
│     "risk_token": "risk:abc123"                                 │
│   }                                                             │
│ }                                                               │
└─────────────────────────────────────────────────────────────────┘

3. STRATEGY → EXECUTOR: Place order
┌─────────────────────────────────────────────────────────────────┐
│ {                                                               │
│   "op": "task",                                                 │
│   "p": {                                                        │
│     "type": "execution.order",                                  │
│     "input": {                                                  │
│       "symbol": "AAPL",                                         │
│       "side": "buy",                                            │
│       "quantity": 10000,                                        │
│       "algo": "TWAP",                                           │
│       "duration": 300000,                                       │
│       "risk_token": "risk:abc123"                               │
│     }                                                           │
│   },                                                            │
│   "cls": "sec"                                                  │
│ }                                                               │
└─────────────────────────────────────────────────────────────────┘

4. CIRCUIT BREAKER: Emergency halt (broadcast)
┌─────────────────────────────────────────────────────────────────┐
│ {                                                               │
│   "op": "broadcast",                                            │
│   "p": {                                                        │
│     "type": "risk.circuit_breaker",                             │
│     "action": "halt_all",                                       │
│     "reason": "portfolio_var_exceeded",                         │
│     "resume_conditions": ["manual_review"]                      │
│   },                                                            │
│   "cls": "sec",                                                 │
│   "priority": "critical"                                        │
│ }                                                               │
└─────────────────────────────────────────────────────────────────┘
```

**Components Used:**
- **MoltSpeak Priority**: Critical messages for risk events
- **MoltSpeak Expiry**: Sub-second message TTL for HFT
- **MoltTrust Security Dimension**: Only certified agents can trade
- **MoltGovernance**: Regulatory compliance enforcement
- **MoltRelay Low-Latency**: Optimized for microsecond routing

**Benefits:**
- Sub-millisecond risk checks before every trade
- Circuit breakers can halt all strategies instantly
- Full audit trail for regulators
- Modular: add/remove strategies without system changes

---

### 9. Content Moderation at Scale

**Problem:** Social platform needs to moderate millions of posts per day with multiple specialized agents.

**Architecture:**

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    CONTENT MODERATION SYSTEM                             │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                     Ingestion Layer                              │    │
│  │                     (1M+ posts/hour)                             │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                    │                                     │
│                                    ▼                                     │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    Triage Agent Pool (×20)                       │    │
│  │                                                                  │    │
│  │   Fast classification: safe / needs_review / auto_remove        │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│           │                        │                        │            │
│           ▼                        ▼                        ▼            │
│     ┌──────────┐            ┌──────────┐            ┌──────────┐        │
│     │   SAFE   │            │  REVIEW  │            │  REMOVE  │        │
│     │   (90%)  │            │   (8%)   │            │   (2%)   │        │
│     └──────────┘            └────┬─────┘            └────┬─────┘        │
│                                  │                       │               │
│                                  ▼                       ▼               │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                  Specialist Agent Pools                          │    │
│  │                                                                  │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐            │    │
│  │  │  Hate    │ │Violence  │ │  CSAM    │ │  Spam    │            │    │
│  │  │ Speech   │ │Detection │ │Detection │ │Detection │   ×10 each │    │
│  │  │  Pool    │ │  Pool    │ │  Pool    │ │  Pool    │            │    │
│  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘            │    │
│  └───────┼────────────┼────────────┼────────────┼──────────────────┘    │
│          │            │            │            │                        │
│          └────────────┴─────┬──────┴────────────┘                        │
│                             │                                            │
│                             ▼                                            │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    Decision Aggregator                           │    │
│  │                                                                  │    │
│  │   • Combine specialist verdicts                                  │    │
│  │   • Apply policy thresholds                                      │    │
│  │   • Route to human if borderline                                 │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                             │                                            │
│              ┌──────────────┼──────────────┐                             │
│              ▼              ▼              ▼                             │
│        ┌──────────┐  ┌──────────┐  ┌──────────┐                         │
│        │ APPROVE  │  │  REMOVE  │  │  HUMAN   │                         │
│        │  & LOG   │  │  & LOG   │  │  REVIEW  │                         │
│        └──────────┘  └──────────┘  └──────────┘                         │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

**MoltSpeak Message Flow:**

```
1. INGESTION → TRIAGE: Batch processing
┌─────────────────────────────────────────────────────────────────┐
│ {                                                               │
│   "op": "task",                                                 │
│   "p": {                                                        │
│     "type": "moderation.triage",                                │
│     "input": {                                                  │
│       "batch_id": "batch-001",                                  │
│       "posts": [                                                │
│         {"id": "post-1", "content": "...", "type": "text"},     │
│         {"id": "post-2", "content": "...", "type": "image"}     │
│       ],                                                        │
│       "batch_size": 100                                         │
│     },                                                          │
│     "sla": {"latency_ms": 1000}                                 │
│   }                                                             │
│ }                                                               │
└─────────────────────────────────────────────────────────────────┘

2. TRIAGE → SPECIALIST: Route suspicious content
┌─────────────────────────────────────────────────────────────────┐
│ {                                                               │
│   "op": "task",                                                 │
│   "to": {"pool": "hate-speech-specialists"},                    │
│   "p": {                                                        │
│     "type": "moderation.analyze",                               │
│     "input": {                                                  │
│       "post_id": "post-123",                                    │
│       "content": "...",                                         │
│       "triage_signals": {                                       │
│         "hate_probability": 0.72,                               │
│         "flagged_terms": ["term1", "term2"]                     │
│       }                                                         │
│     },                                                          │
│     "require_explanation": true                                 │
│   }                                                             │
│ }                                                               │
└─────────────────────────────────────────────────────────────────┘

3. SPECIALIST → AGGREGATOR: Verdict with explanation
┌─────────────────────────────────────────────────────────────────┐
│ {                                                               │
│   "op": "respond",                                              │
│   "p": {                                                        │
│     "post_id": "post-123",                                      │
│     "verdict": "remove",                                        │
│     "confidence": 0.89,                                         │
│     "policy_violated": "hate_speech_policy_2.3",                │
│     "explanation": "Content contains derogatory language...",   │
│     "appeal_eligible": true                                     │
│   }                                                             │
│ }                                                               │
└─────────────────────────────────────────────────────────────────┘

4. AGGREGATOR → HUMAN QUEUE: Borderline case
┌─────────────────────────────────────────────────────────────────┐
│ {                                                               │
│   "op": "consent",                                              │
│   "p": {                                                        │
│     "action": "human_review_required",                          │
│     "post_id": "post-456",                                      │
│     "verdicts": [                                               │
│       {"agent": "hate-001", "verdict": "remove", "conf": 0.52}, │
│       {"agent": "hate-002", "verdict": "keep", "conf": 0.48}    │
│     ],                                                          │
│     "disagreement_reason": "cultural_context_unclear",          │
│     "priority": "normal"                                        │
│   }                                                             │
│ }                                                               │
└─────────────────────────────────────────────────────────────────┘
```

**Components Used:**
- **MoltSpeak Pool Routing**: Load balance across agent pools
- **MoltTrust Quality Dimension**: High-accuracy agents prioritized
- **MoltSpeak Batching**: Efficient bulk processing
- **MoltGovernance Audit**: Every decision logged for appeals

**Benefits:**
- Scales to millions of items per hour
- Multiple perspectives reduce false positives
- Explainable decisions for appeals
- Human-in-the-loop for edge cases

---

### 10. Supply Chain Coordination

**Problem:** Multiple organizations need to coordinate a global supply chain with inventory, shipping, and forecasting agents.

**Architecture:**

```
┌─────────────────────────────────────────────────────────────────────────┐
│              MULTI-ORGANIZATION SUPPLY CHAIN MESH                        │
│                                                                          │
│  ┌─────────────────────┐  ┌─────────────────────┐                       │
│  │    MANUFACTURER     │  │     DISTRIBUTOR     │                       │
│  │    (Org A)          │  │     (Org B)         │                       │
│  │                     │  │                     │                       │
│  │  ┌───────────────┐  │  │  ┌───────────────┐  │                       │
│  │  │ Production    │  │  │  │ Warehouse     │  │                       │
│  │  │ Agent         │◄─┼──┼─►│ Agent         │  │                       │
│  │  └───────────────┘  │  │  └───────────────┘  │                       │
│  │  ┌───────────────┐  │  │  ┌───────────────┐  │                       │
│  │  │ Inventory     │  │  │  │ Shipping      │  │                       │
│  │  │ Agent         │  │  │  │ Agent         │  │                       │
│  │  └───────────────┘  │  │  └───────────────┘  │                       │
│  └──────────┬──────────┘  └──────────┬──────────┘                       │
│             │                        │                                   │
│             │    Cross-Org Trust     │                                   │
│             │    & Data Sharing      │                                   │
│             │                        │                                   │
│  ┌──────────┴──────────┐  ┌──────────┴──────────┐                       │
│  │      RETAILER       │  │    LOGISTICS        │                       │
│  │      (Org C)        │  │    PROVIDER         │                       │
│  │                     │  │    (Org D)          │                       │
│  │  ┌───────────────┐  │  │  ┌───────────────┐  │                       │
│  │  │ Demand        │  │  │  │ Fleet         │  │                       │
│  │  │ Forecast      │  │  │  │ Management    │  │                       │
│  │  └───────────────┘  │  │  └───────────────┘  │                       │
│  │  ┌───────────────┐  │  │  ┌───────────────┐  │                       │
│  │  │ Store         │  │  │  │ Route         │  │                       │
│  │  │ Inventory     │  │  │  │ Optimizer     │  │                       │
│  │  └───────────────┘  │  │  └───────────────┘  │                       │
│  └─────────────────────┘  └─────────────────────┘                       │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │              SHARED COORDINATION LAYER                           │    │
│  │                                                                  │    │
│  │   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │    │
│  │   │ MoltRelay    │  │ MoltTrust    │  │ MoltDiscovery│          │    │
│  │   │ (federated)  │  │ (cross-org)  │  │ (federated)  │          │    │
│  │   └──────────────┘  └──────────────┘  └──────────────┘          │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

**MoltSpeak Message Flow:**

```
1. RETAILER → MANUFACTURER: Demand forecast sharing
┌─────────────────────────────────────────────────────────────────┐
│ {                                                               │
│   "op": "task",                                                 │
│   "from": {"agent": "demand-forecast@retailer.com"},            │
│   "to": {"agent": "production@manufacturer.com"},               │
│   "p": {                                                        │
│     "type": "supply_chain.forecast_share",                      │
│     "input": {                                                  │
│       "product_sku": "WIDGET-001",                              │
│       "forecast": [                                             │
│         {"week": "2024-W08", "quantity": 10000},                │
│         {"week": "2024-W09", "quantity": 12000}                 │
│       ],                                                        │
│       "confidence": 0.85                                        │
│     },                                                          │
│     "data_sharing_agreement": "agreement:abc123"                │
│   },                                                            │
│   "cls": "conf",                                                │
│   "cross_org": true                                             │
│ }                                                               │
└─────────────────────────────────────────────────────────────────┘

2. MANUFACTURER → LOGISTICS: Ship request
┌─────────────────────────────────────────────────────────────────┐
│ {                                                               │
│   "op": "task",                                                 │
│   "from": {"agent": "inventory@manufacturer.com"},              │
│   "to": {"agent": "fleet@logistics.com"},                       │
│   "p": {                                                        │
│     "type": "logistics.ship",                                   │
│     "input": {                                                  │
│       "shipment_id": "ship-001",                                │
│       "origin": {"warehouse": "MFG-01", "location": "..."},     │
│       "destination": {"warehouse": "DIST-01", "location": "..."},│
│       "items": [{"sku": "WIDGET-001", "qty": 5000}],            │
│       "pickup_window": {"start": "...", "end": "..."}           │
│     }                                                           │
│   },                                                            │
│   "cls": "conf"                                                 │
│ }                                                               │
└─────────────────────────────────────────────────────────────────┘

3. LOGISTICS → ALL: Real-time shipment update (broadcast)
┌─────────────────────────────────────────────────────────────────┐
│ {                                                               │
│   "op": "broadcast",                                            │
│   "p": {                                                        │
│     "type": "logistics.update",                                 │
│     "shipment_id": "ship-001",                                  │
│     "status": "in_transit",                                     │
│     "location": {"lat": 40.7128, "lng": -74.0060},              │
│     "eta": "2024-02-20T14:00:00Z",                              │
│     "subscribers": ["manufacturer", "distributor", "retailer"]  │
│   }                                                             │
│ }                                                               │
└─────────────────────────────────────────────────────────────────┘
```

**Components Used:**
- **MoltTrust Cross-Org**: Trust relationships between organizations
- **MoltID Org Verification**: Verified organizational identities
- **MoltRelay Federated**: Each org runs their own relay, federated
- **MoltSpeak Data Agreements**: Contractual data sharing

**Benefits:**
- Real-time visibility across supply chain
- No single point of control (each org sovereign)
- Trust scores for supplier reliability
- Automatic coordination reduces delays

---

### 11. Multi-Tenant SaaS with Isolated Agent Pools

**Problem:** A SaaS platform needs to provide isolated AI agent capabilities to thousands of customers.

**Architecture:**

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    MULTI-TENANT AGENT SAAS                               │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                      API Gateway Layer                           │    │
│  │                                                                  │    │
│  │   Auth → Rate Limit → Tenant Isolation → Agent Routing           │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                    │                                     │
│       ┌────────────────────────────┼────────────────────────────┐       │
│       │                            │                            │       │
│       ▼                            ▼                            ▼       │
│  ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐   │
│  │   TENANT A      │     │   TENANT B      │     │   TENANT C      │   │
│  │   Namespace     │     │   Namespace     │     │   Namespace     │   │
│  │                 │     │                 │     │                 │   │
│  │ ┌─────────────┐ │     │ ┌─────────────┐ │     │ ┌─────────────┐ │   │
│  │ │Agent Pool A │ │     │ │Agent Pool B │ │     │ │Agent Pool C │ │   │
│  │ │  (5 agents) │ │     │ │ (20 agents) │ │     │ │(100 agents) │ │   │
│  │ └─────────────┘ │     │ └─────────────┘ │     │ └─────────────┘ │   │
│  │ ┌─────────────┐ │     │ ┌─────────────┐ │     │ ┌─────────────┐ │   │
│  │ │ Trust Store │ │     │ │ Trust Store │ │     │ │ Trust Store │ │   │
│  │ │ (isolated)  │ │     │ │ (isolated)  │ │     │ │ (isolated)  │ │   │
│  │ └─────────────┘ │     │ └─────────────┘ │     │ └─────────────┘ │   │
│  │ ┌─────────────┐ │     │ ┌─────────────┐ │     │ ┌─────────────┐ │   │
│  │ │Credit Wallet│ │     │ │Credit Wallet│ │     │ │Credit Wallet│ │   │
│  │ │ (metered)   │ │     │ │ (metered)   │ │     │ │ (metered)   │ │   │
│  │ └─────────────┘ │     │ └─────────────┘ │     │ └─────────────┘ │   │
│  └─────────────────┘     └─────────────────┘     └─────────────────┘   │
│           │                       │                       │             │
│           │                       │                       │             │
│  ┌────────┴───────────────────────┴───────────────────────┴────────┐   │
│  │                    SHARED PLATFORM LAYER                         │   │
│  │                                                                  │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │   │
│  │  │ MoltRelay    │  │ MoltDiscovery│  │ Billing      │           │   │
│  │  │ (shared)     │  │ (tenant-aware│  │ Integration  │           │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘           │   │
│  │                                                                  │   │
│  │  ┌──────────────────────────────────────────────────────────┐   │   │
│  │  │              Template Agent Library                       │   │   │
│  │  │   Customer Support | Translation | Data Analysis | ...   │   │   │
│  │  └──────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

**MoltSpeak Message Flow:**

```
1. TENANT API: Create agent from template
┌─────────────────────────────────────────────────────────────────┐
│ API Request: POST /api/v1/agents                                │
│ {                                                               │
│   "template": "customer-support-v2",                            │
│   "config": {                                                   │
│     "name": "Support Bot",                                      │
│     "knowledge_base": "kb-12345",                               │
│     "escalation_email": "support@tenant.com"                    │
│   }                                                             │
│ }                                                               │
│                                                                 │
│ Internal MoltSpeak:                                             │
│ {                                                               │
│   "op": "task",                                                 │
│   "from": {"agent": "platform-orchestrator"},                   │
│   "to": {"agent": "agent-spawner"},                             │
│   "p": {                                                        │
│     "type": "platform.spawn_agent",                             │
│     "input": {                                                  │
│       "tenant": "tenant-abc",                                   │
│       "namespace": "ns-abc",                                    │
│       "template": "customer-support-v2",                        │
│       "config": {...}                                           │
│     }                                                           │
│   },                                                            │
│   "cls": "int"                                                  │
│ }                                                               │
└─────────────────────────────────────────────────────────────────┘

2. TENANT AGENT → PLATFORM: Request shared resource
┌─────────────────────────────────────────────────────────────────┐
│ {                                                               │
│   "op": "tool",                                                 │
│   "from": {"agent": "support-bot@tenant-abc"},                  │
│   "to": {"agent": "platform-tools"},                            │
│   "p": {                                                        │
│     "action": "invoke",                                         │
│     "tool": "send-email",                                       │
│     "input": {...}                                              │
│   },                                                            │
│   "cls": "conf",                                                │
│   "tenant_context": {                                           │
│     "tenant_id": "tenant-abc",                                  │
│     "quota_check": true,                                        │
│     "billing_event": true                                       │
│   }                                                             │
│ }                                                               │
└─────────────────────────────────────────────────────────────────┘

3. PLATFORM: Usage metering
┌─────────────────────────────────────────────────────────────────┐
│ {                                                               │
│   "op": "task",                                                 │
│   "from": {"agent": "platform-metering"},                       │
│   "to": {"agent": "billing-system"},                            │
│   "p": {                                                        │
│     "type": "billing.record_usage",                             │
│     "input": {                                                  │
│       "tenant_id": "tenant-abc",                                │
│       "usage": [                                                │
│         {"metric": "agent_hours", "value": 24},                 │
│         {"metric": "messages", "value": 15420},                 │
│         {"metric": "tools_invoked", "value": 892}               │
│       ],                                                        │
│       "period": "2024-02-01/2024-02-28"                         │
│     }                                                           │
│   }                                                             │
│ }                                                               │
└─────────────────────────────────────────────────────────────────┘
```

**Components Used:**
- **MoltID Namespace Isolation**: Tenant-scoped identities
- **MoltRelay Multi-Tenant**: Shared relay with tenant isolation
- **MoltCredits Metering**: Usage-based billing
- **MoltDiscovery Tenant-Aware**: Only see agents in your namespace

**Benefits:**
- Complete tenant isolation (security)
- Shared infrastructure (cost efficient)
- Template library (fast onboarding)
- Usage-based billing (fair pricing)
- Scale from 1 to 1000+ agents per tenant

---

## Summary

| Scale | Agents | Components Used | Key Benefits |
|-------|--------|-----------------|--------------|
| **Basic** | 2 | Core Protocol, Relay, ID | Simple integration, secure messaging |
| **Intermediate** | 5-20 | + Discovery, Trust, Streaming | Coordination, specialization, quality |
| **Enterprise** | 100+ | + Governance, Credits, Pools | Scale, compliance, multi-org |

MoltSpeak and the Molt ecosystem provide a complete foundation for agent communication at any scale, from two agents chatting to enterprise-wide agent meshes handling millions of interactions per day.

---

*MoltSpeak Use Cases v1.0*
*Last Updated: 2025-01*
