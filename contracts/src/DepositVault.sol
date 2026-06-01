// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "./IERC20.sol";

contract DepositVault {
  address public immutable factory;
  address public immutable user;
  address public immutable asset;

  event Deposited(address indexed user, address indexed asset, uint256 amount, bytes32 indexed ref);
  event Swept(address indexed user, address indexed asset, uint256 amount);
  event NativeDeposited(address indexed user, uint256 amount);
  event NativeSwept(address indexed user, uint256 amount);

  constructor(address owner, address paymentAsset) {
    require(paymentAsset != address(0), "ASSET_REQUIRED");
    factory = msg.sender;
    user = owner;
    asset = paymentAsset;
  }

  receive() external payable {
    emit NativeDeposited(user, msg.value);
  }

  function sweepToken(address to, uint256 amount) external returns (uint256 swept) {
    require(msg.sender == factory, "ONLY_FACTORY");
    require(to != address(0), "TO_REQUIRED");
    uint256 balance = IERC20(asset).balanceOf(address(this));
    swept = amount == type(uint256).max ? balance : amount;
    require(swept <= balance, "INSUFFICIENT_VAULT_BALANCE");
    if (swept > 0) require(IERC20(asset).transfer(to, swept), "SWEEP_FAILED");
    emit Swept(user, asset, swept);
  }

  function notifyTokenDeposit(uint256 amount, bytes32 ref) external {
    require(msg.sender == user || msg.sender == factory, "NOT_AUTHORIZED");
    emit Deposited(user, asset, amount, ref);
  }

  function sweepNative(address payable to, uint256 amount) external returns (uint256 swept) {
    require(msg.sender == factory, "ONLY_FACTORY");
    require(to != address(0), "TO_REQUIRED");
    uint256 balance = address(this).balance;
    swept = amount == type(uint256).max ? balance : amount;
    require(swept <= balance, "INSUFFICIENT_NATIVE_BALANCE");
    if (swept > 0) {
      (bool ok, ) = to.call{ value: swept }("");
      require(ok, "NATIVE_SWEEP_FAILED");
    }
    emit NativeSwept(user, swept);
  }
}
