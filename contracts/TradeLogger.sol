// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * TradeLogger — On-chain audit log for PacificaPilot AI trading decisions.
 * Deployed on BSC (BNB Smart Chain) — four.meme AI Sprint 2026.
 */
contract TradeLogger {

    event DecisionLogged(
        uint256 indexed id,
        address indexed agent,
        string  tokenSymbol,
        string  action,          // "BUY" | "SELL" | "HOLD"
        uint256 priceInWei,
        int256  pnlUsdc,         // realised PnL x 1e6, 0 if none
        uint8   confidence,      // 0-100
        uint8   bondingCurvePct, // four.meme bonding curve fill %
        uint32  socialScore,     // Elfa AI engagement score
        string  reasoning,       // plain-English from Gemini
        bool    dryRun
    );

    struct Decision {
        uint256 id;
        address agent;
        string  tokenSymbol;
        address tokenAddress;
        string  action;
        uint256 priceInWei;
        int256  pnlUsdc;
        uint8   confidence;
        uint8   bondingCurvePct;
        uint32  socialScore;
        uint32  mentionCount;
        uint16  holderCount;
        bool    isTrending;
        string  reasoning;
        bool    dryRun;
        uint256 timestamp;
    }

    address public owner;
    uint256 public totalDecisions;

    mapping(uint256 => Decision)  public decisions;
    mapping(address => uint256[]) public agentDecisions;
    mapping(address => bool)      public authorizedAgents;

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyAgent() {
        require(authorizedAgents[msg.sender] || msg.sender == owner, "Not authorised");
        _;
    }

    constructor() {
        owner = msg.sender;
        authorizedAgents[msg.sender] = true;
    }

    function addAgent(address agent) external onlyOwner {
        authorizedAgents[agent] = true;
    }

    function removeAgent(address agent) external onlyOwner {
        authorizedAgents[agent] = false;
    }

    function logDecision(
        string  calldata tokenSymbol,
        address          tokenAddress,
        string  calldata action,
        uint256          priceInWei,
        int256           pnlUsdc,
        uint8            confidence,
        uint8            bondingCurvePct,
        uint32           socialScore,
        uint32           mentionCount,
        uint16           holderCount,
        bool             isTrending,
        string  calldata reasoning,
        bool             dryRun
    ) external onlyAgent returns (uint256 id) {
        id = ++totalDecisions;

        decisions[id] = Decision({
            id:              id,
            agent:           msg.sender,
            tokenSymbol:     tokenSymbol,
            tokenAddress:    tokenAddress,
            action:          action,
            priceInWei:      priceInWei,
            pnlUsdc:         pnlUsdc,
            confidence:      confidence,
            bondingCurvePct: bondingCurvePct,
            socialScore:     socialScore,
            mentionCount:    mentionCount,
            holderCount:     holderCount,
            isTrending:      isTrending,
            reasoning:       reasoning,
            dryRun:          dryRun,
            timestamp:       block.timestamp
        });

        agentDecisions[msg.sender].push(id);

        emit DecisionLogged(
            id, msg.sender, tokenSymbol, action,
            priceInWei, pnlUsdc, confidence,
            bondingCurvePct, socialScore, reasoning, dryRun
        );
    }

    function getDecision(uint256 id) external view returns (Decision memory) {
        require(id > 0 && id <= totalDecisions, "Not found");
        return decisions[id];
    }

    function getAgentDecisionIds(address agent) external view returns (uint256[] memory) {
        return agentDecisions[agent];
    }

    function getRecentDecisions(uint256 count) external view returns (Decision[] memory) {
        uint256 total = totalDecisions;
        if (count > total) count = total;
        Decision[] memory result = new Decision[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = decisions[total - i];
        }
        return result;
    }

    function verifyReasoning(uint256 id, string calldata reasoning) external view returns (bool) {
        require(id > 0 && id <= totalDecisions, "Not found");
        return keccak256(bytes(decisions[id].reasoning)) == keccak256(bytes(reasoning));
    }
}
