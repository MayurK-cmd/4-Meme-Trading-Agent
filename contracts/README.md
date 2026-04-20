# TradeLogger Smart Contract

On-chain audit log for 4MemePilot AI trading decisions on BNB Smart Chain.

## Contract Address

| Network | Address | Explorer |
|---------|---------|----------|
| **BSC Testnet** | `0xEe39002BF9783DB5dac224Df968D0e3c5CE39a2B` | [View on Testnet BSCScan](https://testnet.bscscan.com/address/0xEe39002BF9783DB5dac224Df968D0e3c5CE39a2B) |

> **Note:** TradeLogger is deployed on testnet to reduce gas costs during development. The 4.meme trading itself executes on **BSC mainnet**.

## Purpose

Every AI trading decision is logged to this contract for:
- **Transparency**: All decisions publicly verifiable on BSCScan
- **Auditability**: Prove the AI's reasoning and track record
- **Tamper-proof**: Once logged, decisions cannot be modified

## Events

```solidity
event DecisionLogged(
    uint256 indexed id,
    address indexed agent,
    string  tokenSymbol,
    string  action,          // "BUY" | "SELL" | "HOLD"
    uint256 priceInWei,
    int256  pnlUsdc,         // realised PnL x 1e6, 0 if none
    uint8   confidence,      // 0-100
    uint8   bondingCurvePct, // 4.meme bonding curve fill %
    uint32  socialScore,     // Elfa AI engagement score
    string  reasoning,       // plain-English from Gemini
    bool    dryRun
);
```

## Functions

### `logDecision(...)`

Log a new trading decision.

```solidity
function logDecision(
    string calldata tokenSymbol,
    address          tokenAddress,
    string calldata action,
    uint256          priceInWei,
    int256           pnlUsdc,
    uint8            confidence,
    uint8            bondingCurvePct,
    uint32           socialScore,
    uint32           mentionCount,
    uint16           holderCount,
    bool             isTrending,
    string calldata reasoning,
    bool             dryRun
) external onlyAgent returns (uint256 id)
```

### `getDecision(uint256 id)`

Retrieve a specific decision by ID.

### `getAgentDecisionIds(address agent)`

Get all decision IDs for a specific agent.

### `getRecentDecisions(uint256 count)`

Get the most recent decisions (newest first).

## View on BSCScan

- [TradeLogger Contract](https://bscscan.com/address/0xEe39002BF9783DB5dac224Df968D0e3c5CE39a2B)
- [Decision Logs (Events)](https://bscscan.com/address/0xEe39002BF9783DB5dac224Df968D0e3c5CE39a2B#events)

## Deployment

```
Network: BNB Smart Chain Testnet
Chain ID: 97
RPC: https://bsc-testnet-dataseed.bnbchain.org
Explorer: https://testnet.bscscan.com
```

### Hybrid Architecture

| Component | Network | Reason |
|-----------|---------|--------|
| TradeLogger Contract | Testnet | Low-cost audit logging |
| 4.meme Trading | Mainnet | Real memecoin liquidity |
| Wallet Auth (Privy) | Testnet | Test BNB for gas fees |

## Access Control

- **Owner**: Can add/remove authorized agents
- **Authorized Agents**: Can log decisions
- **Public**: Anyone can read decisions

## Gas Costs

Typical gas cost for logging a decision: ~150,000-200,000 gas

At 3 gwei: ~0.0006 BNB (~$0.36 at $600/BNB)

## Integration

The 4MemePilot agent automatically logs every decision to this contract when:
- `DRY_RUN=false` (live mode)
- A decision is made (BUY/SELL/HOLD)

Dry-run mode decisions are NOT logged to save gas.
