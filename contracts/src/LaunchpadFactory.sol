// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BondingCurveSale} from "./BondingCurveSale.sol";
import {DepositVault} from "./DepositVault.sol";
import {IERC20} from "./IERC20.sol";
import {LaunchToken} from "./LaunchToken.sol";

contract LaunchpadFactory {
  struct LaunchConfig {
    string name;
    string symbol;
    uint256 supplyCap;
    uint256 graduationThreshold;
    uint256 pMin;
    uint256 pMax;
    int256 k;
    uint256 midpoint;
  }

  address public owner;
  address public feeRecipient;
  address public paymentAsset;
  address public router;
  address public wrappedNative;
  uint256 public platformFeeBps = 300;
  uint256 public creationFee = 10 ether;
  uint256 public creatorGraduationBonus = 100 ether;
  uint256 public platformGraduationFee;
  bool public paused;

  address[] public sales;
  mapping(address => address) public tokenToSale;
  mapping(address => mapping(address => address)) public vaultForUserAsset;

  event TokenCreated(
    address indexed creator,
    address indexed token,
    address indexed sale,
    string symbol
  );
  event DepositVaultCreated(address indexed user, address indexed asset, address indexed vault);
  event PaymentAssetUpdated(address indexed oldAsset, address indexed newAsset);
  event RouterUpdated(address indexed oldRouter, address indexed newRouter, address indexed wrappedNative);
  event CreationFeeUpdated(uint256 oldFee, uint256 newFee);
  event CreationFeePaid(address indexed creator, address indexed asset, uint256 amount);
  event GraduationIncentivesUpdated(uint256 creatorBonus, uint256 platformFee);
  event OwnerTransferred(address indexed oldOwner, address indexed newOwner);
  event Paused();
  event Unpaused();

  modifier onlyOwner() {
    require(msg.sender == owner, "ONLY_OWNER");
    _;
  }

  modifier notPaused() {
    require(!paused, "PAUSED");
    _;
  }

  constructor(
    address initialFeeRecipient,
    address initialPaymentAsset,
    address initialRouter,
    address initialWrappedNative
  ) {
    require(initialPaymentAsset != address(0), "PAYMENT_ASSET_REQUIRED");
    require(initialRouter != address(0), "ROUTER_REQUIRED");
    require(initialWrappedNative != address(0), "WBNB_REQUIRED");
    owner = msg.sender;
    feeRecipient = initialFeeRecipient == address(0) ? msg.sender : initialFeeRecipient;
    paymentAsset = initialPaymentAsset;
    router = initialRouter;
    wrappedNative = initialWrappedNative;
  }

  function createToken(LaunchConfig calldata config, uint256 initialBuyTokenAmount, uint256 maxUsdtPayment) external notPaused returns (address token, address sale) {
    require(bytes(config.name).length > 0, "NAME_REQUIRED");
    require(bytes(config.symbol).length > 0, "SYMBOL_REQUIRED");
    require(config.supplyCap > 0, "SUPPLY_REQUIRED");

    if (creationFee > 0) {
      require(IERC20(paymentAsset).transferFrom(msg.sender, feeRecipient, creationFee), "CREATION_FEE_FAILED");
      emit CreationFeePaid(msg.sender, paymentAsset, creationFee);
    }

    token = address(
      new LaunchToken(
        config.name,
        config.symbol,
        config.supplyCap,
        address(this)
      )
    );

    sale = address(
      new BondingCurveSale(
        token,
        paymentAsset,
        feeRecipient,
        router,
        wrappedNative,
        msg.sender,
        config.supplyCap,
        config.graduationThreshold,
        config.pMin,
        config.pMax,
        config.k,
        config.midpoint,
        platformFeeBps,
        creatorGraduationBonus,
        platformGraduationFee
      )
    );

    uint256 saleBalance = LaunchToken(token).balanceOf(address(this));
    require(LaunchToken(token).transfer(sale, saleBalance), "SALE_FUND_FAILED");

    sales.push(sale);
    tokenToSale[token] = sale;
    emit TokenCreated(msg.sender, token, sale, config.symbol);

    if (initialBuyTokenAmount > 0) {
      (uint256 cost, uint256 fee) = BondingCurveSale(payable(sale)).quoteBuy(initialBuyTokenAmount);
      require(cost + fee <= maxUsdtPayment, "SLIPPAGE");
      require(IERC20(paymentAsset).transferFrom(msg.sender, sale, cost + fee), "INITIAL_BUY_FAILED");
      BondingCurveSale(payable(sale)).buyFromVault(msg.sender, initialBuyTokenAmount);
    }
  }

  function getOrCreateDepositVault(address user, address asset) external notPaused returns (address vault) {
    require(user != address(0), "USER_REQUIRED");
    require(asset == paymentAsset, "UNSUPPORTED_ASSET");
    vault = vaultForUserAsset[user][asset];
    if (vault == address(0)) {
      bytes32 salt = keccak256(abi.encode(user, asset));
      vault = address(new DepositVault{ salt: salt }(user, asset));
      vaultForUserAsset[user][asset] = vault;
      emit DepositVaultCreated(user, asset, vault);
    }
  }

  function predictedDepositVault(address user, address asset) external view returns (address predicted) {
    require(asset == paymentAsset, "UNSUPPORTED_ASSET");
    bytes memory bytecode = abi.encodePacked(type(DepositVault).creationCode, abi.encode(user, asset));
    bytes32 hash = keccak256(
      abi.encodePacked(bytes1(0xff), address(this), keccak256(abi.encode(user, asset)), keccak256(bytecode))
    );
    predicted = address(uint160(uint256(hash)));
  }

  function buyFromVault(address user, address sale, address recipient, uint256 tokenAmount) external onlyOwner notPaused {
    require(sale != address(0), "SALE_REQUIRED");
    address vault = vaultForUserAsset[user][paymentAsset];
    require(vault != address(0), "VAULT_MISSING");
    (uint256 cost, uint256 fee) = BondingCurveSale(payable(sale)).quoteBuy(tokenAmount);
    DepositVault(payable(vault)).sweepToken(sale, cost + fee);
    BondingCurveSale(payable(sale)).buyFromVault(recipient, tokenAmount);
  }

  function buyFromNativeVault(
    address user,
    address sale,
    address recipient,
    uint256 tokenAmount,
    uint256 nativeAmount,
    uint256 minUsdtOut,
    uint256 deadline
  ) external onlyOwner notPaused {
    require(sale != address(0), "SALE_REQUIRED");
    address vault = vaultForUserAsset[user][paymentAsset];
    require(vault != address(0), "VAULT_MISSING");
    DepositVault(payable(vault)).sweepNative(payable(address(this)), nativeAmount);
    BondingCurveSale(payable(sale)).buyFromNativeVault{ value: nativeAmount }(
      recipient,
      tokenAmount,
      minUsdtOut,
      deadline
    );
  }

  function withdrawSaleFees(address sale) external onlyOwner returns (uint256 amount) {
    amount = BondingCurveSale(payable(sale)).withdrawFees();
  }

  function withdrawGraduationIncentives(
    address sale
  ) external onlyOwner returns (uint256 creatorAmount, uint256 platformAmount) {
    (creatorAmount, platformAmount) = BondingCurveSale(payable(sale)).withdrawGraduationIncentives();
  }

  function setPlatformFeeBps(uint256 feeBps) external onlyOwner {
    require(feeBps <= 1_000, "FEE_TOO_HIGH");
    platformFeeBps = feeBps;
  }

  function setGraduationIncentives(uint256 creatorBonus, uint256 platformFee) external onlyOwner {
    creatorGraduationBonus = creatorBonus;
    platformGraduationFee = platformFee;
    emit GraduationIncentivesUpdated(creatorBonus, platformFee);
  }

  function setCreationFee(uint256 fee) external onlyOwner {
    emit CreationFeeUpdated(creationFee, fee);
    creationFee = fee;
  }

  function setFeeRecipient(address recipient) external onlyOwner {
    require(recipient != address(0), "RECIPIENT_REQUIRED");
    feeRecipient = recipient;
  }

  function setPaymentAsset(address asset) external onlyOwner {
    require(asset != address(0), "PAYMENT_ASSET_REQUIRED");
    emit PaymentAssetUpdated(paymentAsset, asset);
    paymentAsset = asset;
  }

  function setRouter(address newRouter, address newWrappedNative) external onlyOwner {
    require(newRouter != address(0), "ROUTER_REQUIRED");
    require(newWrappedNative != address(0), "WBNB_REQUIRED");
    emit RouterUpdated(router, newRouter, newWrappedNative);
    router = newRouter;
    wrappedNative = newWrappedNative;
  }

  receive() external payable {}

  function setPaused(bool value) external onlyOwner {
    paused = value;
    if (value) emit Paused();
    else emit Unpaused();
  }

  function transferOwnership(address newOwner) external onlyOwner {
    require(newOwner != address(0), "OWNER_REQUIRED");
    emit OwnerTransferred(owner, newOwner);
    owner = newOwner;
  }

  function salesCount() external view returns (uint256) {
    return sales.length;
  }
}
