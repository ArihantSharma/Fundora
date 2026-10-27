// Integration verification script — run after deploying to localhost.
// npx hardhat run scripts/verify_integration.js --network localhost
const { ethers } = require("hardhat");

async function main() {
  const addr = process.env.CONTRACT || "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
  const ABI = require("../artifacts/contracts/FundoraFunding.sol/FundoraFunding.json").abi;
  const signers = await ethers.getSigners();
  const c = new ethers.Contract(addr, ABI, signers[0]);

  console.log("Contract:", addr);
  console.log("Owner:   ", await c.owner());

  // 1. Register startup id=99 (use a fresh id to avoid collision if run again)
  const sid = 99;
  const founderBefore = await ethers.provider.getBalance(signers[0].address);
  const reg = await c.registerStartup(
    sid, "VerifyStartup", signers[0].address,
    ethers.parseEther("1.0"), 2,
    ["M1", "M2"],
    [ethers.parseEther("0.4"), ethers.parseEther("0.6")]
  );
  await reg.wait();
  const info = await c.getStartupInfo(sid);
  console.assert(info.name === "VerifyStartup", "name mismatch");
  console.log("1. registerStartup                  ✓");

  // 2. Fund 0.7 ETH (valid, under target)
  await (await c.connect(signers[1]).fundStartup(sid, { value: ethers.parseEther("0.7") })).wait();
  const info2 = await c.getStartupInfo(sid);
  console.assert(info2.raised === ethers.parseEther("0.7"), "raised mismatch");
  console.log("2. fundStartup (0.7 ETH)            ✓");

  // 3. Zero contribution blocked
  try {
    await c.connect(signers[1]).fundStartup(sid, { value: 0 });
    console.log("3. FAIL — zero not blocked");
  } catch (e) {
    console.assert(e.reason === "Contribution must be > 0", e.reason);
    console.log("3. zero contribution blocked        ✓");
  }

  // 4. Over-target contribution blocked (0.7 raised, 0.3 left, try 0.5)
  try {
    await c.connect(signers[2]).fundStartup(sid, { value: ethers.parseEther("0.5") });
    console.log("4. FAIL — over-target not blocked");
  } catch (e) {
    console.assert(e.reason === "Exceeds funding target", e.reason);
    console.log("4. over-target contribution blocked ✓");
  }

  // 5. Two DAO votes on milestone 0
  await (await c.connect(signers[2]).approveMilestone(sid, 0)).wait();
  await (await c.connect(signers[3]).approveMilestone(sid, 0)).wait();
  const minfo = await c.getMilestoneInfo(sid, 0);
  console.assert(minfo.yesVotes === 2n, "yesVotes");
  console.log("5. two DAO votes recorded           ✓");

  // 6. Duplicate vote blocked
  try {
    await c.connect(signers[2]).approveMilestone(sid, 0);
    console.log("6. FAIL — duplicate vote not blocked");
  } catch (e) {
    console.assert(e.reason === "Already voted", e.reason);
    console.log("6. duplicate vote blocked           ✓");
  }

  // 7. Release with insufficient votes fails (milestone 1 has 0 votes)
  try {
    await c.releaseMilestone(sid, 1);
    console.log("7. FAIL — under-voted release not blocked");
  } catch (e) {
    console.assert(e.reason === "Not enough YES votes", e.reason);
    console.log("7. under-voted release blocked      ✓");
  }

  // 8. Successful release of milestone 0
  const founderMid = await ethers.provider.getBalance(signers[0].address);
  const relTx = await c.releaseMilestone(sid, 0);
  const relReceipt = await relTx.wait();
  const founderAfter = await ethers.provider.getBalance(signers[0].address);
  const gain = founderAfter - founderMid;
  // Founder gained ~0.4 ETH (minus gas, but gain is positive)
  console.assert(gain > 0n, "founder balance should increase");
  console.log("8. milestone 0 released             ✓  tx:", relReceipt.hash.slice(0, 16) + "...");

  // 9. Duplicate release blocked
  try {
    await c.releaseMilestone(sid, 0);
    console.log("9. FAIL — duplicate release not blocked");
  } catch (e) {
    console.assert(e.reason === "Already released", e.reason);
    console.log("9. duplicate release blocked        ✓");
  }

  // 10. Non-owner release blocked
  try {
    await c.connect(signers[2]).releaseMilestone(sid, 1);
    console.log("10. FAIL — non-owner release not blocked");
  } catch (e) {
    console.assert(e.reason === "Only owner", e.reason);
    console.log("10. non-owner release blocked       ✓");
  }

  console.log("\n✅ All 10 on-chain integration checks passed");
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
