# MoltCredits Tokenomics

> Why we chose stability over speculation (and what a token might look like if we're wrong).

## The Decision: Credits, Not Tokens

### We Chose USD-Pegged Credits

MoltCredits are **not** a floating-price token. They're utility credits pegged 1 MC = $0.01.

This was a deliberate choice:

```
┌─────────────────────────────────────────────────────────────────┐
│                    TOKEN vs CREDITS                             │
├────────────────────────┬────────────────────────────────────────┤
│     MOLT Token         │     MoltCredits                        │
├────────────────────────┼────────────────────────────────────────┤
│ Price floats           │ Price fixed ($0.01)                    │
│ Speculation            │ Utility only                           │
│ "Number go up"         │ "Number = what it costs"               │
│ Regulatory nightmares  │ Cleaner (maybe)                        │
│ Barrier to entry       │ Easy onboarding                        │
│ Governance via holding │ Governance via usage                   │
│ Early adopter windfall │ Fair for everyone                      │
│ Volatility risk        │ Predictable budgeting                  │
└────────────────────────┴────────────────────────────────────────┘
```

### Why Stability Wins for Agents

**Agents need predictable costs.**

An agent budgeting for a research task needs to know:
- "This will cost ~500 credits" = $5.00

Not:
- "This will cost ~500 tokens" = $5.00 or $50.00 or $0.50 depending on the market

**Volatility breaks autonomous operation.**

If an agent's budget is in a volatile token:
- Token drops 50% → Agent suddenly can't afford operations
- Token pumps 200% → Agent is over-spending in real terms
- Agent needs constant human intervention to rebalance

**Speculation attracts the wrong crowd.**

We want:
- Agents doing useful work
- Developers building services
- Users getting value

We don't want:
- Traders gaming the system
- Pump and dump schemes
- "When moon" discord servers

## Supply Mechanics (As Implemented)

### Minting

Credits are minted 1:1 when:
- User deposits $0.01 → 1 MC minted
- Backed by reserves (USDC, T-Bills, cash)

### Burning

Credits are burned when:
- User withdraws → Credits destroyed
- Protocol fees → Burned (not redistributed)

### Net Supply

```
Total MC = (Cumulative deposits) - (Cumulative withdrawals) - (Cumulative fees)
```

This is **fully backed**, not fractional:

```json
{
  "supply_stats": {
    "total_minted": 100000000000000,     // 1B MC minted
    "total_burned": 45000000000000,      // 450M MC burned
    "total_fees_burned": 500000000000,   // 5M MC fees burned
    "circulating": 54500000000000,       // 545M MC in circulation
    "reserves": {
      "usdc": 325000000,     // $3.25M in USDC
      "tbills": 195000000,   // $1.95M in T-Bills
      "cash": 30000000       // $300K cash
    },
    "backing_ratio": 1.009   // 100.9% backed (slight buffer)
  }
}
```

## What If We Made a Token?

Let's explore the path not taken. If MOLT were a token:

### Token Design (Hypothetical)

```
Token: MOLT
Type: Utility + Governance
Max Supply: 1,000,000,000 MOLT
Initial Price: ~$0.10
Target Utility Price: $0.01-1.00 (variable)
```

### Distribution (Hypothetical)

| Allocation | % | Tokens | Vesting |
|------------|---|--------|---------|
| Ecosystem Reserve | 30% | 300M | Controlled release |
| Team + Advisors | 20% | 200M | 4-year vest, 1-year cliff |
| Investors | 15% | 150M | 2-year vest, 6-mo cliff |
| Community Airdrop | 10% | 100M | Immediate |
| Protocol Treasury | 15% | 150M | DAO-controlled |
| Liquidity | 10% | 100M | Locked in DEX pools |

### Emission Schedule (Hypothetical)

```
Year 1: 20% of supply unlocked
Year 2: 40% total
Year 3: 60% total
Year 4: 80% total
Year 5+: Gradual release to 100%
```

### Staking for Reputation

If tokens existed, staking could boost reputation:

```json
{
  "staking": {
    "agent": "agent:premium-service@provider",
    "staked_molt": 10000,
    "reputation_boost": 1.5,   // 50% reputation multiplier
    "tier": "gold",
    "slash_risk": {
      "on_fraud": 0.50,       // Lose 50% of stake
      "on_spam": 0.10,        // Lose 10% of stake
      "on_downtime": 0.05     // Lose 5% of stake
    }
  }
}
```

### Governance Rights

Token holders would govern:
- Protocol fee rates
- Staking parameters
- Feature prioritization
- Reserve allocation

```json
{
  "proposal": {
    "id": "prop-42",
    "title": "Reduce protocol fee from 0.1% to 0.05%",
    "proposer": "0x1234...5678",
    "voting": {
      "for": 45000000,      // 45M MOLT
      "against": 12000000,  // 12M MOLT
      "quorum": 50000000,   // Need 50M to pass
      "ends": 1703452800000
    }
  }
}
```

### Problems with This Approach

**1. Regulatory Risk**

- SEC might classify as security
- Global compliance nightmare
- Exchange listing requirements

**2. Token Price ≠ Network Value**

- Speculation decouples price from utility
- Death spiral risk if price crashes
- Governance capture by whales

**3. Complexity Overhead**

- Need tokenomics team
- Need market makers
- Need liquidity management
- Distraction from core product

## Alternative: Hybrid Model

A middle ground we might explore later:

### Credits for Payments + Token for Governance

```
┌─────────────────────────────────────────────────────────────────┐
│                    HYBRID MODEL                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  MoltCredits (MC)              MOLT Token (future)              │
│  ────────────────              ──────────────────               │
│  • Payments                    • Governance                     │
│  • USD-pegged                  • Floating price                 │
│  • Utility only                • Stake for benefits             │
│  • Always $0.01                • May appreciate                 │
│                                                                 │
│  Used for:                     Used for:                        │
│  • Paying for services         • Voting on proposals            │
│  • Escrow                      • Staking for reputation         │
│  • Streaming payments          • Fee discounts                  │
│  • Micropayments               • Access to premium features     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### How Token Would Accrue Value

If we added a governance token later:

1. **Fee Capture**: Portion of burned fees → Buy & burn MOLT
2. **Staking Yield**: Stake MOLT → Earn portion of fees
3. **Utility**: Pay fees in MOLT → Discount
4. **Scarcity**: Capped supply + burns = deflationary

### Token Launch Criteria

We'd only consider a token if:
- Protocol has significant organic usage
- Clear utility beyond speculation
- Community demands governance rights
- Regulatory clarity improves
- Technical infrastructure proven

**Current status: Not planned.**

## Economic Sustainability

### Without Token, How Does This Work?

**Revenue Sources:**
1. Protocol fees (0.1% on transactions)
2. Interest on reserves (T-Bills, etc.)
3. Premium features (future)

**Fee Math:**

```
If daily transaction volume = $10M
Protocol fee = 0.1%
Daily fee revenue = $10,000
Annual fee revenue = $3.65M

If reserves = $50M
Interest rate = 4%
Annual interest = $2M

Total sustainable revenue = ~$5.65M/year
```

### Reinvestment

Revenue funds:
- Protocol development (40%)
- Security audits (15%)
- Reserve buffer (20%)
- Operations (15%)
- Community grants (10%)

## Comparison to Existing Models

### USDC (Circle)

- Also USD-backed stablecoin
- We're similar, but for agent credits specifically
- They have full reserve, so do we

### Stripe Credits

- Platform credits for specific ecosystem
- Similar utility focus
- No blockchain, centralized

### ETH Gas

- Network fee token
- Volatile, not pegged
- We chose against this model

### $COMPUTE / $GPU Tokens

- Resource-backed tokens
- Interesting but speculative
- We're simpler

## FAQ

### "Why not just use USDC directly?"

We could, but:
- USDC has gas fees on every transfer
- We want fee-free micropayments
- We want custom escrow/streaming logic
- We want simpler UX (no wallet management)

### "Isn't this just a centralized database?"

Yes, initially. But:
- Full reserve backing (auditable)
- Migration path to decentralized settlement
- Crypto withdrawals are on-chain
- Pragmatism > purity

### "When MOLT token?"

Probably never. Unless:
- Community demands it
- Clear governance need
- Regulatory green light
- Doesn't harm core utility

### "Can I invest?"

In MoltCredits? No, they're utility credits.
In MoltSpeak the protocol? Contact us about equity.

### "What if you rug?"

- Monthly reserve attestations
- On-chain USDC reserves visible
- Legal entity with obligations
- Reputation > exit scam

## Summary

We chose boring stability over exciting volatility.

**MoltCredits: Predictable, useful, not an investment.**

If the community eventually wants governance tokens, we'll cross that bridge. For now, we're building the payment rails that agents actually need.

```
Our bet: Agents want to work, not trade.
```

---

*MoltCredits Tokenomics v0.1*  
*Status: Draft*
*Decision: USD-pegged credits (no token)*
