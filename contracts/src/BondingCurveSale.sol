// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {LaunchToken} from "./LaunchToken.sol";
import {IERC20} from "./IERC20.sol";
import {IPancakeRouter} from "./IPancakeRouter.sol";
import {SigmoidMath} from "./SigmoidMath.sol";

contract BondingCurveSale {
  using SigmoidMath for uint256;
  address public constant LP_BURN_ADDRESS = 0x000000000000000000000000000000000000dEaD;

  enum Status {
    Active,
    Graduated,
    Paused
  }

  address public immutable factory;
  address public immutable creator;
  address public immutable paymentAsset;
  address public immutable feeRecipient;
  address public immutable router;
  address public immutable wrappedNative;
  LaunchToken public immutable token;

  uint256 public immutable supplyCap;
  uint256 public immutable graduationThreshold;
  uint256 public immutable pMin;
  uint256 public immutable pMax;
  int256 public immutable k;
  uint256 public immutable midpoint;
  uint256 public immutable platformFeeBps;
  uint256 public immutable creatorGraduationBonus;
  uint256 public immutable platformGraduationFee;

  uint256 public soldSupply;
  uint256 public totalRaised;
  uint256 public totalFees;
  bool public graduationIncentivesWithdrawn;
  Status public status;
  address public dexPoolAddress;

  event Bought(
    address indexed buyer,
    address indexed paymentAsset,
    uint256 tokenAmount,
    uint256 paymentAmount,
    uint256 fee
  );
  event Graduated(address indexed token, address indexed dexPoolAddress, uint256 totalRaised);
  event LiquidityBurned(address indexed token, uint256 tokenAmount, uint256 nativeAmount, uint256 liquidity);
  event Paused();
  event Unpaused();
  event FeesWithdrawn(address indexed recipient, uint256 amount);
  event GraduationIncentivesWithdrawn(
    address indexed creator,
    uint256 creatorAmount,
    address indexed platform,
    uint256 platformAmount
  );

  modifier onlyFactory() {
    require(msg.sender == factory, "ONLY_FACTORY");
    _;
  }

  modifier active() {
    require(status == Status.Active, "NOT_ACTIVE");
    _;
  }

  constructor(
    address tokenAddress,
    address acceptedPaymentAsset,
    address platformFeeRecipient,
    address pancakeRouter,
    address wbnb,
    address saleCreator,
    uint256 cap,
    uint256 threshold,
    uint256 minPrice,
    uint256 maxPrice,
    int256 steepness,
    uint256 curveMidpoint,
    uint256 feeBps,
    uint256 creatorBonus,
    uint256 platformGraduation
  ) {
    require(tokenAddress != address(0), "TOKEN_REQUIRED");
    require(acceptedPaymentAsset != address(0), "PAYMENT_ASSET_REQUIRED");
    require(platformFeeRecipient != address(0), "FEE_RECIPIENT_REQUIRED");
    require(pancakeRouter != address(0), "ROUTER_REQUIRED");
    require(wbnb != address(0), "WBNB_REQUIRED");
    require(threshold <= cap, "BAD_THRESHOLD");
    require(feeBps <= 1_000, "FEE_TOO_HIGH");

    factory = msg.sender;
    token = LaunchToken(tokenAddress);
    paymentAsset = acceptedPaymentAsset;
    feeRecipient = platformFeeRecipient;
    router = pancakeRouter;
    wrappedNative = wbnb;
    creator = saleCreator;
    supplyCap = cap;
    graduationThreshold = threshold;
    pMin = minPrice;
    pMax = maxPrice;
    k = steepness;
    midpoint = curveMidpoint;
    platformFeeBps = feeBps;
    creatorGraduationBonus = creatorBonus;
    platformGraduationFee = platformGraduation;
    status = Status.Active;
  }

  receive() external payable {}

  function quoteBuy(uint256 tokenAmount) public view returns (uint256 totalCost, uint256 fee) {
    totalCost = SigmoidMath.buyCost(pMin, pMax, k, midpoint, soldSupply, tokenAmount);
    fee = (totalCost * platformFeeBps) / 10_000;
  }

  function buy(uint256 tokenAmount, address recipient, uint256 maxPayment) external active {
    require(recipient != address(0), "RECIPIENT_REQUIRED");
    require(tokenAmount > 0, "AMOUNT_REQUIRED");
    require(soldSupply + tokenAmount <= supplyCap, "SUPPLY_CAP");
    (uint256 cost, uint256 fee) = quoteBuy(tokenAmount);
    uint256 payment = cost + fee;
    require(payment <= maxPayment, "SLIPPAGE");
    require(IERC20(paymentAsset).transferFrom(msg.sender, address(this), payment), "PAYMENT_FAILED");

    _completeBuy(recipient, tokenAmount, cost, fee);
  }

  function buyWithBNB(
    uint256 tokenAmount,
    address recipient,
    uint256 minUsdtOut,
    uint256 deadline
  ) external payable active {
    uint256 received = _swapBNBToPaymentAsset(msg.value, minUsdtOut, deadline);
    _buyWithReceivedPayment(tokenAmount, recipient, received);
  }

  function buyFromVault(address recipient, uint256 tokenAmount) external onlyFactory active {
    require(recipient != address(0), "RECIPIENT_REQUIRED");
    require(tokenAmount > 0, "AMOUNT_REQUIRED");
    require(soldSupply + tokenAmount <= supplyCap, "SUPPLY_CAP");
    (uint256 cost, uint256 fee) = quoteBuy(tokenAmount);
    require(
      IERC20(paymentAsset).balanceOf(address(this)) >= totalRaised + totalFees + cost + fee,
      "VAULT_PAYMENT_MISSING"
    );
    _completeBuy(recipient, tokenAmount, cost, fee);
  }

  function buyFromNativeVault(
    address recipient,
    uint256 tokenAmount,
    uint256 minUsdtOut,
    uint256 deadline
  ) external payable onlyFactory active {
    uint256 received = _swapBNBToPaymentAsset(msg.value, minUsdtOut, deadline);
    _buyWithReceivedPayment(tokenAmount, recipient, received);
  }

  function _buyWithReceivedPayment(uint256 tokenAmount, address recipient, uint256 received) internal {
    require(recipient != address(0), "RECIPIENT_REQUIRED");
    require(tokenAmount > 0, "AMOUNT_REQUIRED");
    require(soldSupply + tokenAmount <= supplyCap, "SUPPLY_CAP");
    (uint256 cost, uint256 fee) = quoteBuy(tokenAmount);
    uint256 payment = cost + fee;
    require(received >= payment, "INSUFFICIENT_SWAP_OUTPUT");

    uint256 refund = received - payment;
    if (refund > 0) {
      require(IERC20(paymentAsset).transfer(recipient, refund), "USDT_REFUND_FAILED");
    }

    _completeBuy(recipient, tokenAmount, cost, fee);
  }

  function _swapBNBToPaymentAsset(
    uint256 nativeAmount,
    uint256 minUsdtOut,
    uint256 deadline
  ) internal returns (uint256 received) {
    require(nativeAmount > 0, "BNB_REQUIRED");
    uint256 beforeBalance = IERC20(paymentAsset).balanceOf(address(this));
    address[] memory path = new address[](2);
    path[0] = wrappedNative;
    path[1] = paymentAsset;
    IPancakeRouter(router).swapExactETHForTokens{ value: nativeAmount }(
      minUsdtOut,
      path,
      address(this),
      deadline
    );
    received = IERC20(paymentAsset).balanceOf(address(this)) - beforeBalance;
    require(received >= minUsdtOut, "SLIPPAGE");
  }

  function _completeBuy(address recipient, uint256 tokenAmount, uint256 cost, uint256 fee) internal {
    soldSupply += tokenAmount;
    totalRaised += cost;
    totalFees += fee;
    require(token.transfer(recipient, tokenAmount), "TOKEN_TRANSFER_FAILED");
    emit Bought(recipient, paymentAsset, tokenAmount, cost, fee);

    if (soldSupply >= graduationThreshold) {
      _graduate();
    }
  }

  function _graduate() internal {
    require(status == Status.Active, "NOT_ACTIVE");
    status = Status.Graduated;

    _payGraduationIncentives();

    uint256 liquidityUsdt = IERC20(paymentAsset).balanceOf(address(this)) - totalFees;
    require(liquidityUsdt > 0, "NO_LIQUIDITY_USDT");
    require(token.balanceOf(address(this)) > 0, "NO_LIQUIDITY_TOKEN");

    require(IERC20(paymentAsset).approve(router, liquidityUsdt), "USDT_APPROVE_FAILED");
    address[] memory path = new address[](2);
    path[0] = paymentAsset;
    path[1] = wrappedNative;
    uint256 nativeBefore = address(this).balance;
    IPancakeRouter(router).swapExactTokensForETH(
      liquidityUsdt,
      0,
      path,
      address(this),
      block.timestamp + 20 minutes
    );
    uint256 nativeAmount = address(this).balance - nativeBefore;
    require(nativeAmount > 0, "NO_NATIVE_RECEIVED");

    uint256 tokenAmount = token.balanceOf(address(this));
    require(token.approve(router, tokenAmount), "TOKEN_APPROVE_FAILED");
    (uint256 usedTokens, uint256 usedNative, uint256 liquidity) = IPancakeRouter(router).addLiquidityETH{
      value: nativeAmount
    }(
      address(token),
      tokenAmount,
      0,
      0,
      LP_BURN_ADDRESS,
      block.timestamp + 20 minutes
    );

    dexPoolAddress = address(token);
    emit LiquidityBurned(address(token), usedTokens, usedNative, liquidity);
    emit Graduated(address(token), dexPoolAddress, totalRaised);
  }

  function withdrawFees() external onlyFactory returns (uint256 amount) {
    amount = totalFees;
    require(amount > 0, "NO_FEES");
    totalFees = 0;
    require(IERC20(paymentAsset).transfer(feeRecipient, amount), "FEE_WITHDRAW_FAILED");
    emit FeesWithdrawn(feeRecipient, amount);
  }

  function withdrawGraduationIncentives()
    external
    onlyFactory
    returns (uint256 creatorAmount, uint256 platformAmount)
  {
    require(status == Status.Graduated, "NOT_GRADUATED");
    require(!graduationIncentivesWithdrawn, "INCENTIVES_WITHDRAWN");

    (creatorAmount, platformAmount) = _payGraduationIncentives();
  }

  function _payGraduationIncentives() internal returns (uint256 creatorAmount, uint256 platformAmount) {
    require(!graduationIncentivesWithdrawn, "INCENTIVES_WITHDRAWN");
    graduationIncentivesWithdrawn = true;
    creatorAmount = creatorGraduationBonus;
    platformAmount = platformGraduationFee;
    require(creatorAmount + platformAmount <= totalRaised, "INCENTIVES_EXCEED_RAISED");

    if (creatorAmount > 0) {
      require(IERC20(paymentAsset).transfer(creator, creatorAmount), "CREATOR_BONUS_FAILED");
    }
    if (platformAmount > 0) {
      require(IERC20(paymentAsset).transfer(feeRecipient, platformAmount), "PLATFORM_GRADUATION_FEE_FAILED");
    }

    emit GraduationIncentivesWithdrawn(creator, creatorAmount, feeRecipient, platformAmount);
  }

  function netRaisedForLiquidity() external view returns (uint256) {
    if (creatorGraduationBonus + platformGraduationFee >= totalRaised) return 0;
    return totalRaised - creatorGraduationBonus - platformGraduationFee;
  }

  function pause() external onlyFactory {
    require(status == Status.Active, "NOT_ACTIVE");
    status = Status.Paused;
    emit Paused();
  }

  function unpause() external onlyFactory {
    require(status == Status.Paused, "NOT_PAUSED");
    status = Status.Active;
    emit Unpaused();
  }

  function setDexPoolAddress(address pool) external onlyFactory {
    dexPoolAddress = pool;
  }
}
