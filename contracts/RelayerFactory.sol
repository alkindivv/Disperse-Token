// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./RelayerContract.sol";

contract RelayerFactory {
    // Events
    event RelayerCreated(address indexed relayer, address indexed sender);
    event RelayerRegistered(address indexed relayer);

    // State variables
    mapping(address => bool) public isRegisteredRelayer;
    address[] public relayers;
    uint256 public constant MIN_RELAYERS = 5;
    uint256 public constant DEFAULT_DELAY = 1 hours;

    // Create new relayer contract
    function createRelayer(address token) external returns (address) {
        RelayerContract relayer = new RelayerContract(token, DEFAULT_DELAY, msg.sender);
        address relayerAddress = address(relayer);

        isRegisteredRelayer[relayerAddress] = true;
        relayers.push(relayerAddress);

        emit RelayerCreated(relayerAddress, msg.sender);
        emit RelayerRegistered(relayerAddress);

        return relayerAddress;
    }

    // Get all registered relayers
    function getRelayers() external view returns (address[] memory) {
        return relayers;
    }

    // Get number of registered relayers
    function getRelayerCount() external view returns (uint256) {
        return relayers.length;
    }

    // Check if we have minimum required relayers
    function hasMinimumRelayers() external view returns (bool) {
        return relayers.length >= MIN_RELAYERS;
    }

    // Get random relayer
    function getRandomRelayer() external view returns (address) {
        require(relayers.length >= MIN_RELAYERS, "Not enough relayers");

        uint256 randomIndex = uint256(
            keccak256(
                abi.encodePacked(
                    block.timestamp,
                    block.difficulty,
                    msg.sender
                )
            )
        ) % relayers.length;

        return relayers[randomIndex];
    }
}