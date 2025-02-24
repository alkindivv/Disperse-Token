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
  // Deploy RelayerFactory
  const RelayerFactory = await ethers.getContractFactory("RelayerFactory");
  const factory = await RelayerFactory.deploy();
  await factory.deployed();
  console.log("RelayerFactory deployed to:", factory.address);

  // Setup
  const [sender] = await ethers.getSigners();
  console.log("\nSender address:", sender.address);
  const tokenAddress = "0x779877A7B0D9E8603169DdbD7836e478b4624789"; // USDC di Sepolia
  const token = await ethers.getContractAt("IERC20", tokenAddress);

  // Check balance
  const balance = await token.balanceOf(sender.address);
  console.log("Token balance:", ethers.utils.formatUnits(balance, 18));

  // Create minimum required relayers
  console.log("\nCreating relayer contracts...");
  const relayerAddresses = [];
  const numRelayers = 5;

  for (let i = 0; i < numRelayers; i++) {
    const tx = await factory.createRelayer(tokenAddress);
    const receipt = await tx.wait();
    const event = receipt.events.find((e) => e.event === "RelayerCreated");
    const relayerAddress = event.args.relayer;
    relayerAddresses.push(relayerAddress);
    console.log(`Relayer ${i} created at:`, relayerAddress);
  }

  // Generate random amounts for each relayer
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

  // Approve tokens for all relayers
  console.log("\nApproving tokens for relayers...");
  for (let i = 0; i < relayerAddresses.length; i++) {
    const approveTx = await token.approve(relayerAddresses[i], amounts[i]);
    await approveTx.wait();
    console.log(
      `Approved ${ethers.utils.formatUnits(
        amounts[i],
        18
      )} tokens for relayer ${i}`
    );
  }

  // Send tokens to relayers
  console.log("\nSending tokens to relayers...");
  for (let i = 0; i < relayerAddresses.length; i++) {
    const relayer = await ethers.getContractAt(
      "RelayerContract",
      relayerAddresses[i]
    );
    const tx = await relayer.receiveTokens(amounts[i]);
    await tx.wait();
    console.log(
      `Sent ${ethers.utils.formatUnits(amounts[i], 18)} tokens to relayer ${i}`
    );
  }

  // Final recipients
  const finalRecipients = [
    "0xfa2f86d6a28988e98c4b2fae00a78107fd79dd97",
    "0x73d10238fedbbf5aa237f429c411324aa3227d5b",
  ];

  // Forward tokens dengan random delay
  console.log("\nForwarding tokens to final recipients...");
  for (let i = 0; i < relayerAddresses.length; i++) {
    const relayer = await ethers.getContractAt(
      "RelayerContract",
      relayerAddresses[i]
    );
    const amount = amounts[i];
    const finalRecipient = finalRecipients[i % finalRecipients.length];

    // Check next forward time
    const nextForwardTime = await relayer.getNextForwardTime();
    const currentTime = Math.floor(Date.now() / 1000);
    const waitTime = nextForwardTime.sub(currentTime).toNumber();

    if (waitTime > 0) {
      console.log(
        `Waiting ${waitTime} seconds before forwarding from relayer ${i}...`
      );
      await delay(waitTime * 1000);
    }

    try {
      // Verify sender authorization
      const authorizedSender = await relayer.sender();
      console.log(`Relayer ${i} authorized sender:`, authorizedSender);
      console.log(`Sender address:`, sender.address);

      // Get balance before forwarding
      const balance = await relayer.getBalance();
      console.log(
        `Relayer ${i} token balance:`,
        ethers.utils.formatUnits(balance, 18)
      );

      // Forward tokens
      const tx = await relayer.forwardTokens(finalRecipient, amount, {
        gasLimit: 200000,
      });
      await tx.wait();
      console.log(
        `Forwarded ${ethers.utils.formatUnits(
          amount,
          18
        )} tokens to ${finalRecipient}`
      );
    } catch (error) {
      if (error.message.includes("Not authorized sender")) {
        console.error(`Error: Sender is not authorized for relayer ${i}`);
      } else {
        console.error(
          `Error forwarding tokens from relayer ${i}:`,
          error.message
        );
      }
    }

    // Random additional delay
    const randomDelay = Math.floor(Math.random() * 5000) + 5000; // 5-10 seconds
    await delay(randomDelay);
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
