// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MockUSDT {
  string public constant name = "Mock Tether USD";
  string public constant symbol = "USDT";
  uint8 public constant decimals = 18;

  address public immutable owner;
  uint256 public totalSupply;

  mapping(address => uint256) public balanceOf;
  mapping(address => mapping(address => uint256)) public allowance;

  event Transfer(address indexed from, address indexed to, uint256 amount);
  event Approval(address indexed owner, address indexed spender, uint256 amount);

  modifier onlyOwner() {
    require(msg.sender == owner, "ONLY_OWNER");
    _;
  }

  constructor() {
    owner = msg.sender;
  }

  function faucet(uint256 amount) external {
    require(amount <= 10_000 ether, "FAUCET_MAX_10000");
    _mint(msg.sender, amount);
  }

  function mint(address to, uint256 amount) external onlyOwner {
    _mint(to, amount);
  }

  function approve(address spender, uint256 amount) external returns (bool) {
    allowance[msg.sender][spender] = amount;
    emit Approval(msg.sender, spender, amount);
    return true;
  }

  function transfer(address to, uint256 amount) external returns (bool) {
    _transfer(msg.sender, to, amount);
    return true;
  }

  function transferFrom(address from, address to, uint256 amount) external returns (bool) {
    uint256 allowed = allowance[from][msg.sender];
    require(allowed >= amount, "ALLOWANCE");
    if (allowed != type(uint256).max) {
      allowance[from][msg.sender] = allowed - amount;
      emit Approval(from, msg.sender, allowance[from][msg.sender]);
    }
    _transfer(from, to, amount);
    return true;
  }

  function _mint(address to, uint256 amount) internal {
    require(to != address(0), "TO_ZERO");
    totalSupply += amount;
    balanceOf[to] += amount;
    emit Transfer(address(0), to, amount);
  }

  function _transfer(address from, address to, uint256 amount) internal {
    require(to != address(0), "TO_ZERO");
    require(balanceOf[from] >= amount, "BALANCE");
    balanceOf[from] -= amount;
    balanceOf[to] += amount;
    emit Transfer(from, to, amount);
  }
}
