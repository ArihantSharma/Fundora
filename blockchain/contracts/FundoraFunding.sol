// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * FundoraFunding — on-chain funding escrow for the Fundora prototype.
 *
 * How it works:
 *   1. The contract owner registers a startup with its funding target
 *      and a list of milestone tranches that must add up to that target.
 *   2. Investors call fundStartup() and send ETH. Their contribution is
 *      held inside the contract (escrow) until a milestone is released.
 *   3. DAO members call approveMilestone(). Once a milestone receives
 *      enough YES votes (>= requiredVotes), the owner can call
 *      releaseMilestone() and the tranche is transferred to the founder.
 *   4. The contract enforces:
 *        - Contributions cannot be zero or exceed the remaining target.
 *        - Each address can only vote once per milestone.
 *        - A milestone can only be released once.
 *        - Release only succeeds when approval conditions are met.
 *        - Tranches cannot exceed total committed funds.
 */
contract FundoraFunding {

    address public owner;

    // ── Data structures ───────────────────────────────────────────

    struct Milestone {
        string  title;
        uint256 amount;       // tranche size in wei
        uint256 yesVotes;
        bool    released;
        mapping(address => bool) hasVoted;
    }

    struct Startup {
        string   name;
        address  founder;     // receives milestone payouts
        uint256  target;      // total funding target in wei
        uint256  raised;      // total contributed so far
        uint256  requiredVotes; // minimum YES votes to pass a milestone
        bool     exists;
        uint256  milestoneCount;
        mapping(uint256 => Milestone) milestones; // index 0, 1, 2 …
    }

    // startupId (matches backend DB id) → Startup
    mapping(uint256 => Startup) private startups;

    // ── Events ────────────────────────────────────────────────────

    event StartupRegistered(uint256 indexed startupId, string name, uint256 target);
    event Funded(uint256 indexed startupId, address indexed investor, uint256 amount);
    event Voted(uint256 indexed startupId, uint256 indexed milestoneIndex, address indexed voter, bool approved);
    event MilestoneReleased(uint256 indexed startupId, uint256 indexed milestoneIndex, uint256 amount);

    // ── Modifiers ─────────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier startupExists(uint256 startupId) {
        require(startups[startupId].exists, "Startup not registered");
        _;
    }

    // ── Constructor ───────────────────────────────────────────────

    constructor() {
        owner = msg.sender;
    }

    // ── Owner actions ─────────────────────────────────────────────

    /**
     * Register a startup with its milestones.
     * milestoneAmounts must sum to target.
     * Called by the backend/owner after a startup is DAO-approved off-chain.
     */
    function registerStartup(
        uint256         startupId,
        string calldata name,
        address         founder,
        uint256         target,
        uint256         requiredVotes,
        string[] calldata milestoneTitles,
        uint256[] calldata milestoneAmounts
    ) external onlyOwner {
        require(!startups[startupId].exists, "Already registered");
        require(founder != address(0), "Invalid founder address");
        require(target > 0, "Target must be > 0");
        require(milestoneTitles.length == milestoneAmounts.length, "Milestone arrays length mismatch");
        require(milestoneTitles.length > 0, "Need at least one milestone");

        // Verify the tranches add up to the target.
        uint256 sum = 0;
        for (uint256 i = 0; i < milestoneAmounts.length; i++) {
            sum += milestoneAmounts[i];
        }
        require(sum == target, "Milestone amounts must sum to target");

        Startup storage s = startups[startupId];
        s.name           = name;
        s.founder        = founder;
        s.target         = target;
        s.raised         = 0;
        s.requiredVotes  = requiredVotes;
        s.exists         = true;
        s.milestoneCount = milestoneTitles.length;

        for (uint256 i = 0; i < milestoneTitles.length; i++) {
            s.milestones[i].title    = milestoneTitles[i];
            s.milestones[i].amount   = milestoneAmounts[i];
            s.milestones[i].yesVotes = 0;
            s.milestones[i].released = false;
        }

        emit StartupRegistered(startupId, name, target);
    }

    /**
     * Release a milestone tranche to the founder.
     * Can only be called by the owner and only when the milestone
     * has received enough YES votes and was not already released.
     * Tranche must not exceed the contract's current ETH balance.
     */
    function releaseMilestone(uint256 startupId, uint256 milestoneIndex)
        external
        onlyOwner
        startupExists(startupId)
    {
        Startup storage s = startups[startupId];
        require(milestoneIndex < s.milestoneCount, "Invalid milestone index");

        Milestone storage m = s.milestones[milestoneIndex];
        require(!m.released, "Already released");
        require(m.yesVotes >= s.requiredVotes, "Not enough YES votes");
        require(m.amount <= address(this).balance, "Insufficient contract balance");

        m.released = true;
        (bool sent, ) = s.founder.call{value: m.amount}("");
        require(sent, "ETH transfer failed");

        emit MilestoneReleased(startupId, milestoneIndex, m.amount);
    }

    // ── Investor actions ──────────────────────────────────────────

    /**
     * Invest in a startup by sending ETH with this call.
     * Reverts if the startup is not registered, the amount is zero,
     * or it would push raised above target.
     */
    function fundStartup(uint256 startupId)
        external
        payable
        startupExists(startupId)
    {
        require(msg.value > 0, "Contribution must be > 0");
        Startup storage s = startups[startupId];
        require(s.raised + msg.value <= s.target, "Exceeds funding target");

        s.raised += msg.value;
        emit Funded(startupId, msg.sender, msg.value);
    }

    // ── DAO member actions ────────────────────────────────────────

    /**
     * Cast a YES vote on a milestone. Each address can only vote once.
     * Voting is still open even after the threshold is met so late
     * votes are recorded — the owner simply calls releaseMilestone
     * once the threshold is reached.
     */
    function approveMilestone(uint256 startupId, uint256 milestoneIndex)
        external
        startupExists(startupId)
    {
        Startup storage s = startups[startupId];
        require(milestoneIndex < s.milestoneCount, "Invalid milestone index");

        Milestone storage m = s.milestones[milestoneIndex];
        require(!m.released, "Milestone already released");
        require(!m.hasVoted[msg.sender], "Already voted");

        m.hasVoted[msg.sender] = true;
        m.yesVotes += 1;

        emit Voted(startupId, milestoneIndex, msg.sender, true);
    }

    // ── View functions ────────────────────────────────────────────

    function getStartupInfo(uint256 startupId)
        external
        view
        startupExists(startupId)
        returns (
            string memory name,
            address founder,
            uint256 target,
            uint256 raised,
            uint256 requiredVotes,
            uint256 milestoneCount
        )
    {
        Startup storage s = startups[startupId];
        return (s.name, s.founder, s.target, s.raised, s.requiredVotes, s.milestoneCount);
    }

    function getMilestoneInfo(uint256 startupId, uint256 milestoneIndex)
        external
        view
        startupExists(startupId)
        returns (
            string memory title,
            uint256 amount,
            uint256 yesVotes,
            bool released
        )
    {
        Startup storage s = startups[startupId];
        require(milestoneIndex < s.milestoneCount, "Invalid milestone index");
        Milestone storage m = s.milestones[milestoneIndex];
        return (m.title, m.amount, m.yesVotes, m.released);
    }

    function hasVotedOnMilestone(uint256 startupId, uint256 milestoneIndex, address voter)
        external
        view
        startupExists(startupId)
        returns (bool)
    {
        return startups[startupId].milestones[milestoneIndex].hasVoted[voter];
    }

    function contractBalance() external view returns (uint256) {
        return address(this).balance;
    }
}
