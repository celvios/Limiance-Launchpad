// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract LaunchToken {
  string public name;
  string public symbol;
  uint8 public constant decimals = 18;
  uint256 public immutable totalSupply;
  address public immutable sale;

  mapping(address => uint256) public balanceOf;
  mapping(address => mapping(address => uint256)) public allowance;

  event Transfer(address indexed from, address indexed to, uint256 amount);
  event Approval(address indexed owner, address indexed spender, uint256 amount);

  constructor(
    string memory tokenName,
    string memory tokenSymbol,
    uint256 supply,
    address creator,
    uint256 creatorAllocation,
    address saleAddress
  ) {
    require(saleAddress != address(0), "SALE_REQUIRED");
    require(creatorAllocation <= supply, "ALLOCATION_TOO_HIGH");

    name = tokenName;
    symbol = tokenSymbol;
    totalSupply = supply;
    sale = saleAddress;

    uint256 saleAllocation = supply - creatorAllocation;
    if (creatorAllocation > 0) {
      balanceOf[creator] = creatorAllocation;
      emit Transfer(address(0), creator, creatorAllocation);
    }
    balanceOf[saleAddress] = saleAllocation;
    emit Transfer(address(0), saleAddress, saleAllocation);
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

  function _transfer(address from, address to, uint256 amount) internal {
    require(to != address(0), "TO_ZERO");
    require(balanceOf[from] >= amount, "BALANCE");
    balanceOf[from] -= amount;
    balanceOf[to] += amount;
    emit Transfer(from, to, amount);
  }
}
