// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract TokenPool is ReentrancyGuard {
    // Events
    event TokensReceived(address indexed token, address indexed from, uint256 amount);
    event TokensForwarded(address indexed token, address indexed to, uint256 amount);
    event RelayerAuthorized(address indexed relayer, uint8 layer);

    // State variables
    mapping(address => bool) public isFirstLayerRelayer;
    mapping(address => bool) public isSecondLayerRelayer;
    mapping(address => uint256) public poolBalance;
    mapping(address => address) public relayerOwner;
    uint256 public constant MIN_POOL_SIZE = 0.0001 ether;
    uint256 public constant MIN_DELAY = 10 seconds;
    uint256 public lastForwardTime;

    constructor() {
        lastForwardTime = block.timestamp;
    }

    // Authorize relayer untuk layer tertentu
    function authorizeRelayer(address relayer, uint8 layer) external {
        require(msg.sender == tx.origin, "Only EOA can authorize");
        require(layer == 1 || layer == 2, "Invalid layer");

        if (layer == 1) {
            isFirstLayerRelayer[relayer] = true;
            relayerOwner[relayer] = msg.sender;
        } else {
            isSecondLayerRelayer[relayer] = true;
            relayerOwner[relayer] = msg.sender;
        }

        emit RelayerAuthorized(relayer, layer);
    }

    // Receive tokens dari first layer relayers
    function receiveTokens(address token, address relayer, uint256 amount) external nonReentrant {
        require(isFirstLayerRelayer[relayer], "Not authorized first layer relayer");
        require(relayerOwner[relayer] == msg.sender, "Not relayer owner");
        require(amount > 0, "Amount must be greater than 0");

        IERC20 tokenContract = IERC20(token);
        require(tokenContract.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        poolBalance[token] += amount;

        emit TokensReceived(token, relayer, amount);
    }

    // Forward tokens ke second layer relayers
    function forwardToSecondLayer(
        address token,
        address secondLayerRelayer,
        uint256 amount
    ) external nonReentrant {
        require(msg.sender == relayerOwner[secondLayerRelayer], "Not relayer owner");
        require(isSecondLayerRelayer[secondLayerRelayer], "Not authorized second layer relayer");
        require(block.timestamp >= lastForwardTime + MIN_DELAY, "Too soon to forward");
        require(poolBalance[token] >= MIN_POOL_SIZE, "Pool size too small");
        require(amount <= poolBalance[token], "Insufficient pool balance");

        lastForwardTime = block.timestamp;
        poolBalance[token] -= amount;

        IERC20 tokenContract = IERC20(token);
        require(tokenContract.transfer(secondLayerRelayer, amount), "Transfer failed");

        emit TokensForwarded(token, secondLayerRelayer, amount);
    }

    // View functions
    function getPoolBalance(address token) external view returns (uint256) {
        return poolBalance[token];
    }

    function isRelayerAuthorized(address relayer, uint8 layer) external view returns (bool) {
        if (layer == 1) {
            return isFirstLayerRelayer[relayer];
        } else if (layer == 2) {
            return isSecondLayerRelayer[relayer];
        }
        return false;
    }

    function getNextForwardTime() external view returns (uint256) {
        return lastForwardTime + MIN_DELAY;
    }
}