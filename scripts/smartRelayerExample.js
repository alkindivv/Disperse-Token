const { ethers } = require("hardhat");

async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getRandomAmount() {
  const min = ethers.utils.parseUnits("0.0001", 18);
  const max = ethers.utils.parseUnits("0.001", 18);
  const range = max.sub(min);
  const randomBN = ethers.BigNumber.from(ethers.utils.randomBytes(32));
  return min.add(randomBN.mod(range));
}

async function main() {
  const [sender] = await ethers.getSigners();

  // Deploy contracts
  console.log("Deploying contracts...");
  const RelayerFactory = await ethers.getContractFactory("RelayerFactory");
  const factory = await RelayerFactory.deploy();
  await factory.deployed();
  console.log("RelayerFactory deployed to:", factory.address);

  const TokenPool = await ethers.getContractFactory("TokenPool");
  const pool = await TokenPool.deploy();
  await pool.deployed();
  console.log("TokenPool deployed to:", pool.address);

  // Setup
  console.log("\nSender address:", sender.address);
  const tokenAddress = "0x779877A7B0D9E8603169DdbD7836e478b4624789"; // USDC di Sepolia
  const token = await ethers.getContractAt("IERC20", tokenAddress);

  // Check balance
  const balance = await token.balanceOf(sender.address);
  console.log("Token balance:", ethers.utils.formatUnits(balance, 18));

  // Create first layer relayers
  console.log("\nCreating first layer relayer contracts...");
  const firstLayerRelayers = [];
  const numRelayers = 1;

  for (let i = 0; i < numRelayers; i++) {
    const tx = await factory.createRelayer(tokenAddress);
    const receipt = await tx.wait();
    const event = receipt.events.find((e) => e.event === "RelayerCreated");
    const relayerAddress = event.args.relayer;
    firstLayerRelayers.push(relayerAddress);
    console.log(`First layer relayer ${i} created at:`, relayerAddress);

    await pool.authorizeRelayer(relayerAddress, 1);
    console.log(`Authorized first layer relayer ${i} in pool`);

    await delay(2000);
  }

  // Create second layer relayers
  console.log("\nCreating second layer relayer contracts...");
  const secondLayerRelayers = [];

  for (let i = 0; i < numRelayers; i++) {
    const tx = await factory.createRelayer(tokenAddress);
    const receipt = await tx.wait();
    const event = receipt.events.find((e) => e.event === "RelayerCreated");
    const relayerAddress = event.args.relayer;
    secondLayerRelayers.push(relayerAddress);
    console.log(`Second layer relayer ${i} created at:`, relayerAddress);

    await pool.authorizeRelayer(relayerAddress, 2);
    console.log(`Authorized second layer relayer ${i} in pool`);

    await delay(2000);
  }

  // Generate random amounts
  const amounts = [];
  let totalAmount = ethers.BigNumber.from(0);

  for (let i = 0; i < numRelayers; i++) {
    const amount = await getRandomAmount();
    amounts.push(amount);
    totalAmount = totalAmount.add(amount);
  }

  console.log(
    "\nTotal amount needed:",
    ethers.utils.formatUnits(totalAmount, 18)
  );

  // Send tokens to first layer relayers
  console.log("\nSending tokens to first layer relayers...");
  for (let i = 0; i < firstLayerRelayers.length; i++) {
    const relayer = await ethers.getContractAt(
      "RelayerContract",
      firstLayerRelayers[i]
    );
    const amount = amounts[i];

    try {
      // Approve relayer
      const approveTx = await token
        .connect(sender)
        .approve(firstLayerRelayers[i], amount);
      await approveTx.wait();
      console.log(
        `Approved ${ethers.utils.formatUnits(
          amount,
          18
        )} tokens for first layer relayer ${i}`
      );

      // Send tokens
      const tx = await relayer.connect(sender).receiveTokens(amount, {
        gasLimit: 300000,
      });
      await tx.wait();
      console.log(
        `Sent ${ethers.utils.formatUnits(
          amount,
          18
        )} tokens to first layer relayer ${i}`
      );

      await delay(3000);
    } catch (error) {
      console.error(
        `Error sending tokens to first layer relayer ${i}:`,
        error.message
      );
    }
  }

  // Forward to pool
  console.log("\nForwarding tokens from first layer relayers to pool...");
  for (let i = 0; i < firstLayerRelayers.length; i++) {
    const relayer = await ethers.getContractAt(
      "RelayerContract",
      firstLayerRelayers[i]
    );
    const amount = amounts[i];

    try {
      // Check relayer balance
      const balance = await token.balanceOf(firstLayerRelayers[i]);
      console.log(
        `First layer relayer ${i} balance:`,
        ethers.utils.formatUnits(balance, 18)
      );

      // Approve pool from sender
      const approveTx = await token
        .connect(sender)
        .approve(pool.address, amount);
      await approveTx.wait();
      console.log(`Approved pool to spend tokens from sender`);

      // Forward to pool as relayer owner
      const tx = await pool
        .connect(sender)
        .receiveTokens(tokenAddress, firstLayerRelayers[i], amount, {
          gasLimit: 300000,
        });
      await tx.wait();
      console.log(
        `Forwarded ${ethers.utils.formatUnits(
          amount,
          18
        )} tokens to pool from relayer ${i}`
      );

      // Verify pool balance
      const poolBalance = await pool.getPoolBalance(tokenAddress);
      console.log(
        `Pool balance after forward:`,
        ethers.utils.formatUnits(poolBalance, 18)
      );

      await delay(3000);
    } catch (error) {
      console.error(
        `Error forwarding tokens from first layer relayer ${i}:`,
        error.message
      );
    }
  }

  // Wait for pool conditions
  console.log("\nChecking pool conditions...");
  const poolBalance = await pool.getPoolBalance(tokenAddress);
  console.log(
    "Current pool balance:",
    ethers.utils.formatUnits(poolBalance, 18)
  );

  // Add delay check and wait
  const nextForwardTime = await pool.getNextForwardTime();
  const currentTime = Math.floor(Date.now() / 1000);
  const waitTime = Math.max(0, nextForwardTime.toNumber() - currentTime);

  if (waitTime > 0) {
    console.log(
      `Waiting ${waitTime} seconds before forwarding to second layer...`
    );
    await delay(waitTime * 1000);
  }

  // Forward to second layer
  console.log("\nForwarding tokens from pool to second layer relayers...");
  const amountPerRelayer = poolBalance.div(secondLayerRelayers.length);

  for (let i = 0; i < secondLayerRelayers.length; i++) {
    try {
      const tx = await pool
        .connect(sender)
        .forwardToSecondLayer(
          tokenAddress,
          secondLayerRelayers[i],
          amountPerRelayer,
          {
            gasLimit: 300000,
          }
        );
      await tx.wait();
      console.log(
        `Forwarded ${ethers.utils.formatUnits(
          amountPerRelayer,
          18
        )} tokens to second layer relayer ${i}`
      );

      // Verify second layer balance
      const relayerBalance = await token.balanceOf(secondLayerRelayers[i]);
      console.log(
        `Second layer relayer ${i} balance:`,
        ethers.utils.formatUnits(relayerBalance, 18)
      );
    } catch (error) {
      console.error(
        `Error forwarding to second layer relayer ${i}:`,
        error.message
      );
    }

    await delay(3000);
  }

  // Forward to final recipients
  console.log(
    "\nForwarding tokens from second layer relayers to final recipients..."
  );
  const finalRecipients = [
    "0xfa2f86d6a28988e98c4b2fae00a78107fd79dd97",
    "0x73d10238fedbbf5aa237f429c411324aa3227d5b",
  ];

  for (let i = 0; i < secondLayerRelayers.length; i++) {
    const relayer = await ethers.getContractAt(
      "RelayerContract",
      secondLayerRelayers[i]
    );
    const recipient = finalRecipients[i % finalRecipients.length];

    try {
      const balance = await token.balanceOf(secondLayerRelayers[i]);
      console.log(
        `Second layer relayer ${i} balance:`,
        ethers.utils.formatUnits(balance, 18)
      );

      const tx = await relayer
        .connect(sender)
        .forwardTokens(recipient, balance, {
          gasLimit: 300000,
        });
      await tx.wait();
      console.log(
        `Forwarded ${ethers.utils.formatUnits(
          balance,
          18
        )} tokens to ${recipient}`
      );
    } catch (error) {
      console.error(
        `Error forwarding from second layer relayer ${i}:`,
        error.message
      );
    }

    await delay(3000);
  }

  // Check final balances
  console.log("\nFinal balances:");
  for (const recipient of finalRecipients) {
    const recipientBalance = await token.balanceOf(recipient);
    console.log(
      `${recipient}: ${ethers.utils.formatUnits(recipientBalance, 18)}`
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
