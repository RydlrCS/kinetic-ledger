import { ethers, Contract, Wallet, JsonRpcProvider } from 'ethers';
import { logger, config_obj } from './config';

// ABI stubs - will be replaced with full typechain-types imports after contract deployment
const NOVELTY_DETECTOR_ABI = [
  'function verifyNovelty(address to, bytes32 embeddingHash, uint256 nonce, uint256 expiry, bytes signature) external returns (bool)',
  'function embeddingExists(bytes32 embeddingHash) external view returns (bool)',
  'function getAdaptiveThreshold(bytes32 embeddingHash) external view returns (uint256)',
  'event NovelMotionDetected(address indexed user, bytes32 indexed embeddingHash, uint256 indexed nonce, uint256 threshold, uint256 timestamp)',
];

const ORCHESTRATOR_ABI = [
  'function verifyAndMint(address to, uint256[] embedding, uint256 nonce, uint256 expiry, bytes signature, tuple(string jurisdiction, string vaspLicense, string userConsent) complianceMetadata) external returns (uint256)',
  'function getMotionRecord(uint256 tokenId) external view returns (tuple(address minter, bytes32 embeddingHash, uint256 mintedAt, uint256 noveltyScore, bool isNovel))',
  'event MotionNFTMinted(uint256 indexed tokenId, address indexed minter, bytes32 indexed embeddingHash, uint256 noveltyScore)',
];

const ERC20_ABI = [
  'function balanceOf(address account) external view returns (uint256)',
  'function transfer(address to, uint256 amount) external returns (bool)',
  'function approve(address spender, uint256 amount) external returns (bool)',
];

export interface ContractInterfaces {
  noveltyDetector: Contract;
  orchestrator: Contract;
  usdc: Contract;
  provider: JsonRpcProvider;
  wallet: Wallet;
}

/**
 * Initialize contract instances with ethers.js
 */
export function initializeContracts(
  provider: JsonRpcProvider,
  wallet: Wallet
): ContractInterfaces {
  const noveltyDetector = new Contract(
    config_obj.contracts.noveltyDetector,
    NOVELTY_DETECTOR_ABI,
    wallet
  );

  const orchestrator = new Contract(
    config_obj.contracts.orchestrator,
    ORCHESTRATOR_ABI,
    wallet
  );

  const usdc = new Contract(config_obj.contracts.usdc, ERC20_ABI, wallet);

  logger.info(
    {
      service: 'agent-service',
      contracts: {
        noveltyDetector: config_obj.contracts.noveltyDetector,
        orchestrator: config_obj.contracts.orchestrator,
        usdc: config_obj.contracts.usdc,
      },
    },
    'Contracts initialized'
  );

  return { noveltyDetector, orchestrator, usdc, provider, wallet };
}

/**
 * Check if embedding already exists on-chain
 */
export async function checkEmbeddingExists(
  noveltyDetector: Contract,
  embeddingHash: string
): Promise<boolean> {
  try {
    const exists = await noveltyDetector.embeddingExists(embeddingHash);
    logger.trace(
      {
        service: 'agent-service',
        action: 'embedding_existence_check',
        embeddingHash,
        exists,
      },
      'Checked embedding existence'
    );
    return exists;
  } catch (err) {
    logger.error(
      {
        service: 'agent-service',
        action: 'embedding_check_failed',
        err: err instanceof Error ? err.message : String(err),
        embeddingHash,
      },
      'Failed to check embedding'
    );
    throw err;
  }
}

/**
 * Submit verifyAndMint transaction to orchestrator
 */
export async function submitVerifyAndMint(
  orchestrator: Contract,
  params: {
    to: string;
    embedding: number[];
    nonce: bigint;
    expiry: bigint;
    signature: string;
    complianceMetadata: {
      jurisdiction: string;
      vaspLicense: string;
      userConsent: string;
    };
  }
): Promise<{ txHash: string; tokenId?: bigint }> {
  try {
    // Estimate gas before submission
    const gasEstimate = await orchestrator.verifyAndMint.estimateGas(
      params.to,
      params.embedding.map((v) => BigInt(Math.floor(v * 1e6))),
      params.nonce,
      params.expiry,
      params.signature,
      params.complianceMetadata
    );

    logger.debug(
      {
        service: 'agent-service',
        action: 'gas_estimated',
        gasEstimate: gasEstimate.toString(),
        to: params.to,
      },
      'Gas estimation completed'
    );

    // Submit transaction with 20% gas buffer
    const tx = await orchestrator.verifyAndMint(
      params.to,
      params.embedding.map((v) => BigInt(Math.floor(v * 1e6))),
      params.nonce,
      params.expiry,
      params.signature,
      params.complianceMetadata,
      {
        gasLimit: (gasEstimate * 120n) / 100n,
      }
    );

    logger.info(
      {
        service: 'agent-service',
        action: 'tx_submitted',
        txHash: tx.hash,
        to: params.to,
        nonce: params.nonce.toString(),
      },
      'VerifyAndMint transaction submitted'
    );

    // Wait for confirmation
    const receipt = await tx.wait();

    // Parse tokenId from MotionNFTMinted event
    const mintEvent = receipt?.logs
      .map((log: any) => {
        try {
          return orchestrator.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((parsed: any) => parsed?.name === 'MotionNFTMinted');

    const tokenId = mintEvent?.args?.tokenId;

    logger.info(
      {
        service: 'agent-service',
        action: 'tx_confirmed',
        txHash: tx.hash,
        blockNumber: receipt?.blockNumber,
        tokenId: tokenId?.toString(),
        gasUsed: receipt?.gasUsed.toString(),
      },
      'VerifyAndMint transaction confirmed'
    );

    return { txHash: tx.hash, tokenId };
  } catch (err) {
    logger.error(
      {
        service: 'agent-service',
        action: 'tx_failed',
        err: err instanceof Error ? err.message : String(err),
        to: params.to,
      },
      'VerifyAndMint transaction failed'
    );
    throw err;
  }
}

/**
 * Get USDC balance of agent wallet
 */
export async function getUSDCBalance(
  usdc: Contract,
  address: string
): Promise<bigint> {
  try {
    const balance = await usdc.balanceOf(address);
    logger.trace(
      {
        service: 'agent-service',
        action: 'usdc_balance_check',
        address,
        balance: ethers.formatUnits(balance, 6),
      },
      'USDC balance retrieved'
    );
    return balance;
  } catch (err) {
    logger.error(
      {
        service: 'agent-service',
        action: 'balance_check_failed',
        err: err instanceof Error ? err.message : String(err),
        address,
      },
      'Failed to get USDC balance'
    );
    throw err;
  }
}
