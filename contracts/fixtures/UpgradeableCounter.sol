// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract UpgradeableCounterV1 {
    uint256 public value;
    address public admin;

    function initialize(address initialAdmin) external {
        require(admin == address(0), "initialized");
        admin = initialAdmin;
    }

    function increment() external { value += 1; }
    function version() external pure virtual returns (uint256) { return 1; }
}

contract UpgradeableCounterV2 is UpgradeableCounterV1 {
    function decrement() external { value -= 1; }
    function version() external pure override returns (uint256) { return 2; }
}

contract SimpleProxy {
    event Upgraded(address indexed implementation);
    event ImplementationAllowed(address indexed implementation, bool allowed);
    mapping(address => bool) public allowedImplementations;
    bytes32 private constant IMPLEMENTATION_SLOT = bytes32(uint256(keccak256("eip1967.proxy.implementation")) - 1);
    bytes32 private constant ADMIN_SLOT = bytes32(uint256(keccak256("eip1967.proxy.admin")) - 1);

    constructor(address implementation, address initialAdmin, bytes memory initData) {
        _setAdmin(initialAdmin);
        allowedImplementations[implementation] = true;
        _setImplementation(implementation);
        if (initData.length > 0) {
            (bool ok,) = implementation.delegatecall(initData);
            require(ok, "init failed");
        }
    }

    function admin() public view returns (address adminAddress) {
        bytes32 slot = ADMIN_SLOT;
        assembly { adminAddress := sload(slot) }
    }

    function implementation() public view returns (address implementationAddress) {
        bytes32 slot = IMPLEMENTATION_SLOT;
        assembly { implementationAddress := sload(slot) }
    }

    function setImplementationAllowed(address implementationAddress, bool allowed) external {
        require(msg.sender == admin(), "not admin");
        allowedImplementations[implementationAddress] = allowed;
        emit ImplementationAllowed(implementationAddress, allowed);
    }

    function upgradeTo(address newImplementation) external {
        require(msg.sender == admin(), "not admin");
        require(allowedImplementations[newImplementation], "implementation not allowed");
        _setImplementation(newImplementation);
        emit Upgraded(newImplementation);
    }

    function _setAdmin(address newAdmin) internal {
        bytes32 slot = ADMIN_SLOT;
        assembly { sstore(slot, newAdmin) }
    }

    function _setImplementation(address newImplementation) internal {
        bytes32 slot = IMPLEMENTATION_SLOT;
        assembly { sstore(slot, newImplementation) }
    }

    fallback() external payable {
        address target = implementation();
        assembly {
            calldatacopy(0, 0, calldatasize())
            let result := delegatecall(gas(), target, 0, calldatasize(), 0, 0)
            returndatacopy(0, 0, returndatasize())
            switch result
            case 0 { revert(0, returndatasize()) }
            default { return(0, returndatasize()) }
        }
    }
}
