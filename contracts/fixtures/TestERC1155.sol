// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract TestERC1155 {
    mapping(uint256 => mapping(address => uint256)) public balanceOf;
    string public uri;

    event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value);
    event TransferBatch(address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values);

    constructor(string memory initialUri) { uri = initialUri; }

    function mint(address to, uint256 id, uint256 amount) external {
        balanceOf[id][to] += amount;
        emit TransferSingle(msg.sender, address(0), to, id, amount);
    }

    function mintBatch(address to, uint256[] calldata ids, uint256[] calldata amounts) external {
        require(ids.length == amounts.length, "length");
        for (uint256 i = 0; i < ids.length; i++) balanceOf[ids[i]][to] += amounts[i];
        emit TransferBatch(msg.sender, address(0), to, ids, amounts);
    }

    function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes calldata) external {
        require(msg.sender == from, "not authorized");
        require(balanceOf[id][from] >= amount, "balance");
        balanceOf[id][from] -= amount;
        balanceOf[id][to] += amount;
        emit TransferSingle(msg.sender, from, to, id, amount);
    }
}
