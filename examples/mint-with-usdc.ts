/**
 * Complete Example: Motion Minting with USDC Payment on Arc
 * 
 * This example demonstrates the full flow:
 * 1. Check USDC balance
 * 2. Generate motion embedding
 * 3. Pay minting fee in USDC (via gas)
 * 4. Mint motion NFT
 * 5. Verify transaction
 */

import { ethers } from 'ethers';
import {
  getUSDCContract,
  getBalance,
  formatUSDC,
  parseUSDC,
  ARC_TESTNET_CONFIG,
} from '../packages/sdk/src/usdc';

// Contract ABIs
const ORCHESTRATOR_ABI = [
  'function verifyAndMint(address to, uint256[] embedding, uint256 nonce, uint256 expiry, bytes signature, tuple(string jurisdiction, string vaspLicense, string userConsent) complianceMetadata) external returns (uint256)',
  'event MotionNFTMinted(uint256 indexed tokenId, address indexed minter, bytes32 indexed embeddingHash, uint256 noveltyScore)',
];

const NOVELTY_DETECTOR_ABI = [
  'function verifyNovelty(address to, bytes32 embeddingHash, uint256 nonce, uint256 expiry, bytes signature) external returns (bool)',
];

// Configuration
const MINTING_FEE_USDC = '7.00'; // 7 USDC per token
const MIN_BALANCE_USDC = '10.00'; // Minimum recommended balance (minting fee + gas buffer)

async function main() {
  console.log('🎬 Kinetic Ledger - Motion Minting with USDC\n');

  // 1. Initialize wallet and provider
  const provider = new ethers.JsonRpcProvider(ARC_TESTNET_CONFIG.rpcUrl);
  const privateKey = process.env.PRIVATE_KEY;
  
  if (!privateKey) {
    throw new Error('PRIVATE_KEY not set');
  }

  const wallet = new ethers.Wallet(privateKey, provider);
  console.log('👤 Wallet:', wallet.address);

  // 2. Initialize contracts
  const usdcAddress = process.env.USDC_ADDRESS!;
  const orchestratorAddress = process.env.ORCHESTRATOR_ADDRESS!;
  const noveltyDetectorAddress = process.env.NOVELTY_DETECTOR_ADDRESS!;

  const usdc = getUSDCContract(usdcAddress, wallet);
  const orchestrator = new ethers.Contract(orchestratorAddress, ORCHESTRATOR_ABI, wallet);

  console.log('\n📋 Contract Addresses:');
  console.log(`   USDC: ${usdcAddress}`);
  console.log(`   Orchestrator: ${orchestratorAddress}`);
  console.log(`   Novelty Detector: ${noveltyDetectorAddress}`);

  // 3. Check USDC balance
  const balance = await getBalance(usdc, wallet.address);
  console.log(`\n💰 USDC Balance: ${balance.formatted} USDC`);

  const minBalanceWei = parseUSDC(MIN_BALANCE_USDC);
  if (balance.raw < minBalanceWei) {
    console.log(`\n⚠️  Warning: Balance below recommended minimum of ${MIN_BALANCE_USDC} USDC`);
    console.log(`   Get testnet USDC from: https://faucet.circle.com/`);
    console.log(`   You need at least ${MINTING_FEE_USDC} USDC for minting fee + gas`);
    return;
  }

  // 4. Generate mock motion embedding (128 dimensions)
  console.log('\n🏃 Generating motion embedding...');
  const embedding = Array.from({ length: 128 }, () => 
    Math.floor(Math.random() * 1000000) // Random values 0-1M (will be normalized on-chain)
  );
  const embeddingHash = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(['uint256[]'], [embedding])
  );
  console.log(`   Embedding Hash: ${embeddingHash.slice(0, 10)}...${embeddingHash.slice(-8)}`);

  // 5. Create EIP-712 signature (simplified - would be from agent in production)
  const nonce = BigInt(Date.now());
  const expiry = BigInt(Date.now() + 300000); // 5 minutes from now

  // In production, this signature would come from the trusted validator
  // For this example, we'll use a mock signature
  const domain = {
    name: 'MotionNoveltyDetector',
    version: '1',
    chainId: ARC_TESTNET_CONFIG.chainId,
    verifyingContract: noveltyDetectorAddress,
  };

  const types = {
    VerifyNovelty: [
      { name: 'to', type: 'address' },
      { name: 'embeddingHash', type: 'bytes32' },
      { name: 'nonce', type: 'uint256' },
      { name: 'expiry', type: 'uint256' },
    ],
  };

  const value = {
    to: wallet.address,
    embeddingHash,
    nonce,
    expiry,
  };

  const signature = await wallet.signTypedData(domain, types, value);
  console.log(`   Signature: ${signature.slice(0, 10)}...${signature.slice(-8)}`);

  // 6. Prepare compliance metadata
  const complianceMetadata = {
    jurisdiction: 'US',
    vaspLicense: 'demo-license',
    userConsent: 'ipfs://QmDemo...',
  };

  // 7. Estimate gas cost
  console.log('\n⛽ Estimating transaction cost...');
  try {
    const gasEstimate = await orchestrator.verifyAndMint.estimateGas(
      wallet.address,
      embedding,
      nonce,
      expiry,
      signature,
      complianceMetadata
    );

    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice || 0n;
    const estimatedGasCost = BigInt(gasEstimate) * gasPrice;

    console.log(`   Gas Estimate: ${gasEstimate.toString()}`);
    console.log(`   Gas Price: ${formatUSDC(gasPrice)} USDC/gas`);
    console.log(`   Estimated Gas Cost: ${formatUSDC(estimatedGasCost)} USDC`);
    console.log(`   Minting Fee: ${MINTING_FEE_USDC} USDC (built into contract)`);
    console.log(`   Total Cost: ~${formatUSDC(estimatedGasCost + parseUSDC(MINTING_FEE_USDC))} USDC`);
  } catch (error) {
    console.error('   ❌ Gas estimation failed:', error instanceof Error ? error.message : error);
    console.log('   Proceeding with transaction anyway...');
  }

  // 8. Submit transaction
  console.log('\n📡 Submitting motion minting transaction...');
  console.log('   (This will use USDC for gas fees)');

  const tx = await orchestrator.verifyAndMint(
    wallet.address,
    embedding,
    nonce,
    expiry,
    signature,
    complianceMetadata
  );

  console.log(`\n✅ Transaction submitted!`);
  console.log(`   Transaction Hash: ${tx.hash}`);
  console.log(`   View on Explorer: ${ARC_TESTNET_CONFIG.explorerUrl}/tx/${tx.hash}`);

  // 9. Wait for confirmation
  console.log('\n⏳ Waiting for confirmation...');
  const receipt = await tx.wait();

  if (receipt.status === 1) {
    console.log(`\n🎉 Motion NFT Minted Successfully!`);
    console.log(`   Block Number: ${receipt.blockNumber}`);
    console.log(`   Gas Used: ${receipt.gasUsed.toString()}`);
    
    const actualGasCost = BigInt(receipt.gasUsed) * (receipt.gasPrice || 0n);
    console.log(`   Actual Gas Cost: ${formatUSDC(actualGasCost)} USDC`);

    // Parse MotionNFTMinted event
    for (const log of receipt.logs) {
      try {
        const parsedLog = orchestrator.interface.parseLog({
          topics: log.topics as string[],
          data: log.data,
        });

        if (parsedLog && parsedLog.name === 'MotionNFTMinted') {
          const tokenId = parsedLog.args[0];
          const minter = parsedLog.args[1];
          const hash = parsedLog.args[2];
          const noveltyScore = parsedLog.args[3];

          console.log(`\n📜 Minting Event:`);
          console.log(`   Token ID: ${tokenId.toString()}`);
          console.log(`   Minter: ${minter}`);
          console.log(`   Embedding Hash: ${hash}`);
          console.log(`   Novelty Score: ${noveltyScore.toString()}`);
        }
      } catch (e) {
        // Skip non-matching logs
      }
    }
  } else {
    console.log('\n❌ Transaction Failed');
    return;
  }

  // 10. Check updated USDC balance
  const newBalance = await getBalance(usdc, wallet.address);
  const balanceChange = balance.raw - newBalance.raw;

  console.log(`\n💰 Updated USDC Balance: ${newBalance.formatted} USDC`);
  console.log(`   Gas Paid: ${formatUSDC(balanceChange)} USDC`);
  console.log(`   (Minting fee of ${MINTING_FEE_USDC} USDC handled by contract logic)`);

  // 11. Summary
  console.log(`\n📊 Transaction Summary:`);
  console.log(`   ✅ Motion embedding validated`);
  console.log(`   ✅ Novelty check passed`);
  console.log(`   ✅ NFT minted and transferred`);
  console.log(`   ✅ All fees paid in USDC (Arc's native gas token)`);
  console.log(`   ✅ Transaction finalized on Arc blockchain`);

  console.log('\n✨ Done! Your motion is now immortalized on-chain.');
}

// Run the example
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Error:', error.message);
    if (error.data) {
      console.error('Error data:', error.data);
    }
    process.exit(1);
  });
