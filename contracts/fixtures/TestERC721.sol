// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract TestERC721 {
    string public name = "B-SAFE Synthetic NFT";
    string public symbol = "BSNFT";
    mapping(uint256 => address) private owners;
    mapping(address => uint256) public balanceOf;
    mapping(uint256 => address) public getApproved;
    mapping(address => mapping(address => bool)) public isApprovedForAll;
    mapping(uint256 => string) private tokenUris;

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);

    function ownerOf(uint256 tokenId) public view returns (address) {
        address owner = owners[tokenId];
        require(owner != address(0), "nonexistent");
        return owner;
    }

    function tokenURI(uint256 tokenId) external view returns (string memory) {
        require(owners[tokenId] != address(0), "nonexistent");
        return tokenUris[tokenId];
    }

    function mint(address to, uint256 tokenId, string calldata uri) external {
        require(owners[tokenId] == address(0), "already minted");
        owners[tokenId] = to;
        tokenUris[tokenId] = uri;
        balanceOf[to] += 1;
        emit Transfer(address(0), to, tokenId);
    }

    function approve(address approved, uint256 tokenId) external {
        address owner = ownerOf(tokenId);
        require(msg.sender == owner || isApprovedForAll[owner][msg.sender], "not authorized");
        getApproved[tokenId] = approved;
        emit Approval(owner, approved, tokenId);
    }

    function setApprovalForAll(address operator, bool approved) external {
        isApprovedForAll[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }

    function transferFrom(address from, address to, uint256 tokenId) external {
        require(ownerOf(tokenId) == from, "from");
        require(msg.sender == from || msg.sender == getApproved[tokenId] || isApprovedForAll[from][msg.sender], "not authorized");
        owners[tokenId] = to;
        getApproved[tokenId] = address(0);
        balanceOf[from] -= 1;
        balanceOf[to] += 1;
        emit Transfer(from, to, tokenId);
    }
}
