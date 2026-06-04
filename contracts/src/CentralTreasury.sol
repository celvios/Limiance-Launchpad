// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "./IERC20.sol";
import {DepositVault} from "./DepositVault.sol";

contract CentralTreasury {
    address public owner;
    address public paymentAsset;
    mapping(address => bool) public hotWallets;
    
    mapping(address => address) public userVaults;

    event DepositVaultCreated(address indexed user, address indexed vault);
    event HotWalletUpdated(address indexed wallet, bool status);
    event OwnerTransferred(address indexed oldOwner, address indexed newOwner);
    event WithdrawalProcessed(address indexed to, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "ONLY_OWNER");
        _;
    }

    modifier onlyHotWallet() {
        require(msg.sender == owner || hotWallets[msg.sender], "ONLY_HOT_WALLET");
        _;
    }

    constructor(address _paymentAsset) {
        require(_paymentAsset != address(0), "INVALID_ASSET");
        owner = msg.sender;
        paymentAsset = _paymentAsset;
    }

    /**
     * @dev Predicts the deterministic CREATE2 address for a user's deposit vault
     */
    function predictedDepositVault(address user, address asset) public view returns (address predicted) {
        bytes memory bytecode = abi.encodePacked(type(DepositVault).creationCode, abi.encode(user, asset));
        bytes32 hash = keccak256(
            abi.encodePacked(bytes1(0xff), address(this), keccak256(abi.encode(user, asset)), keccak256(bytecode))
        );
        predicted = address(uint160(uint256(hash)));
    }

    /**
     * @dev Deploys a deterministic deposit vault for a user so they have a dedicated deposit address
     */
    function getOrCreateDepositVault(address user, address asset) external returns (address vault) {
        require(user != address(0), "USER_REQUIRED");
        require(asset == paymentAsset, "UNSUPPORTED_ASSET");
        vault = userVaults[user];
        if (vault == address(0)) {
            bytes32 salt = keccak256(abi.encode(user, asset));
            vault = address(new DepositVault{salt: salt}(user, asset));
            userVaults[user] = vault;
            emit DepositVaultCreated(user, vault);
        }
    }

    /**
     * @dev Sweeps funds from a user's vault into the main central treasury
     */
    function sweepVault(address user, uint256 amount) external onlyHotWallet returns (uint256 swept) {
        address vault = userVaults[user];
        require(vault != address(0), "VAULT_DOES_NOT_EXIST");
        swept = DepositVault(payable(vault)).sweepToken(address(this), amount);
    }

    /**
     * @dev Allows the hot wallet to process a user withdrawal request
     */
    function processWithdrawal(address to, uint256 amount) external onlyHotWallet {
        require(to != address(0), "INVALID_DESTINATION");
        require(amount > 0, "INVALID_AMOUNT");
        require(IERC20(paymentAsset).transfer(to, amount), "TRANSFER_FAILED");
        emit WithdrawalProcessed(to, amount);
    }

    /**
     * @dev Allows owner to withdraw stuck funds or extract funds for token graduation
     */
    function extractFunds(address to, uint256 amount) external onlyOwner {
        require(IERC20(paymentAsset).transfer(to, amount), "TRANSFER_FAILED");
    }

    // Admin Functions
    
    function setHotWallet(address wallet, bool status) external onlyOwner {
        require(wallet != address(0), "INVALID_WALLET");
        hotWallets[wallet] = status;
        emit HotWalletUpdated(wallet, status);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "OWNER_REQUIRED");
        emit OwnerTransferred(owner, newOwner);
        owner = newOwner;
    }
}
