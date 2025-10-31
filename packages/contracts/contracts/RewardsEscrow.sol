// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title RewardsEscrow
 * @notice USDC escrow for motion-based rewards disbursement
 * @dev Only treasurer can disburse funds
 */

error InsufficientFunding();
error TransferFailed();
error NotTreasurer();
error InvalidAddress();

contract RewardsEscrow is ReentrancyGuard {
    IERC20 public immutable USDC;
    address public treasurer;

    event Disbursed(address indexed to, uint256 amount, bytes32 indexed attestationId);
    event TreasurerUpdated(address indexed oldTreasurer, address indexed newTreasurer);

    modifier onlyTreasurer() {
        if (msg.sender != treasurer) revert NotTreasurer();
        _;
    }

    constructor(address usdc, address _treasurer) {
        if (usdc == address(0) || _treasurer == address(0)) revert InvalidAddress();
        USDC = IERC20(usdc);
        treasurer = _treasurer;
    }

    /**
     * @notice Update treasurer address
     * @param newTreasurer New treasurer address
     */
    function setTreasurer(address newTreasurer) external onlyTreasurer {
        if (newTreasurer == address(0)) revert InvalidAddress();
        address oldTreasurer = treasurer;
        treasurer = newTreasurer;
        emit TreasurerUpdated(oldTreasurer, newTreasurer);
    }

    /**
     * @notice Disburse USDC rewards
     * @param to Recipient address
     * @param amount USDC amount (in smallest unit)
     * @param attestationId Reference to off-chain attestation
     */
    function disburse(
        address to,
        uint256 amount,
        bytes32 attestationId
    ) external nonReentrant onlyTreasurer {
        if (USDC.balanceOf(address(this)) < amount) revert InsufficientFunding();
        
        bool success = USDC.transfer(to, amount);
        if (!success) revert TransferFailed();
        
        emit Disbursed(to, amount, attestationId);
    }

    /**
     * @notice Get current USDC balance
     */
    function balance() external view returns (uint256) {
        return USDC.balanceOf(address(this));
    }
}
