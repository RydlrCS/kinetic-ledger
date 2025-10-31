import hre from 'hardhat';
import { writeFileSync } from 'fs';
import { join } from 'path';

interface DeploymentAddresses {
  network: string;
  chainId: number;
  timestamp: string;
  deployer: string;
  contracts: {
    attestedMotion: string;
    motionNoveltyDetector: string;
    motionMintOrchestrator: string;
  };
  transactionHashes: {
    attestedMotion: string;
    motionNoveltyDetector: string;
    motionMintOrchestrator: string;
  };
}

async function main() {
  console.log('🚀 Starting Kinetic Ledger deployment to Arc testnet...\n');

  const ethers = hre.ethers;

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  const balance = await ethers.provider.getBalance(deployerAddress);

  console.log('📋 Deployment Details:');
  console.log('  Deployer address:', deployerAddress);
  console.log('  USDC balance:', ethers.formatUnits(balance, 6), 'USDC');
  console.log('  Network:', (await ethers.provider.getNetwork()).name);
  console.log('  Chain ID:', (await ethers.provider.getNetwork()).chainId);
  console.log('');

  if (balance === 0n) {
    throw new Error('❌ Insufficient USDC balance. Get testnet USDC from https://faucet.circle.com/');
  }

  const deploymentAddresses: DeploymentAddresses = {
    network: (await ethers.provider.getNetwork()).name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    timestamp: new Date().toISOString(),
    deployer: deployerAddress,
    contracts: {
      attestedMotion: '',
      motionNoveltyDetector: '',
      motionMintOrchestrator: '',
    },
    transactionHashes: {
      attestedMotion: '',
      motionNoveltyDetector: '',
      motionMintOrchestrator: '',
    },
  };

  // Step 1: Deploy AttestedMotion (ERC-721 NFT contract)
  console.log('1️⃣  Deploying AttestedMotion...');
  const AttestedMotion = await ethers.getContractFactory('AttestedMotion');
  const attestedMotion = await AttestedMotion.deploy(deployerAddress);
  await attestedMotion.waitForDeployment();
  const attestedMotionAddress = await attestedMotion.getAddress();
  deploymentAddresses.contracts.attestedMotion = attestedMotionAddress;
  deploymentAddresses.transactionHashes.attestedMotion = attestedMotion.deploymentTransaction()?.hash || '';

  console.log('  ✅ AttestedMotion deployed to:', attestedMotionAddress);
  console.log('  📝 Transaction:', deploymentAddresses.transactionHashes.attestedMotion);
  console.log('');

  // Step 2: Deploy MotionNoveltyDetector (RkCNN algorithm)
  console.log('2️⃣  Deploying MotionNoveltyDetector...');
  const MotionNoveltyDetector = await ethers.getContractFactory('MotionNoveltyDetector');
  const motionNoveltyDetector = await MotionNoveltyDetector.deploy(deployerAddress);
  await motionNoveltyDetector.waitForDeployment();
  const noveltyDetectorAddress = await motionNoveltyDetector.getAddress();
  deploymentAddresses.contracts.motionNoveltyDetector = noveltyDetectorAddress;
  deploymentAddresses.transactionHashes.motionNoveltyDetector = motionNoveltyDetector.deploymentTransaction()?.hash || '';

  console.log('  ✅ MotionNoveltyDetector deployed to:', noveltyDetectorAddress);
  console.log('  📝 Transaction:', deploymentAddresses.transactionHashes.motionNoveltyDetector);
  console.log('');

  // Step 3: Deploy MotionMintOrchestrator
  console.log('3️⃣  Deploying MotionMintOrchestrator...');
  const MotionMintOrchestrator = await ethers.getContractFactory('MotionMintOrchestrator');
  const orchestrator = await MotionMintOrchestrator.deploy(
    noveltyDetectorAddress,
    attestedMotionAddress,
    deployerAddress // rewardsEscrow (using deployer for now)
  );
  await orchestrator.waitForDeployment();
  const orchestratorAddress = await orchestrator.getAddress();
  deploymentAddresses.contracts.motionMintOrchestrator = orchestratorAddress;
  deploymentAddresses.transactionHashes.motionMintOrchestrator = orchestrator.deploymentTransaction()?.hash || '';

  console.log('  ✅ MotionMintOrchestrator deployed to:', orchestratorAddress);
  console.log('  📝 Transaction:', deploymentAddresses.transactionHashes.motionMintOrchestrator);
  console.log('');

  // Step 4: Authorize orchestrator in novelty detector
  console.log('4️⃣  Configuring contract permissions...');
  const authTx = await motionNoveltyDetector.setAgentAuthorization(orchestratorAddress, true);
  await authTx.wait();
  console.log('  ✅ Authorized orchestrator as agent in novelty detector');
  console.log('  📝 Transaction:', authTx.hash);
  console.log('');

  // Step 6: Save deployment addresses
  console.log('5️⃣  Saving deployment addresses...');
  const deploymentsDir = join(__dirname, '..', 'deployments');
  const fs = require('fs');
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const deploymentFile = join(deploymentsDir, `arc-testnet-${Date.now()}.json`);
  writeFileSync(deploymentFile, JSON.stringify(deploymentAddresses, null, 2));
  console.log('  ✅ Deployment addresses saved to:', deploymentFile);
  console.log('');

  // Step 7: Generate .env updates
  console.log('6️⃣  Environment variable updates:\n');
  console.log('# Add these to your .env files:\n');
  console.log('# Arc Testnet Contract Addresses');
  console.log(`ATTESTED_MOTION_ADDRESS=${attestedMotionAddress}`);
  console.log(`MOTION_NOVELTY_DETECTOR_ADDRESS=${noveltyDetectorAddress}`);
  console.log(`MOTION_MINT_ORCHESTRATOR_ADDRESS=${orchestratorAddress}`);
  console.log('');

  // Step 8: Summary
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✨ Deployment completed successfully!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('📦 Deployed Contracts:');
  console.log(`  AttestedMotion:           ${attestedMotionAddress}`);
  console.log(`  MotionNoveltyDetector:    ${noveltyDetectorAddress}`);
  console.log(`  MotionMintOrchestrator:   ${orchestratorAddress}`);
  console.log('');
  console.log('🔗 Next Steps:');
  console.log('  1. Update .env files in apps/agent-service/ and apps/api-gateway/');
  console.log('  2. Authorize agent address: motionNoveltyDetector.authorizeAgent(agentAddress)');
  console.log('  3. Test attestation flow with sample motion data');
  console.log('  4. Verify contracts on Arc explorer (if available)');
  console.log('');
  console.log('🌐 Arc Testnet Explorer:');
  console.log('  View transactions at: https://explorer.arc-testnet.circle.com/');
  console.log('');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Deployment failed:', error);
    process.exit(1);
  });
