import hre from 'hardhat';
import { writeFileSync } from 'fs';
import { join } from 'path';

interface DeploymentInfo {
  network: string;
  chainId: number;
  timestamp: string;
  deployer: string;
  validator: string;
  contract: {
    address: string;
    transactionHash: string;
  };
  config: {
    qualityThreshold: number;
    thresholdDescription: string;
  };
}

async function main() {
  console.log('🚀 Deploying BlendedMotionRegistry to Arc testnet...\n');

  const ethers = hre.ethers;

  // Get deployer and validator accounts
  const [deployer] = await ethers.getSigners();
  
  if (!deployer) {
    throw new Error('❌ No deployer account found. Make sure WALLET_PRIVATE_KEY is set in .env');
  }
  
  const deployerAddress = await deployer.getAddress();
  const balance = await ethers.provider.getBalance(deployerAddress);
  const network = await ethers.provider.getNetwork();

  console.log('📋 Deployment Details:');
  console.log('  Deployer address:', deployerAddress);
  console.log('  USDC balance:', ethers.formatUnits(balance, 6), 'USDC');
  console.log('  Network:', network.name);
  console.log('  Chain ID:', network.chainId);
  console.log('');

  if (balance === 0n) {
    throw new Error('❌ Insufficient USDC balance. Get testnet USDC from https://faucet.circle.com/');
  }

  // Use deployer as initial validator (can be updated later via setValidator)
  const validatorAddress = deployerAddress;
  console.log('🔐 Validator Configuration:');
  console.log('  Initial validator:', validatorAddress);
  console.log('  ⚠️  Update validator via setValidator() after deployment for production');
  console.log('');

  // Deploy BlendedMotionRegistry
  console.log('1️⃣  Deploying BlendedMotionRegistry...');
  const BlendedMotionRegistry = await ethers.getContractFactory('BlendedMotionRegistry');
  const registry = await BlendedMotionRegistry.deploy(validatorAddress);
  
  console.log('  ⏳ Waiting for deployment transaction...');
  await registry.waitForDeployment();
  
  const registryAddress = await registry.getAddress();
  const deployTx = registry.deploymentTransaction();
  
  console.log('  ✅ BlendedMotionRegistry deployed to:', registryAddress);
  console.log('  📝 Transaction hash:', deployTx?.hash || 'N/A');
  console.log('');

  // Verify deployment
  console.log('2️⃣  Verifying deployment...');
  const validator = await registry.getFunction('validator')();
  const qualityThreshold = await registry.getFunction('qualityThreshold')();
  
  console.log('  Validator address:', validator);
  console.log('  Quality threshold:', qualityThreshold.toString(), '/ 10000 =', Number(qualityThreshold) / 100, '%');
  console.log('  ✅ Contract successfully deployed and verified');
  console.log('');

  // Prepare deployment info
  const deploymentInfo: DeploymentInfo = {
    network: network.name,
    chainId: Number(network.chainId),
    timestamp: new Date().toISOString(),
    deployer: deployerAddress,
    validator: validatorAddress,
    contract: {
      address: registryAddress,
      transactionHash: deployTx?.hash || '',
    },
    config: {
      qualityThreshold: Number(qualityThreshold),
      thresholdDescription: `${Number(qualityThreshold) / 100}% minimum blend quality`,
    },
  };

  // Save deployment info
  console.log('3️⃣  Saving deployment information...');
  const deploymentsDir = join(__dirname, '..', 'deployments');
  const fs = require('fs');
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const deploymentFile = join(deploymentsDir, `blended-motion-registry-${network.chainId}-${Date.now()}.json`);
  writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
  console.log('  ✅ Deployment info saved to:', deploymentFile);
  console.log('');

  // Generate .env updates
  console.log('4️⃣  Environment variable updates:\n');
  console.log('# Add these to your .env files:\n');
  console.log('# BlendedMotionRegistry Contract');
  console.log(`BLENDED_MOTION_REGISTRY_ADDRESS=${registryAddress}`);
  console.log(`BLEND_VALIDATOR_ADDRESS=${validatorAddress}`);
  console.log(`BLEND_QUALITY_THRESHOLD=${qualityThreshold}`);
  console.log('');

  // Summary
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✨ BlendedMotionRegistry deployment completed!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('📦 Contract Address:', registryAddress);
  console.log('🔐 Validator Address:', validatorAddress);
  console.log('📊 Quality Threshold:', Number(qualityThreshold) / 100, '%');
  console.log('');
  console.log('🔗 Next Steps:');
  console.log('  1. Update .env in apps/motion-blend-service/ with BLENDED_MOTION_REGISTRY_ADDRESS');
  console.log('  2. Test blend registration with sample BVH files');
  console.log('  3. Generate EIP-712 signature for blend attestation');
  console.log('  4. Call registerBlend() with signed attestation');
  console.log('  5. Verify blend metadata with getBlendMetadata()');
  console.log('');
  console.log('📚 Contract Functions:');
  console.log('  - registerBlend(attestation, signature): Register a new blended motion');
  console.log('  - getBlendMetadata(embeddingHash): Query blend details');
  console.log('  - setValidator(address): Update trusted validator (owner only)');
  console.log('  - setQualityThreshold(uint256): Adjust minimum quality (owner only)');
  console.log('');
  console.log('🌐 Arc Testnet Explorer:');
  console.log(`  https://explorer.arc-testnet.circle.com/address/${registryAddress}`);
  console.log('');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Deployment failed:', error);
    process.exit(1);
  });
