/**
 * Example: Send USDC on Arc Testnet with ethers.js
 * 
 * Based on Circle's tutorial:
 * https://developers.circle.com/tutorials/getting-started-with-arc-testnet-send-usdc-with-ethersjs
 * 
 * Prerequisites:
 * 1. Get testnet USDC from https://faucet.circle.com/
 * 2. Set PRIVATE_KEY and USDC_ADDRESS environment variables
 * 3. Install dependencies: pnpm add ethers dotenv
 * 
 * Run: pnpm tsx examples/send-usdc-arc.ts
 */

import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

// Arc Testnet Configuration
const ARC_TESTNET_RPC = 'https://rpc.arc-testnet.circle.com';
const ARC_CHAIN_ID = 421614;
const ARC_EXPLORER = 'https://explorer.arc-testnet.circle.com';

// USDC Contract ABI (ERC-20)
const USDC_ABI = [
  'function balanceOf(address account) external view returns (uint256)',
  'function transfer(address to, uint256 amount) external returns (bool)',
  'function decimals() external view returns (uint8)',
  'function symbol() external view returns (string)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
];

async function main() {
  console.log('🚀 Sending USDC on Arc Testnet\n');

  // 1. Initialize provider and wallet
  const provider = new ethers.JsonRpcProvider(ARC_TESTNET_RPC);
  const privateKey = process.env.PRIVATE_KEY;
  
  if (!privateKey) {
    throw new Error('PRIVATE_KEY environment variable not set');
  }

  const wallet = new ethers.Wallet(privateKey, provider);
  console.log('Wallet Address:', wallet.address);

  // 2. Verify network
  const network = await provider.getNetwork();
  console.log('Network:', network.name);
  console.log('Chain ID:', network.chainId.toString());
  
  if (network.chainId !== BigInt(ARC_CHAIN_ID)) {
    throw new Error(`Wrong network! Expected Arc Testnet (${ARC_CHAIN_ID}), got ${network.chainId}`);
  }

  // 3. Initialize USDC contract
  const usdcAddress = process.env.USDC_ADDRESS;
  if (!usdcAddress) {
    throw new Error('USDC_ADDRESS environment variable not set');
  }

  const usdc = new ethers.Contract(usdcAddress, USDC_ABI, wallet);
  console.log('USDC Contract:', usdcAddress);

  // 4. Check USDC balance
  const balance = await usdc.balanceOf(wallet.address);
  const balanceFormatted = ethers.formatUnits(balance, 6); // USDC has 6 decimals
  console.log(`\n💰 USDC Balance: ${balanceFormatted} USDC`);

  if (balance === 0n) {
    console.log('\n⚠️  No USDC balance. Get testnet USDC from: https://faucet.circle.com/');
    return;
  }

  // 5. Define transfer parameters
  const recipient = process.env.RECIPIENT_ADDRESS || '0x742d35Cc6634C0532925a3b844Bc9e7595f0B79C';
  const amount = '10.50'; // 10.5 USDC
  const amountWei = ethers.parseUnits(amount, 6);

  console.log(`\n📤 Transfer Details:`);
  console.log(`   From: ${wallet.address}`);
  console.log(`   To: ${recipient}`);
  console.log(`   Amount: ${amount} USDC`);

  // Check if sufficient balance
  if (balance < amountWei) {
    throw new Error(`Insufficient balance. Need ${amount} USDC, have ${balanceFormatted} USDC`);
  }

  // 6. Estimate gas
  console.log('\n⛽ Estimating gas...');
  const gasEstimate = await usdc.transfer.estimateGas(recipient, amountWei);
  console.log(`   Gas Estimate: ${gasEstimate.toString()}`);

  // Get gas price
  const feeData = await provider.getFeeData();
  const gasPrice = feeData.gasPrice || 0n;
  const estimatedFee = gasEstimate * gasPrice;
  console.log(`   Estimated Fee: ${ethers.formatUnits(estimatedFee, 6)} USDC`);

  // 7. Send transaction
  console.log('\n📡 Sending transaction...');
  const tx = await usdc.transfer(recipient, amountWei);
  console.log(`   Transaction Hash: ${tx.hash}`);
  console.log(`   View on Explorer: ${ARC_EXPLORER}/tx/${tx.hash}`);

  // 8. Wait for confirmation
  console.log('\n⏳ Waiting for confirmation...');
  const receipt = await tx.wait();
  
  if (receipt.status === 1) {
    console.log(`\n✅ Transaction Confirmed!`);
    console.log(`   Block Number: ${receipt.blockNumber}`);
    console.log(`   Gas Used: ${receipt.gasUsed.toString()}`);
    console.log(`   Actual Fee: ${ethers.formatUnits(receipt.gasUsed * (receipt.gasPrice || 0n), 6)} USDC`);
  } else {
    console.log('\n❌ Transaction Failed');
  }

  // 9. Check updated balance
  const newBalance = await usdc.balanceOf(wallet.address);
  const newBalanceFormatted = ethers.formatUnits(newBalance, 6);
  console.log(`\n💰 New USDC Balance: ${newBalanceFormatted} USDC`);
  console.log(`   Change: -${ethers.formatUnits(balance - newBalance, 6)} USDC`);

  // 10. Parse Transfer event from receipt
  console.log('\n📋 Transfer Event:');
  for (const log of receipt.logs) {
    try {
      const parsedLog = usdc.interface.parseLog({
        topics: log.topics as string[],
        data: log.data,
      });
      
      if (parsedLog && parsedLog.name === 'Transfer') {
        console.log(`   From: ${parsedLog.args[0]}`);
        console.log(`   To: ${parsedLog.args[1]}`);
        console.log(`   Amount: ${ethers.formatUnits(parsedLog.args[2], 6)} USDC`);
      }
    } catch (e) {
      // Skip logs that don't match USDC ABI
    }
  }

  console.log('\n✨ Done!');
}

// Run the example
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  });
