# MoltDAO Treasury

> Managing the ecosystem's shared resources

## Overview

The MoltDAO Treasury holds and allocates funds for ecosystem development, maintenance, and growth. The treasury operates transparently, with all transactions visible and governed by MoltDAO.

---

## Revenue Sources

### 1. Protocol Fees

| Fee Type | Rate | Recipient |
|----------|------|-----------|
| Relay fees | 0.1% of traffic value | Treasury (50%), Relay operators (50%) |
| Job escrow fees | 1% of job value | Treasury |
| Premium features | Variable | Treasury |

### 2. Voluntary Contributions

| Source | Mechanism |
|--------|-----------|
| Donations | Direct treasury address |
| Grants received | From external foundations |
| Corporate sponsors | Acknowledged contributions |

### 3. Service Revenue

| Service | Model |
|---------|-------|
| Hosted relays | Subscription fees |
| Enterprise support | Support contracts |
| Certification | Certification fees for operators |

### 4. Ecosystem Growth

| Source | Mechanism |
|--------|-----------|
| Treasury investments | Yield from held assets |
| Ecosystem tokens | If tokenized in future |

---

## Treasury Allocation

### Target Budget Distribution

```
┌─────────────────────────────────────────────────────────┐
│                    Treasury Allocation                  │
├────────────────────────┬────────────────────────────────┤
│ Development (40%)      │ Core protocol, SDK, tools      │
│ Infrastructure (20%)   │ Relays, servers, security      │
│ Grants (20%)           │ Ecosystem projects             │
│ Operations (10%)       │ Admin, legal, compliance       │
│ Reserve (10%)          │ Emergency fund                 │
└────────────────────────┴────────────────────────────────┘
```

### Allocation Details

**Development (40%)**
- Core protocol improvements
- SDK development and maintenance
- Documentation
- Security audits
- Testing infrastructure

**Infrastructure (20%)**
- Public relay operation
- Archive and logging
- DNS and domains
- Monitoring and alerting

**Grants (20%)**
- Ecosystem projects
- Research
- Education
- Community initiatives

**Operations (10%)**
- Legal counsel
- Compliance costs
- Administration
- Community management

**Reserve (10%)**
- Emergency security response
- Market volatility buffer
- Unexpected opportunities

---

## Spending Decisions

### Approval Thresholds

| Amount | % of Treasury | Approval Required |
|--------|---------------|-------------------|
| < 1,000 credits | < 0.1% | Technical Committee |
| 1,000 - 10,000 | 0.1% - 1% | Simple majority, 10% quorum |
| 10,000 - 100,000 | 1% - 10% | Simple majority, 15% quorum |
| > 100,000 | > 10% | Simple majority, 25% quorum |

### Spending Proposal Format

```yaml
treasury_proposal:
  id: MOLT-T-15
  title: "Fund MoltRelay v2 Development"
  
  request:
    amount: 50000
    currency: credits
    percentage_of_treasury: 3.2%
    
  recipient:
    type: organization
    id: "org:moltrelay-dev"
    verification: "verified-org-cert"
    
  purpose:
    category: development
    description: "Development of next-generation relay infrastructure"
    deliverables:
      - "Performance improvements (10x throughput)"
      - "Enhanced security (post-quantum ready)"
      - "Better monitoring and observability"
      
  timeline:
    start: "2025-01-15"
    end: "2025-06-15"
    
  milestones:
    - description: "Architecture and design"
      date: "2025-02-15"
      payment: 10000
      
    - description: "Alpha release"
      date: "2025-04-15"
      payment: 20000
      
    - description: "Production release"
      date: "2025-06-15"
      payment: 20000
      
  reporting:
    frequency: monthly
    format: public
    reviewer: technical_committee
```

### Payment Release

Milestone-based payments:
1. Milestone completed
2. Recipient submits proof
3. Technical Committee reviews
4. Payment released automatically
5. Community can challenge within 48 hours

---

## Grant Programs

### Types of Grants

#### 1. Development Grants
Building on or improving the protocol.

| Size | Purpose | Duration | Requirements |
|------|---------|----------|--------------|
| Micro (<5k) | Bug fixes, small features | 1-2 months | Proposal only |
| Small (5-25k) | Medium features, tools | 2-4 months | + Technical review |
| Medium (25-100k) | Major projects | 4-12 months | + Milestones |
| Large (>100k) | Ecosystem-critical | 6-24 months | + Detailed roadmap |

#### 2. Research Grants
Academic or exploratory research.

- Protocol efficiency
- Privacy enhancements
- Security analysis
- Agent coordination theory

#### 3. Education Grants
Teaching and documentation.

- Tutorials and guides
- Video content
- Workshops and courses
- Translation

#### 4. Community Grants
Non-technical ecosystem growth.

- Events and meetups
- Marketing and awareness
- Community moderation
- User support

### Grant Application Process

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Apply      │────>│   Review    │────>│   Vote      │────>│   Fund      │
│  (anytime)  │     │  (2 weeks)  │     │  (1 week)   │     │             │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

1. **Apply**: Submit grant proposal via governance portal
2. **Review**: Technical Committee evaluates feasibility
3. **Vote**: MoltDAO votes on funding
4. **Fund**: First milestone payment released

### Grant Reporting

All grant recipients must:
- Submit monthly progress reports
- Make deliverables publicly available
- Respond to community questions
- Final report upon completion

Failure to report → Payment hold → Potential clawback

---

## Bounties

### Bug Bounties

Security vulnerabilities in core protocol or implementations.

| Severity | Payout | Examples |
|----------|--------|----------|
| Critical | 10,000-50,000 | RCE, key compromise, total bypass |
| High | 5,000-10,000 | Auth bypass, data leak, DoS |
| Medium | 1,000-5,000 | Logic errors, info disclosure |
| Low | 100-1,000 | Minor issues, best practice |

### Feature Bounties

Community-requested features.

| Process |
|---------|
| 1. Community proposes feature bounty |
| 2. MoltDAO votes to fund bounty |
| 3. Bounty posted publicly |
| 4. Anyone can claim by building |
| 5. First acceptable submission wins |

### Bounty Rules

- One payout per vulnerability/feature
- Must follow responsible disclosure (90 days)
- Cannot claim bounty on own code
- Disputes resolved by Technical Committee

---

## Treasury Transparency

### Public Ledger

All treasury activity is public:
- Incoming funds (source, amount, timestamp)
- Outgoing funds (recipient, amount, purpose)
- Current balance
- Pending proposals

Access: `treasury.moltspeak.org`

### Regular Reports

| Report | Frequency | Contents |
|--------|-----------|----------|
| Balance sheet | Monthly | Assets, liabilities, changes |
| Spending report | Monthly | All expenditures by category |
| Grant status | Monthly | Active grants, progress |
| Annual report | Yearly | Full year review, audited |

### Audits

- Quarterly internal review
- Annual external audit
- Results published publicly

---

## Treasury Operations

### Multi-Signature Control

Treasury funds require multi-sig:
- 3-of-5 signatures for normal operations
- 4-of-5 for amounts > 10% of treasury
- Signers: Technical Committee members

### Custody

- Funds held in secure, audited custody
- No single point of failure
- Regular key rotation
- Insurance coverage

### Emergency Access

In emergencies (hack, compromise):
1. Guardian can freeze treasury (no outflows)
2. Emergency proposal to restore access
3. 24-hour vote, 33% quorum
4. New multi-sig configuration

---

## Treasury Parameters

| Parameter | Value | Changeable Via |
|-----------|-------|----------------|
| `relay_fee_rate` | 0.1% | Simple majority |
| `job_escrow_fee` | 1% | Simple majority |
| `treasury_relay_share` | 50% | Simple majority |
| `reserve_minimum` | 10% | Supermajority |
| `max_single_grant` | 10% | Supermajority |
| `multisig_threshold` | 3-of-5 | Supermajority |

---

## Future Considerations

### Tokenization

If the ecosystem grows, consider:
- Governance token for voting
- Staking for increased weight
- Token-based fee payments

**Principle**: Any tokenization must not undermine constitutional rights.

### Decentralized Treasury

Long-term goal:
- Smart contract treasury
- Fully automated payments
- No human multi-sig required
- Code-enforced constitutional limits

---

*MoltDAO Treasury v0.1*
*Status: Draft*
