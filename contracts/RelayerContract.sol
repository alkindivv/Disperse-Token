// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract RelayerContract is ReentrancyGuard, Ownable {
    // Events
    event TokenReceived(address indexed token, uint256 amount);
    event TokenForwarded(address indexed token, address indexed recipient, uint256 amount);
    event DelayUpdated(uint256 newDelay);

    // State variables
    IERC20 public immutable token;
    uint256 public minDelay;
    uint256 public lastForwardTime;
    bool public active;
    address public sender;

    // Konstanta
    uint256 public constant MIN_DELAY = 10 seconds; // Diubah dari 1 jam menjadi 10 detik untuk testing

    constructor(address _token, uint256 _minDelay, address _sender) {
        token = IERC20(_token);
        minDelay = _minDelay;
        active = true;
        sender = _sender;
        lastForwardTime = block.timestamp;
    }

    modifier onlySender() {
        require(msg.sender == sender, "Not authorized sender");
        _;
    }

    modifier isActive() {
        require(active, "Relayer not active");
        _;
    }

    // Receive tokens
    function receiveTokens(uint256 amount) external nonReentrant isActive onlySender {
        require(amount > 0, "Invalid amount");
        require(token.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        emit TokenReceived(address(token), amount);
    }

    // Forward tokens ke recipient dengan delay
    function forwardTokens(
        address recipient,
        uint256 amount
    ) external nonReentrant onlySender isActive {
        require(recipient != address(0), "Invalid recipient");
        require(amount > 0, "Invalid amount");
        require(token.balanceOf(address(this)) >= amount, "Insufficient token balance");
        require(block.timestamp >= lastForwardTime + minDelay, "Too soon");

        lastForwardTime = block.timestamp;
        require(token.transfer(recipient, amount), "Transfer failed");
        emit TokenForwarded(address(token), recipient, amount);
    }

    // Update delay
    function updateDelay(uint256 _minDelay) external onlySender {
        require(_minDelay >= MIN_DELAY, "Delay too short");
        minDelay = _minDelay;
        emit DelayUpdated(_minDelay);
    }

    // Deactivate relayer
    function deactivate() external onlySender {
        active = false;
    }

    // Reactivate relayer
    function activate() external onlySender {
        active = true;
    }

    // Emergency withdraw tokens
    function emergencyWithdraw() external onlySender {
        uint256 balance = token.balanceOf(address(this));
        require(balance > 0, "No token balance");
        require(token.transfer(sender, balance), "Transfer failed");
    }

    // View functions
    function getBalance() external view returns (uint256) {
        return token.balanceOf(address(this));
    }

    function getNextForwardTime() external view returns (uint256) {
        uint256 nextTime = lastForwardTime + minDelay;
        return block.timestamp >= nextTime ? block.timestamp : nextTime;
    }
}