import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';

enum TestnetBlockchain {
  ARC_TESTNET = 'ARC-TESTNET',
}

async function setupArcTestnetWallet() {
  try {
    // Initialize Circle Developer Controlled Wallets client
    const client = initiateDeveloperControlledWalletsClient({
      apiKey: process.env.CIRCLE_API_KEY || '',
      entitySecret: process.env.CIRCLE_ENTITY_SECRET || ''
    });

    console.log('🔐 Circle Developer Controlled Wallets initialized');

    // Your wallet address
    const walletAddress = '0x6e8074B3dB5D75C3400f6D99606be93D58B5e7b0';

    // Request testnet tokens for Arc testnet
    console.log('💰 Requesting testnet tokens for Arc...');
    const response = await client.requestTestnetTokens({
      address: walletAddress,
      blockchain: TestnetBlockchain.ARC_TESTNET,
      usdc: true,   // Request USDC
      native: true, // Request native gas tokens
      eurc: false   // Don't need EURC
    });

    console.log('✅ Testnet tokens requested successfully!');
    console.log('Status:', response.status);
    console.log('Check your wallet at:', walletAddress);
    console.log('Arc Testnet Explorer:', `https://explorer.arc-testnet.circle.com/address/${walletAddress}`);

  } catch (error) {
    console.error('❌ Error setting up wallet:', error);
    console.log('\nℹ️  Alternative: Use the Circle Faucet directly:');
    console.log('   https://faucet.circle.com/');
  }
}

setupArcTestnetWallet();
