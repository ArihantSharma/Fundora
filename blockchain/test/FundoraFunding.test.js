const { expect } = require("chai");
const { ethers } = require("hardhat");

// Helper: register a simple 2-milestone startup in the contract.
// milestoneAmounts must sum to target.
async function registerStartup(contract, owner, startupId, founderAddr, opts = {}) {
  const target      = opts.target      ?? ethers.parseEther("1.0");
  const required    = opts.required    ?? 2;
  const titles      = opts.titles      ?? ["Prototype", "MVP"];
  const amounts     = opts.amounts     ?? [ethers.parseEther("0.4"), ethers.parseEther("0.6")];

  await contract.connect(owner).registerStartup(
    startupId, "Test Startup", founderAddr, target, required, titles, amounts
  );
}

describe("FundoraFunding", function () {

  let contract, owner, founder, investor1, investor2, dao1, dao2, dao3;

  beforeEach(async function () {
    [owner, founder, investor1, investor2, dao1, dao2, dao3] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("FundoraFunding");
    contract = await Factory.deploy();
  });

  // ── Registration ────────────────────────────────────────────────

  describe("registerStartup", function () {

    it("registers a startup and emits StartupRegistered", async function () {
      await expect(
        contract.connect(owner).registerStartup(
          1, "EcoTech", founder.address,
          ethers.parseEther("1.0"), 2,
          ["Prototype", "MVP"],
          [ethers.parseEther("0.4"), ethers.parseEther("0.6")]
        )
      ).to.emit(contract, "StartupRegistered")
       .withArgs(1, "EcoTech", ethers.parseEther("1.0"));
    });

    it("reverts if milestone amounts do not sum to target", async function () {
      await expect(
        contract.connect(owner).registerStartup(
          1, "Bad", founder.address,
          ethers.parseEther("1.0"), 2,
          ["A", "B"],
          [ethers.parseEther("0.3"), ethers.parseEther("0.3")] // sums to 0.6, not 1.0
        )
      ).to.be.revertedWith("Milestone amounts must sum to target");
    });

    it("reverts if registering the same startup twice", async function () {
      await registerStartup(contract, owner, 1, founder.address);
      await expect(
        registerStartup(contract, owner, 1, founder.address)
      ).to.be.revertedWith("Already registered");
    });

    it("reverts if called by a non-owner", async function () {
      await expect(
        registerStartup(contract, investor1, 1, founder.address)
      ).to.be.revertedWith("Only owner");
    });

    it("reverts if founder address is zero", async function () {
      await expect(
        contract.connect(owner).registerStartup(
          1, "Bad", ethers.ZeroAddress,
          ethers.parseEther("1.0"), 2,
          ["A"], [ethers.parseEther("1.0")]
        )
      ).to.be.revertedWith("Invalid founder address");
    });
  });

  // ── Funding ─────────────────────────────────────────────────────

  describe("fundStartup", function () {

    beforeEach(async function () {
      await registerStartup(contract, owner, 1, founder.address);
    });

    it("accepts a valid contribution and emits Funded", async function () {
      await expect(
        contract.connect(investor1).fundStartup(1, { value: ethers.parseEther("0.5") })
      ).to.emit(contract, "Funded")
       .withArgs(1, investor1.address, ethers.parseEther("0.5"));

      const info = await contract.getStartupInfo(1);
      expect(info.raised).to.equal(ethers.parseEther("0.5"));
    });

    it("reverts on a zero contribution", async function () {
      await expect(
        contract.connect(investor1).fundStartup(1, { value: 0 })
      ).to.be.revertedWith("Contribution must be > 0");
    });

    it("reverts when contribution exceeds remaining target", async function () {
      // Fund most of the target first.
      await contract.connect(investor1).fundStartup(1, { value: ethers.parseEther("0.9") });
      // Trying to add another 0.5 ETH would push raised to 1.4, above 1.0 target.
      await expect(
        contract.connect(investor2).fundStartup(1, { value: ethers.parseEther("0.5") })
      ).to.be.revertedWith("Exceeds funding target");
    });

    it("allows multiple investors to fund the same startup", async function () {
      await contract.connect(investor1).fundStartup(1, { value: ethers.parseEther("0.4") });
      await contract.connect(investor2).fundStartup(1, { value: ethers.parseEther("0.6") });
      const info = await contract.getStartupInfo(1);
      expect(info.raised).to.equal(ethers.parseEther("1.0"));
    });

    it("reverts for an unregistered startup", async function () {
      await expect(
        contract.connect(investor1).fundStartup(99, { value: ethers.parseEther("0.1") })
      ).to.be.revertedWith("Startup not registered");
    });
  });

  // ── Voting ───────────────────────────────────────────────────────

  describe("approveMilestone", function () {

    beforeEach(async function () {
      await registerStartup(contract, owner, 1, founder.address);
    });

    it("records a YES vote and emits Voted", async function () {
      await expect(
        contract.connect(dao1).approveMilestone(1, 0)
      ).to.emit(contract, "Voted")
       .withArgs(1, 0, dao1.address, true);

      const info = await contract.getMilestoneInfo(1, 0);
      expect(info.yesVotes).to.equal(1);
    });

    it("reverts on duplicate vote from same address", async function () {
      await contract.connect(dao1).approveMilestone(1, 0);
      await expect(
        contract.connect(dao1).approveMilestone(1, 0)
      ).to.be.revertedWith("Already voted");
    });

    it("allows different addresses to vote independently", async function () {
      await contract.connect(dao1).approveMilestone(1, 0);
      await contract.connect(dao2).approveMilestone(1, 0);
      const info = await contract.getMilestoneInfo(1, 0);
      expect(info.yesVotes).to.equal(2);
    });

    it("reverts voting on an invalid milestone index", async function () {
      await expect(
        contract.connect(dao1).approveMilestone(1, 99)
      ).to.be.revertedWith("Invalid milestone index");
    });

    it("reverts voting on an already-released milestone", async function () {
      // Fund fully, vote enough, release.
      await contract.connect(investor1).fundStartup(1, { value: ethers.parseEther("1.0") });
      await contract.connect(dao1).approveMilestone(1, 0);
      await contract.connect(dao2).approveMilestone(1, 0);
      await contract.connect(owner).releaseMilestone(1, 0);
      // Vote should now revert.
      await expect(
        contract.connect(dao3).approveMilestone(1, 0)
      ).to.be.revertedWith("Milestone already released");
    });
  });

  // ── Release ──────────────────────────────────────────────────────

  describe("releaseMilestone", function () {

    beforeEach(async function () {
      await registerStartup(contract, owner, 1, founder.address);
      // Fund the full target so there is ETH to release.
      await contract.connect(investor1).fundStartup(1, { value: ethers.parseEther("1.0") });
    });

    it("releases tranche to founder when votes are sufficient", async function () {
      await contract.connect(dao1).approveMilestone(1, 0);
      await contract.connect(dao2).approveMilestone(1, 0); // requiredVotes = 2

      const beforeBalance = await ethers.provider.getBalance(founder.address);
      await expect(
        contract.connect(owner).releaseMilestone(1, 0)
      ).to.emit(contract, "MilestoneReleased")
       .withArgs(1, 0, ethers.parseEther("0.4"));

      const afterBalance = await ethers.provider.getBalance(founder.address);
      // Founder should have received 0.4 ETH.
      expect(afterBalance - beforeBalance).to.equal(ethers.parseEther("0.4"));
    });

    it("reverts if not enough YES votes", async function () {
      // Only 1 vote, but requiredVotes = 2.
      await contract.connect(dao1).approveMilestone(1, 0);
      await expect(
        contract.connect(owner).releaseMilestone(1, 0)
      ).to.be.revertedWith("Not enough YES votes");
    });

    it("reverts on duplicate release of the same milestone", async function () {
      await contract.connect(dao1).approveMilestone(1, 0);
      await contract.connect(dao2).approveMilestone(1, 0);
      await contract.connect(owner).releaseMilestone(1, 0);
      await expect(
        contract.connect(owner).releaseMilestone(1, 0)
      ).to.be.revertedWith("Already released");
    });

    it("reverts release from non-owner", async function () {
      await contract.connect(dao1).approveMilestone(1, 0);
      await contract.connect(dao2).approveMilestone(1, 0);
      await expect(
        contract.connect(investor1).releaseMilestone(1, 0)
      ).to.be.revertedWith("Only owner");
    });

    it("handles releasing the second milestone independently", async function () {
      // Release first milestone.
      await contract.connect(dao1).approveMilestone(1, 0);
      await contract.connect(dao2).approveMilestone(1, 0);
      await contract.connect(owner).releaseMilestone(1, 0);

      // Now vote and release second milestone.
      await contract.connect(dao1).approveMilestone(1, 1);
      await contract.connect(dao2).approveMilestone(1, 1);
      const beforeBalance = await ethers.provider.getBalance(founder.address);
      await contract.connect(owner).releaseMilestone(1, 1);
      const afterBalance = await ethers.provider.getBalance(founder.address);
      expect(afterBalance - beforeBalance).to.equal(ethers.parseEther("0.6"));
    });
  });

  // ── View helpers ─────────────────────────────────────────────────

  describe("view functions", function () {

    it("getStartupInfo returns correct initial state", async function () {
      await registerStartup(contract, owner, 1, founder.address);
      const info = await contract.getStartupInfo(1);
      expect(info.name).to.equal("Test Startup");
      expect(info.founder).to.equal(founder.address);
      expect(info.target).to.equal(ethers.parseEther("1.0"));
      expect(info.raised).to.equal(0n);
      expect(info.milestoneCount).to.equal(2n);
    });

    it("getMilestoneInfo returns correct initial state", async function () {
      await registerStartup(contract, owner, 1, founder.address);
      const m = await contract.getMilestoneInfo(1, 0);
      expect(m.title).to.equal("Prototype");
      expect(m.amount).to.equal(ethers.parseEther("0.4"));
      expect(m.yesVotes).to.equal(0n);
      expect(m.released).to.equal(false);
    });

    it("hasVotedOnMilestone returns false before voting and true after", async function () {
      await registerStartup(contract, owner, 1, founder.address);
      expect(await contract.hasVotedOnMilestone(1, 0, dao1.address)).to.equal(false);
      await contract.connect(dao1).approveMilestone(1, 0);
      expect(await contract.hasVotedOnMilestone(1, 0, dao1.address)).to.equal(true);
    });

    it("contractBalance reflects funded ETH", async function () {
      await registerStartup(contract, owner, 1, founder.address);
      await contract.connect(investor1).fundStartup(1, { value: ethers.parseEther("0.7") });
      expect(await contract.contractBalance()).to.equal(ethers.parseEther("0.7"));
    });
  });
});
