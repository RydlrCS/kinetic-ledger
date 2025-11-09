/**
 * USDC Transfer Utilities for Arc Testnet
 * Based on: https://developers.circle.com/tutorials/getting-started-with-arc-testnet-send-usdc-with-ethersjs
 * 
 * USDC on Arc is the native gas token (Chain ID: 421614)
 * Uses ethers.js v6 for transaction handling
 */

import { ethers, Contract, Wallet, JsonRpcProvider } from 'ethers';

// USDC Contract ABI (ERC-20 standard)
export const USDC_ABI = [
  // Read functions
  'function balanceOf(address account) external view returns (uint256)',
  'function decimals() external view returns (uint8)',
  'function symbol() external view returns (string)',
  'function name() external view returns (string)',
  'function totalSupply() external view returns (uint256)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  
  // Write functions
  'function transfer(address to, uint256 amount) external returns (bool)',
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function transferFrom(address from, address to, uint256 amount) external returns (bool)',
  
  // Events
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'event Approval(address indexed owner, address indexed spender, uint256 value)',
] as const;

// Arc Testnet Configuration
export const ARC_TESTNET_CONFIG = {
  chainId: 421614,
  name: 'Arc Testnet',
  rpcUrl: 'https://rpc.arc-testnet.circle.com',
  explorerUrl: 'https://explorer.arc-testnet.circle.com',
  // USDC is the native gas token on Arc
  nativeCurrency: {
    name: 'USDC',
    symbol: 'USDC',
    decimals: 6,
  },
} as const;

export const USDC_DECIMALS = 6;

/**
 * Parse USDC amount from human-readable format (e.g., "10.5" -> 10500000)
 */
export function parseUSDC(amount: string | number): bigint {
  return ethers.parseUnits(amount.toString(), USDC_DECIMALS);
}

/**
 * Format USDC amount to human-readable format (e.g., 10500000 -> "10.5")
 */
export function formatUSDC(amount: bigint | string): string {
  return ethers.formatUnits(amount, USDC_DECIMALS);
}

/**
 * Initialize USDC contract instance
 */
export function getUSDCContract(
  usdcAddress: string,
  signerOrProvider: Wallet | JsonRpcProvider
): Contract {
  return new ethers.Contract(usdcAddress, USDC_ABI, signerOrProvider);
}

/**
 * Get USDC balance for an address
 */
export async function getBalance(
  usdc: Contract,
  address: string
): Promise<{ raw: bigint; formatted: string }> {
  const balance = await usdc.balanceOf(address);
  return {
    raw: balance,
    formatted: formatUSDC(balance),
  };
}

/**
 * Send USDC to a recipient
 * @param usdc USDC contract instance (must be connected to a signer)
 * @param to Recipient address
 * @param amount Amount in USDC (can be string like "10.5" or bigint)
 * @returns Transaction receipt
 */
export async function sendUSDC(
  usdc: Contract,
  to: string,
  amount: string | bigint
): Promise<{
  txHash: string;
  receipt: ethers.TransactionReceipt;
  amountSent: string;
}> {
  // Validate recipient address
  if (!ethers.isAddress(to)) {
    throw new Error(`Invalid recipient address: ${to}`);
  }

  // Parse amount if it's a string
  const amountBigInt = typeof amount === 'string' ? parseUSDC(amount) : amount;

  // Check sender balance
  const runner = usdc.runner;
  if (!runner || !('getAddress' in runner)) {
    throw new Error('Contract must be connected to a signer with an address');
  }

  const signer = await (runner as any).getAddress();
  const { raw: balance } = await getBalance(usdc, signer);
  if (balance < amountBigInt) {
    throw new Error(
      `Insufficient balance. Have ${formatUSDC(balance)} USDC, need ${formatUSDC(amountBigInt)} USDC`
    );
  }

  // Estimate gas before sending
  const gasEstimate = await usdc.transfer.estimateGas(to, amountBigInt);
  console.log(`Gas estimate: ${gasEstimate.toString()}`);

  // Send transaction
  const tx = await usdc.transfer(to, amountBigInt);
  console.log(`Transaction submitted: ${tx.hash}`);
  console.log(`View on Arc Explorer: ${ARC_TESTNET_CONFIG.explorerUrl}/tx/${tx.hash}`);

  // Wait for confirmation
  const receipt = await tx.wait();
  console.log(`Transaction confirmed in block ${receipt.blockNumber}`);

  return {
    txHash: tx.hash,
    receipt,
    amountSent: formatUSDC(amountBigInt),
  };
}

/**
 * Approve USDC spending (for contract interactions)
 * @param usdc USDC contract instance
 * @param spender Address to approve
 * @param amount Amount to approve
 */
export async function approveUSDC(
  usdc: Contract,
  spender: string,
  amount: string | bigint
): Promise<{
  txHash: string;
  receipt: ethers.TransactionReceipt;
}> {
  if (!ethers.isAddress(spender)) {
    throw new Error(`Invalid spender address: ${spender}`);
  }

  const amountBigInt = typeof amount === 'string' ? parseUSDC(amount) : amount;

  const tx = await usdc.approve(spender, amountBigInt);
  console.log(`Approval submitted: ${tx.hash}`);

  const receipt = await tx.wait();
  console.log(`Approval confirmed in block ${receipt.blockNumber}`);

  return {
    txHash: tx.hash,
    receipt,
  };
}

/**
 * Check allowance for a spender
 */
export async function getAllowance(
  usdc: Contract,
  owner: string,
  spender: string
): Promise<{ raw: bigint; formatted: string }> {
  const allowance = await usdc.allowance(owner, spender);
  return {
    raw: allowance,
    formatted: formatUSDC(allowance),
  };
}

/**
 * Batch send USDC to multiple recipients
 * @param usdc USDC contract instance
 * @param recipients Array of {address, amount} objects
 * @returns Array of transaction results
 */
export async function batchSendUSDC(
  usdc: Contract,
  recipients: Array<{ address: string; amount: string | bigint }>
): Promise<
  Array<{
    address: string;
    txHash: string;
    amountSent: string;
    status: 'success' | 'failed';
    error?: string;
  }>
> {
  const results = [];

  for (const recipient of recipients) {
    try {
      const result = await sendUSDC(usdc, recipient.address, recipient.amount);
      results.push({
        address: recipient.address,
        txHash: result.txHash,
        amountSent: result.amountSent,
        status: 'success' as const,
      });
    } catch (error) {
      results.push({
        address: recipient.address,
        txHash: '',
        amountSent: '0',
        status: 'failed' as const,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return results;
}

/**
 * Example usage function demonstrating how to send USDC on Arc Testnet
 */
export async function example_sendUSDCOnArc() {
  // 1. Set up provider and wallet
  const provider = new ethers.JsonRpcProvider(ARC_TESTNET_CONFIG.rpcUrl);
  const privateKey = process.env.PRIVATE_KEY!; // Never hardcode private keys!
  const wallet = new ethers.Wallet(privateKey, provider);

  console.log('Wallet address:', wallet.address);

  // 2. Initialize USDC contract (replace with actual Arc testnet USDC address)
  const usdcAddress = process.env.USDC_ADDRESS || '0x...';
  const usdc = getUSDCContract(usdcAddress, wallet);

  // 3. Check balance
  const balance = await getBalance(usdc, wallet.address);
  console.log(`USDC Balance: ${balance.formatted} USDC`);

  // 4. Send USDC
  const recipient = '0x742d35Cc6634C0532925a3b844Bc9e7595f0B79C';
  const amount = '10.5'; // 10.5 USDC

  const result = await sendUSDC(usdc, recipient, amount);
  console.log(`Sent ${result.amountSent} USDC to ${recipient}`);
  console.log(`Transaction: ${result.txHash}`);
}
