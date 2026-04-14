// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * TradeLogger — On-chain audit log for PacificaPilot AI trading decisions.
 * Deployed on BSC (BNB Smart Chain) — compatible with four.meme AI Sprint.
 *
 * Every time the agent makes a trading decision (BUY / SELL / HOLD),
 * it calls logDecision() which stores a permanent, tamper-proof record on-chain.
 *
 * Signals logged: social engagement (Elfa AI), holder count, bonding curve stage,
 * liquidity, confidence score, and Gemini's plain-English reasoning.
 */
contract TradeLogger {

    // ── Events ────────────────────────────────────────────────────────────────

    event DecisionLogged(
        uint256 indexed id,
        address indexed agent,
        string  tokenSymbol,
        address tokenAddress,       // BSC contract address of the meme token
        string  action,             // "BUY" | "SELL" | "HOLD"
        uint256 priceInWei,         // token price in wei (BNB-denominated)
        int256  pnlUsdc,            // realised PnL × 1e6 (0 if no position closed)
        uint8   confidence,         // 0–100 from Gemini
        uint32  socialScore,        // Elfa AI engagement score (0–10000)
        uint32  mentionCount,       // Elfa AI 24h mention count
        uint16  holderCount,        // on-chain holder count at decision time
        uint8   bondingCurvePct,    // four.meme bonding curve fill % (0–100)
        bool    isTrending,         // was token in Elfa trending list?
        bytes32 reasoningHash,      // keccak256 of full Gemini reasoning string
        bool    dryRun
    );

    // ── Storage ───────────────────────────────────────────────────────────────

    struct Decision {
        uint256 id;
        address agent;
        string  tokenSymbol;
        address tokenAddress;
        string  action;
        uint256 priceInWei;
        int256  pnlUsdc;
        uint8   confidence;
        uint32  socialScore;
        uint32  mentionCount;
        uint16  holderCount;
        uint8   bondingCurvePct;
        bool    isTrending;
        bytes32 reasoningHash;      // hash stored on-chain; full text stored off-chain
        bool    dryRun;
        uint256 timestamp;
    }

    address public owner;
    uint256 public totalDecisions;

    mapping(uint256 => Decision) public decisions;
    mapping(address => uint256[]) public agentDecisions;

    // ── Access control ────────────────────────────────────────────────────────

    mapping(address => bool) public authorizedAgents;

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyAgent() {
        require(
            authorizedAgents[msg.sender] || msg.sender == owner,
            "Not authorised agent"
        );
        _;
    }

    // ── Constructor ───────────────────────────────────────────────────────────

    constructor() {
        owner = msg.sender;
        authorizedAgents[msg.sender] = true;
    }

    // ── Agent management ──────────────────────────────────────────────────────

    function addAgent(address agent) external onlyOwner {
        authorizedAgents[agent] = true;
    }

    function removeAgent(address agent) external onlyOwner {
        authorizedAgents[agent] = false;
    }

    // ── Core logging function ─────────────────────────────────────────────────

    /**
     * @param tokenSymbol       e.g. "PEPE", "DOGE2"
     * @param tokenAddress      BSC contract address of the meme token
     * @param action            "BUY" | "SELL" | "HOLD"
     * @param priceInWei        Token price in wei at decision time
     * @param pnlUsdc           Realised PnL × 1e6 (0 if no closed position)
     * @param confidence        0–100 integer from Gemini
     * @param socialScore       Elfa AI engagement score (0–10000)
     * @param mentionCount      Elfa AI 24h mention count for this token
     * @param holderCount       On-chain holder count at decision time
     * @param bondingCurvePct   four.meme bonding curve fill percentage (0–100)
     * @param isTrending        True if token appeared in Elfa trending list
     * @param reasoning         Full plain-English reasoning from Gemini (hashed on-chain)
     * @param dryRun            True if paper trading
     */
    function logDecision(
        string  calldata tokenSymbol,
        address          tokenAddress,
        string  calldata action,
        uint256          priceInWei,
        int256           pnlUsdc,
        uint8            confidence,
        uint32           socialScore,
        uint32           mentionCount,
        uint16           holderCount,
        uint8            bondingCurvePct,
        bool             isTrending,
        string  calldata reasoning,
        bool             dryRun
    ) external onlyAgent returns (uint256 id) {
        id = ++totalDecisions;

        bytes32 reasoningHash = keccak256(bytes(reasoning));

        decisions[id] = Decision({
            id:               id,
            agent:            msg.sender,
            tokenSymbol:      tokenSymbol,
            tokenAddress:     tokenAddress,
            action:           action,
            priceInWei:       priceInWei,
            pnlUsdc:          pnlUsdc,
            confidence:       confidence,
            socialScore:      socialScore,
            mentionCount:     mentionCount,
            holderCount:      holderCount,
            bondingCurvePct:  bondingCurvePct,
            isTrending:       isTrending,
            reasoningHash:    reasoningHash,
            dryRun:           dryRun,
            timestamp:        block.timestamp
        });

        agentDecisions[msg.sender].push(id);

        emit DecisionLogged(
            id, msg.sender, tokenSymbol, tokenAddress,
            action, priceInWei, pnlUsdc, confidence,
            socialScore, mentionCount, holderCount,
            bondingCurvePct, isTrending, reasoningHash, dryRun
        );
    }

    // ── Read functions ────────────────────────────────────────────────────────

    function getDecision(uint256 id) external view returns (Decision memory) {
        require(id > 0 && id <= totalDecisions, "Decision not found");
        return decisions[id];
    }

    function getAgentDecisionCount(address agent) external view returns (uint256) {
        return agentDecisions[agent].length;
    }

    function getAgentDecisionIds(address agent)
        external view returns (uint256[] memory)
    {
        return agentDecisions[agent];
    }

    /**
     * Get the last N decisions across all agents (newest first).
     * Useful for the frontend dashboard.
     */
    function getRecentDecisions(uint256 count)
        external view returns (Decision[] memory)
    {
        uint256 total = totalDecisions;
        if (count > total) count = total;
        Decision[] memory result = new Decision[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = decisions[total - i];
        }
        return result;
    }

    /**
     * Verify that a reasoning string matches the on-chain hash for a decision.
     * Frontend can use this to prove the full reasoning text hasn't been tampered with.
     */
    function verifyReasoning(uint256 id, string calldata reasoning)
        external view returns (bool)
    {
        require(id > 0 && id <= totalDecisions, "Decision not found");
        return decisions[id].reasoningHash == keccak256(bytes(reasoning));
    }
}
