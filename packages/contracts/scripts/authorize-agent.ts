import hre from 'hardhat';
import * as readline from 'readline';

async function promptForAddress(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  console.log('🔐 Agent Authorization Tool\n');

  const ethers = hre.ethers;

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log('Deployer address:', await deployer.getAddress());
  console.log('');

  // Get contract address
  const detectorAddress = await promptForAddress(
    'Enter MotionNoveltyDetector contract address: '
  );

  if (!ethers.isAddress(detectorAddress)) {
    throw new Error('Invalid contract address');
  }

  // Get agent address
  const agentAddress = await promptForAddress(
    'Enter agent address to authorize: '
  );

  if (!ethers.isAddress(agentAddress)) {
    throw new Error('Invalid agent address');
  }

  // Confirm action
  const confirm = await promptForAddress(
    `\nAuthorize ${agentAddress} as agent? (yes/no): `
  );

  if (confirm.toLowerCase() !== 'yes') {
    console.log('Authorization cancelled.');
    return;
  }

  console.log('\n🚀 Authorizing agent...\n');

  // Get contract instance
  const detector = await ethers.getContractAt('MotionNoveltyDetector', detectorAddress);

  // Authorize agent
  const tx = await detector.setAgentAuthorization(agentAddress, true);
  console.log('Transaction submitted:', tx.hash);

  const receipt = await tx.wait();
  console.log('Transaction confirmed in block:', receipt?.blockNumber);

  // Verify authorization
  const isAuthorized = await detector.authorizedAgents(agentAddress);
  console.log('\n✅ Agent authorization status:', isAuthorized ? 'AUTHORIZED' : 'NOT AUTHORIZED');

  if (isAuthorized) {
    console.log('\n🎉 Success! Agent is now authorized to sign attestations.');
    console.log('\nNext steps:');
    console.log(`  1. Update apps/agent-service/.env with AGENT_PRIVATE_KEY for ${agentAddress}`);
    console.log('  2. Start agent service: cd apps/agent-service && npm run dev');
    console.log('  3. Test attestation flow with sample motion data');
  } else {
    console.log('\n❌ Authorization failed. Check transaction revert reason.');
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Authorization failed:', error);
    process.exit(1);
  });
