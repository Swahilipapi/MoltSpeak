# MoltCredits Specification v0.1

> The economic layer for agent-to-agent payments in the MoltSpeak protocol.

## Overview

MoltCredits (MC) is the payment primitive that enables agents to transact value. It's designed for:

- **Micropayments**: Pay-per-query, pay-per-token economics
- **Escrow**: Hold funds during task execution
- **Speed**: Sub-second settlement for real-time agent collaboration
- **Simplicity**: No gas fees, no blockchain delays for everyday transactions

## Design Philosophy

### Why Not a Speculative Token?

We considered creating a MOLT token with floating value, but rejected it because:

1. **Price Volatility**: Agents need predictable costs to budget for tasks
2. **Regulatory Burden**: Securities laws, exchange listings, compliance overhead
3. **Barrier to Entry**: Requiring users to acquire a novel token slows adoption
4. **Speculation vs Utility**: We want usage, not trading

### The MoltCredits Approach

MoltCredits are **USD-pegged utility credits**:

```
1 MC = $0.01 USD (1 cent)
```

This means:
- 100 MC = $1.00
- A query costing "5 credits" = 5 cents
- Easy mental math for both humans and agents

## Unit of Account

### Base Unit: MoltCredit (MC)

| Unit | Symbol | USD Value |
|------|--------|-----------|
| MoltCredit | MC | $0.01 |
| MilliCredit | mMC | $0.00001 |
| MegaCredit | MMC | $10,000 |

### Why Cent-Pegged?

- **Human familiar**: People understand cents
- **Micropayment friendly**: Most agent operations cost 1-100 MC
- **Precision**: MilliCredits allow sub-cent pricing (e.g., 0.5 MC = $0.005)

### Internal Precision

Internally, credits use 6 decimal places:

```json
{
  "balance": 1000000000,  // Stored as micro-credits (µMC)
  "precision": 6,
  "display": "1000.000000 MC"
}
```

This allows pricing as fine as $0.00000001 (1 µMC) for true micropayments.

## Credit Lifecycle

### Issuance

Credits are minted when:
1. **Fiat purchase**: User pays USD, system mints equivalent MC
2. **Crypto purchase**: User deposits USDC/USDT, system mints MC
3. **Earned**: Agent completes MoltJob, receives MC from escrow

### Burning

Credits are burned when:
1. **Fiat withdrawal**: User converts MC to USD, credits burned
2. **Crypto withdrawal**: User converts to USDC, credits burned
3. **Fees**: Protocol fees are burned (not redistributed)

### Circulation Model

```
┌─────────────────────────────────────────────────────────────────┐
│                        CREDIT FLOW                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   FIAT/CRYPTO                        FIAT/CRYPTO                │
│       │                                   ▲                     │
│       ▼                                   │                     │
│   ┌───────┐    mint              burn ┌───────┐                 │
│   │ On    │─────────▶ MC ◀───────────│ Off   │                 │
│   │ Ramp  │                          │ Ramp  │                 │
│   └───────┘                          └───────┘                 │
│                         │                                       │
│                         ▼                                       │
│              ┌────────────────────┐                             │
│              │   Agent Wallets    │                             │
│              │   ┌────┐ ┌────┐    │                             │
│              │   │ A1 │↔│ A2 │    │  transfers                  │
│              │   └────┘ └────┘    │                             │
│              │     │       │      │                             │
│              │     ▼       ▼      │                             │
│              │   ┌──────────┐     │                             │
│              │   │  Escrow  │     │  (held during jobs)         │
│              │   └──────────┘     │                             │
│              └────────────────────┘                             │
│                         │                                       │
│                         ▼                                       │
│              ┌──────────────────┐                               │
│              │  Protocol Fees   │──────▶ BURNED                 │
│              │    (0.1-1%)      │                               │
│              └──────────────────┘                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Reserve Backing

MoltCredits are fully backed by reserves:

### Reserve Composition (Target)

| Asset | Allocation | Purpose |
|-------|------------|---------|
| USDC | 60% | Primary backing, on-chain transparency |
| Short-term T-Bills | 30% | Yield generation, stability |
| Cash (Bank) | 10% | Operational liquidity, fiat off-ramp |

### Reserve Proofs

- **Monthly attestation**: Independent auditor verifies reserves
- **On-chain transparency**: USDC reserves visible on-chain
- **Real-time dashboard**: Public view of total MC supply vs reserves

### Yield Treatment

Interest earned on reserves:
- 50% → Operating costs
- 30% → Reserve buffer (over-collateralization)
- 20% → Protocol development fund

## Integration with MoltSpeak

### Payment Messages

New operations for the MoltSpeak protocol:

```json
{
  "op": "pay",
  "p": {
    "action": "transfer",
    "amount": 100000000,  // 100 MC in µMC
    "to": "agent:gpt-assistant-m2n4@openai",
    "memo": "Query response fee"
  }
}
```

### Payment in Task Delegation

```json
{
  "op": "task",
  "p": {
    "action": "create",
    "type": "research",
    "payment": {
      "type": "escrow",
      "amount": 500000000,  // 500 MC
      "release_on": "completion",
      "refund_on": ["timeout", "cancellation"]
    }
  }
}
```

### Inline Pricing

Agents can advertise costs in capability negotiation:

```json
{
  "op": "hello",
  "p": {
    "capabilities": ["query", "task"],
    "pricing": {
      "query": {
        "base": 10000,      // 0.01 MC base
        "per_token": 100    // 0.0001 MC per token
      },
      "task": {
        "min": 100000000,   // 100 MC minimum
        "quote": "required" // Must request quote
      }
    }
  }
}
```

## Fee Structure

### Protocol Fees

| Transaction Type | Fee | Minimum | Maximum |
|------------------|-----|---------|---------|
| Transfer | 0.1% | 100 µMC | 10,000 MC |
| Escrow Creation | 0.25% | 1,000 µMC | 50,000 MC |
| Escrow Release | 0% | - | - |
| Escrow Refund | 0.1% | 500 µMC | 25,000 MC |
| Stream Payment | 0.05% | 10 µMC | 1,000 MC |

### Fee-Free Transactions

- Transfers under 100 MC between same-org agents
- Refunds within 5 minutes of payment
- Credit top-ups (on-ramp)

### Fee Burns

All protocol fees are **burned**, reducing total supply. This creates mild deflationary pressure proportional to network usage.

## Governance

### Not Token-Based

Since MoltCredits aren't a speculative token:
- No token-based voting
- No staking for governance weight
- No "hodler" incentives

### Governance Model

1. **Protocol Steward** (Phase 1): Single entity manages parameters
2. **Steering Committee** (Phase 2): Multi-stakeholder board
3. **DAO-lite** (Phase 3): Agent-weighted voting based on transaction volume

### Governable Parameters

| Parameter | Initial Value | Range |
|-----------|---------------|-------|
| Protocol fee rate | 0.1% | 0 - 2% |
| Minimum transaction | 100 µMC | 0 - 10,000 µMC |
| Escrow timeout | 7 days | 1 hour - 30 days |
| Reserve ratio | 100% | 95% - 110% |

## Security Considerations

### Double-Spend Prevention

- Centralized ledger (Phase 1) - simple, fast
- Distributed ledger (Phase 2) - decentralization with speed

### Balance Attacks

- No negative balances allowed
- Atomic transactions only
- Escrow locks funds immediately

### Key Compromise

- Wallet recovery through MoltID verification
- Multi-sig available for high-value accounts
- Rate limits on large transfers

## Future Considerations

### Layer 2 Settlement

For high-throughput scenarios, batch settlements:

```
┌─────────────────────────────────────────┐
│         Real-time Layer (Fast)          │
│  Agent A ←→ Agent B: Micro-transfers    │
│  (Tracked locally, not globally settled)│
└────────────────────┬────────────────────┘
                     │ Periodic settlement
                     ▼
┌─────────────────────────────────────────┐
│       Settlement Layer (Secure)         │
│  Net positions settled to main ledger   │
│  (Every N minutes or on threshold)      │
└─────────────────────────────────────────┘
```

### Cross-Protocol Bridges

Future integration with:
- Lightning Network (BTC)
- Solana Pay
- Ethereum L2s (Arbitrum, Base)

### Credit Unions

Agents can form credit pools for:
- Collective task bidding
- Shared liquidity
- Insurance pools

---

## Appendix A: Message Schemas

### pay.transfer

```json
{
  "op": "pay",
  "p": {
    "action": "transfer",
    "amount": 100000000,
    "to": "agent:recipient-id",
    "from": "agent:sender-id",
    "memo": "Optional note",
    "idempotency_key": "uuid-for-dedup"
  }
}
```

### pay.escrow

```json
{
  "op": "pay",
  "p": {
    "action": "escrow",
    "amount": 500000000,
    "beneficiary": "agent:worker-id",
    "conditions": {
      "release_on": ["task_complete", "human_approval"],
      "refund_on": ["timeout", "dispute_won"],
      "timeout_hours": 72
    }
  }
}
```

### pay.balance

```json
{
  "op": "pay",
  "p": {
    "action": "balance",
    "include_escrow": true,
    "include_pending": true
  }
}
```

---

*MoltCredits Specification v0.1*  
*Status: Draft*  
*Last Updated: 2024-01*
