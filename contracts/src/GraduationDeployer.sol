// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "./IERC20.sol";
import {LaunchToken} from "./LaunchToken.sol";
import {IPancakeRouter} from "./IPancakeRouter.sol";

contract GraduationDeployer {
    address public constant LP_BURN_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    address public owner;
    address public paymentAsset;
    address public router;
    address public wrappedNative;
    mapping(address => bool) public hotWallets;

    event TokenGraduated(
        address indexed token,
        address indexed dexPoolAddress,
        uint256 liquidityUsdt,
        uint256 tokenAmount
    );
    event HotWalletUpdated(address indexed wallet, bool status);
    event OwnerTransferred(address indexed oldOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "ONLY_OWNER");
        _;
    }

    modifier onlyHotWallet() {
        require(msg.sender == owner || hotWallets[msg.sender], "ONLY_HOT_WALLET");
        _;
    }

    constructor(address _paymentAsset, address _router, address _wrappedNative) {
        require(_paymentAsset != address(0), "INVALID_ASSET");
        require(_router != address(0), "INVALID_ROUTER");
        require(_wrappedNative != address(0), "INVALID_WBNB");
        owner = msg.sender;
        paymentAsset = _paymentAsset;
        router = _router;
        wrappedNative = _wrappedNative;
    }

    /**
     * @dev Deploys the actual BEP-20 token and seeds it on PancakeSwap.
     * The Hot Wallet must first transfer `liquidityUsdt` from the CentralTreasury to this contract.
     */
    function deployAndGraduate(
        string memory name,
        string memory symbol,
        uint256 totalSupply,
        uint256 liquidityUsdt
    ) external onlyHotWallet returns (address tokenAddress) {
        require(liquidityUsdt > 0, "INVALID_LIQUIDITY");
        require(IERC20(paymentAsset).balanceOf(address(this)) >= liquidityUsdt, "INSUFFICIENT_FUNDS_SENT");

        // 1. Deploy the Token
        LaunchToken token = new LaunchToken(name, symbol, totalSupply, address(this));
        tokenAddress = address(token);

        // 2. Approve Router
        require(IERC20(paymentAsset).approve(router, liquidityUsdt), "USDT_APPROVE_FAILED");

        // 3. Swap USDT to BNB for the liquidity pair (PancakeSwap pairs BNB, not USDT, by default)
        // If we want a direct USDT/Token pair, we skip this swap.
        // Assuming we pair with BNB (Native) for better PCS routing:
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

        // 4. Provide Liquidity to PancakeSwap and burn LP tokens
        require(token.approve(router, totalSupply), "TOKEN_APPROVE_FAILED");
        IPancakeRouter(router).addLiquidityETH{value: nativeAmount}(
            address(token),
            totalSupply,
            0,
            0,
            LP_BURN_ADDRESS, // Burn the LP
            block.timestamp + 20 minutes
        );

        emit TokenGraduated(tokenAddress, tokenAddress, liquidityUsdt, totalSupply);
    }

    receive() external payable {}

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
