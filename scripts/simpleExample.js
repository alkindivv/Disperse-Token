const { ethers } = require("hardhat");

async function generateCommitment(recipient, amount, secret) {
  return ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      ["address", "uint256", "bytes32"],
      [recipient, amount, secret]
    )
  );
}

async function generateNullifier(commitment, secret) {
  return ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      ["bytes32", "bytes32"],
      [commitment, secret]
    )
  );
}

async function main() {
  // Deploy contract
  const SimplePrivateDisperse = await ethers.getContractFactory(
    "SimplePrivateDisperse"
  );
  const disperse = await SimplePrivateDisperse.deploy();
  await disperse.deployed();
  console.log("Contract deployed to:", disperse.address);

  // Setup
  const [sender] = await ethers.getSigners();
  console.log("\nSender address:", sender.address);

  const tokenAddress = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14"; // USDC di Sepolia
  const token = await ethers.getContractAt("IERC20", tokenAddress);

  // Check token balance
  const balance = await token.balanceOf(sender.address);
  console.log("Token balance:", ethers.utils.formatUnits(balance, 18));

  // Recipients dan amounts (kurangi amount untuk test)
  const recipients = [
    "0xfa2f86d6a28988e98c4b2fae00a78107fd79dd97",
    "0x73d10238fedbbf5aa237f429c411324aa3227d5b",
  ];
  const amounts = [
    ethers.utils.parseUnits("0.001", 18), // 0.001 token
    ethers.utils.parseUnits("0.001", 18), // 0.001 token
  ];

  // Generate random secrets untuk setiap recipient
  const secrets = [];
  const commitments = [];
  const nullifiers = [];

  for (let i = 0; i < recipients.length; i++) {
    // Generate random secret
    const secret = ethers.utils.hexlify(ethers.utils.randomBytes(32));
    secrets.push(secret);

    // Generate commitment
    const commitment = await generateCommitment(
      recipients[i],
      amounts[i],
      secret
    );
    commitments.push(commitment);

    // Generate nullifier
    const nullifier = await generateNullifier(commitment, secret);
    nullifiers.push(nullifier);

    console.log(`\nRecipient ${i}:`);
    console.log("Address:", recipients[i]);
    console.log("Amount:", ethers.utils.formatUnits(amounts[i], 18));
    console.log("Secret:", secret);
    console.log("Commitment:", commitment);
    console.log("Nullifier:", nullifier);
  }

  // Calculate total amount
  const totalAmount = amounts.reduce((a, b) => a.add(b));
  console.log(
    "\nTotal amount to transfer:",
    ethers.utils.formatUnits(totalAmount, 18)
  );

  // Check allowance
  const allowance = await token.allowance(sender.address, disperse.address);
  console.log("Current allowance:", ethers.utils.formatUnits(allowance, 18));

  // Approve tokens dengan gas limit
  console.log("\nApproving tokens...");
  const approveTx = await token.approve(disperse.address, totalAmount, {
    gasLimit: 100000,
  });
  await approveTx.wait();
  console.log("Tokens approved");

  // Batch deposit dengan gas limit
  console.log("\nDepositing tokens...");
  const depositTx = await disperse.batchDeposit(
    tokenAddress,
    amounts,
    commitments,
    {
      gasLimit: 500000,
    }
  );
  await depositTx.wait();
  console.log("Tokens deposited");

  // Tunggu beberapa block untuk privasi yang lebih baik
  console.log("\nWaiting for a few blocks...");
  await new Promise((resolve) => setTimeout(resolve, 30000)); // Tunggu 30 detik

  // Withdraw tokens dengan gas limit
  for (let i = 0; i < recipients.length; i++) {
    console.log(`\nWithdrawing for recipient ${i}...`);
    const withdrawTx = await disperse.withdraw(
      tokenAddress,
      recipients[i],
      amounts[i],
      commitments[i],
      nullifiers[i],
      {
        gasLimit: 200000,
      }
    );
    await withdrawTx.wait();
    console.log("Withdrawal successful");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
