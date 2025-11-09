import hre from 'hardhat';

async function main() {
  const ethers = hre.ethers;
  const [deployer] = await ethers.getSigners();
  const address = await deployer.getAddress();
  const balance = await ethers.provider.getBalance(address);
  const network = await ethers.provider.getNetwork();

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('💰 Wallet Balance Check');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('📍 Network:', network.name);
  console.log('🔗 Chain ID:', network.chainId.toString());
  console.log('👤 Address:', address);
  console.log('💵 Balance:', ethers.formatUnits(balance, 6), 'USDC');
  console.log('💵 Balance (wei):', balance.toString());
  console.log('');

  if (balance === 0n) {
    console.log('⚠️  No balance found!');
    console.log('');
    console.log('🚰 Get testnet funds from:');
    console.log('   1. Circle Faucet: https://faucet.circle.com/');
    console.log('      - Select: Arbitrum Sepolia');
    console.log('      - Request: USDC + ETH');
    console.log('');
    console.log('   2. Arbitrum Sepolia Faucet:');
    console.log('      - https://www.alchemy.com/faucets/arbitrum-sepolia');
    console.log('');
    console.log('   Enter this address:');
    console.log('   ' + address);
  } else {
    console.log('✅ Sufficient balance for deployment!');
    console.log('');
    console.log('🚀 Ready to deploy. Run:');
    console.log('   pnpm hardhat run scripts/deploy-blended-motion-registry.ts --network arcTestnet');
  }
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
