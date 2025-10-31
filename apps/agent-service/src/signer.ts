import { ethers, Wallet, JsonRpcProvider } from 'ethers';
import { logger, config_obj } from './config';

// EIP-712 types for motion novelty attestation
export const EIP712_DOMAIN = {
  name: config_obj.eip712.domainName,
  version: config_obj.eip712.domainVersion,
  chainId: config_obj.eip712.chainId,
  verifyingContract: config_obj.contracts.noveltyDetector,
};

export const MOTION_ATTESTATION_TYPES = {
  MotionAttestation: [
    { name: 'to', type: 'address' },
    { name: 'embeddingHash', type: 'bytes32' },
    { name: 'nonce', type: 'uint256' },
    { name: 'expiry', type: 'uint256' },
  ],
};

export interface MotionAttestationData {
  to: string;
  embeddingHash: string;
  nonce: bigint;
  expiry: bigint;
}

/**
 * Initialize ethers.js provider and wallet
 */
export function initializeSigner(): { provider: JsonRpcProvider; wallet: Wallet } {
  const provider = new JsonRpcProvider(config_obj.rpc.url);
  const wallet = new Wallet(config_obj.agent.privateKey, provider);

  logger.info(
    {
      service: 'agent-service',
      address: wallet.address,
      rpc: config_obj.rpc.url,
    },
    'Agent signer initialized'
  );

  return { provider, wallet };
}

/**
 * Generate EIP-712 signature for motion attestation
 */
export async function signMotionAttestation(
  wallet: Wallet,
  attestation: MotionAttestationData
): Promise<string> {
  try {
    const signature = await wallet.signTypedData(
      EIP712_DOMAIN,
      MOTION_ATTESTATION_TYPES,
      attestation
    );

    logger.trace(
      {
        service: 'agent-service',
        action: 'eip712_signature_generated',
        to: attestation.to,
        embeddingHash: attestation.embeddingHash,
        nonce: attestation.nonce.toString(),
        expiry: attestation.expiry.toString(),
      },
      'Motion attestation signed'
    );

    return signature;
  } catch (err) {
    logger.error(
      {
        service: 'agent-service',
        action: 'signature_failed',
        err: err instanceof Error ? err.message : String(err),
        attestation,
      },
      'Failed to sign attestation'
    );
    throw err;
  }
}

/**
 * Hash raw motion embedding data
 */
export function hashMotionEmbedding(embedding: number[]): string {
  // Pack embedding as bytes32[] and hash
  const packed = ethers.solidityPacked(
    Array(embedding.length).fill('uint256'),
    embedding.map((v) => BigInt(Math.floor(v * 1e6))) // Scale to preserve precision
  );
  return ethers.keccak256(packed);
}

/**
 * Verify EIP-712 signature recovery
 */
export function recoverSigner(
  attestation: MotionAttestationData,
  signature: string
): string {
  try {
    const digest = ethers.TypedDataEncoder.hash(
      EIP712_DOMAIN,
      MOTION_ATTESTATION_TYPES,
      attestation
    );
    return ethers.recoverAddress(digest, signature);
  } catch (err) {
    logger.error(
      {
        service: 'agent-service',
        action: 'signature_recovery_failed',
        err: err instanceof Error ? err.message : String(err),
      },
      'Failed to recover signer'
    );
    throw err;
  }
}
