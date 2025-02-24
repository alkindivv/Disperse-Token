// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract SimplePrivateDisperse is ReentrancyGuard {
    // Events
    event Deposit(bytes32 indexed commitment, uint256 amount);
    event Withdrawal(address indexed recipient, uint256 amount);

    // Mapping untuk menyimpan deposits
    mapping(bytes32 => uint256) public deposits;

    // Mapping untuk mencegah double-spend
    mapping(bytes32 => bool) public nullifiers;

    // Deposit token dengan commitment
    function deposit(
        address token,
        uint256 amount,
        bytes32 commitment
    ) external nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        require(deposits[commitment] == 0, "Commitment already exists");

        // Transfer token ke contract
        IERC20(token).transferFrom(msg.sender, address(this), amount);

        // Simpan deposit
        deposits[commitment] = amount;

        emit Deposit(commitment, amount);
    }

    // Withdraw token dengan nullifier dan recipient
    function withdraw(
        address token,
        address recipient,
        uint256 amount,
        bytes32 commitment,
        bytes32 nullifier
    ) external nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        require(deposits[commitment] >= amount, "Insufficient deposit");
        require(!nullifiers[nullifier], "Nullifier already used");

        // Mark nullifier sebagai used
        nullifiers[nullifier] = true;

        // Update deposit amount
        deposits[commitment] -= amount;

        // Transfer token ke recipient
        IERC20(token).transfer(recipient, amount);

        emit Withdrawal(recipient, amount);
    }

    // Batch deposit untuk multiple recipients
    function batchDeposit(
        address token,
        uint256[] memory amounts,
        bytes32[] memory commitments
    ) external nonReentrant {
        require(amounts.length == commitments.length, "Length mismatch");

        uint256 totalAmount = 0;
        for(uint256 i = 0; i < amounts.length; i++) {
            totalAmount += amounts[i];
            require(deposits[commitments[i]] == 0, "Commitment already exists");
        }

        // Transfer total amount
        IERC20(token).transferFrom(msg.sender, address(this), totalAmount);

        // Process deposits
        for(uint256 i = 0; i < amounts.length; i++) {
            deposits[commitments[i]] = amounts[i];
            emit Deposit(commitments[i], amounts[i]);
        }
    }
}