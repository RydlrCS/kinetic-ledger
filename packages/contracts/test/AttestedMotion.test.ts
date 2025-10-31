import { expect } from 'chai';
import { ethers } from 'hardhat';
import { time } from '@nomicfoundation/hardhat-network-helpers';
import { AttestedMotion } from '../typechain-types';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';

describe('AttestedMotion', function () {
  let attestedMotion: AttestedMotion;
  let owner: SignerWithAddress;
  let validator: SignerWithAddress;
  let user: SignerWithAddress;
  let attacker: SignerWithAddress;

  const MOTION_DATA = '0x' + '1'.repeat(64); // Mock motion data
  const dataHash = ethers.keccak256(ethers.toUtf8Bytes(MOTION_DATA));

  beforeEach(async function () {
    [owner, validator, user, attacker] = await ethers.getSigners();
    
    const AttestedMotionFactory = await ethers.getContractFactory('AttestedMotion');
    attestedMotion = await AttestedMotionFactory.deploy(validator.address);
  });

  describe('Deployment', function () {
    it('Should set correct validator', async function () {
      expect(await attestedMotion.validator()).to.equal(validator.address);
    });

    it('Should set correct owner', async function () {
      expect(await attestedMotion.owner()).to.equal(owner.address);
    });

    it('Should revert with zero address validator', async function () {
      const AttestedMotionFactory = await ethers.getContractFactory('AttestedMotion');
      await expect(
        AttestedMotionFactory.deploy(ethers.ZeroAddress)
      ).to.be.revertedWith('Invalid validator');
    });
  });

  describe('Minting with Attestation', function () {
    async function createAttestation(
      to: string,
      hash: string,
      nonce: number,
      expiry: number
    ) {
      const domain = {
        name: 'AttestedMotion',
        version: '1',
        chainId: (await ethers.provider.getNetwork()).chainId,
        verifyingContract: await attestedMotion.getAddress(),
      };

      const types = {
        Mint: [
          { name: 'to', type: 'address' },
          { name: 'dataHash', type: 'bytes32' },
          { name: 'nonce', type: 'uint256' },
          { name: 'expiry', type: 'uint256' },
        ],
      };

      const value = {
        to,
        dataHash: hash,
        nonce,
        expiry,
      };

      return await validator.signTypedData(domain, types, value);
    }

    it('Should mint with valid attestation', async function () {
      const nonce = 1;
      const expiry = (await time.latest()) + 3600;
      const signature = await createAttestation(user.address, dataHash, nonce, expiry);

      await expect(
        attestedMotion.mintWithAttestation(user.address, dataHash, nonce, expiry, signature)
      )
        .to.emit(attestedMotion, 'MotionMinted')
        .withArgs(user.address, 1, dataHash, nonce, expiry);

      expect(await attestedMotion.ownerOf(1)).to.equal(user.address);
      expect(await attestedMotion.usedNonce(nonce)).to.be.true;
    });

    it('Should revert with expired attestation', async function () {
      const nonce = 2;
      const expiry = (await time.latest()) - 1;
      const signature = await createAttestation(user.address, dataHash, nonce, expiry);

      await expect(
        attestedMotion.mintWithAttestation(user.address, dataHash, nonce, expiry, signature)
      ).to.be.revertedWithCustomError(attestedMotion, 'ExpiredAttestation');
    });

    it('Should revert with reused nonce', async function () {
      const nonce = 3;
      const expiry = (await time.latest()) + 3600;
      const signature = await createAttestation(user.address, dataHash, nonce, expiry);

      await attestedMotion.mintWithAttestation(user.address, dataHash, nonce, expiry, signature);

      await expect(
        attestedMotion.mintWithAttestation(user.address, dataHash, nonce, expiry, signature)
      ).to.be.revertedWithCustomError(attestedMotion, 'UsedNonce');
    });

    it('Should revert with invalid signer', async function () {
      const nonce = 4;
      const expiry = (await time.latest()) + 3600;
      
      const domain = {
        name: 'AttestedMotion',
        version: '1',
        chainId: (await ethers.provider.getNetwork()).chainId,
        verifyingContract: await attestedMotion.getAddress(),
      };

      const types = {
        Mint: [
          { name: 'to', type: 'address' },
          { name: 'dataHash', type: 'bytes32' },
          { name: 'nonce', type: 'uint256' },
          { name: 'expiry', type: 'uint256' },
        ],
      };

      const value = {
        to: user.address,
        dataHash,
        nonce,
        expiry,
      };

      // Sign with attacker instead of validator
      const badSignature = await attacker.signTypedData(domain, types, value);

      await expect(
        attestedMotion.mintWithAttestation(user.address, dataHash, nonce, expiry, badSignature)
      ).to.be.revertedWithCustomError(attestedMotion, 'InvalidSigner');
    });

    it('Should revert with bad signature length', async function () {
      const nonce = 5;
      const expiry = (await time.latest()) + 3600;
      const badSignature = '0x1234'; // Invalid length

      await expect(
        attestedMotion.mintWithAttestation(user.address, dataHash, nonce, expiry, badSignature)
      ).to.be.revertedWithCustomError(attestedMotion, 'BadSignatureLength');
    });
  });

  describe('Admin Functions', function () {
    it('Should update validator', async function () {
      const newValidator = user.address;
      
      await expect(attestedMotion.setValidator(newValidator))
        .to.emit(attestedMotion, 'ValidatorUpdated')
        .withArgs(validator.address, newValidator);

      expect(await attestedMotion.validator()).to.equal(newValidator);
    });

    it('Should not allow non-owner to update validator', async function () {
      await expect(
        attestedMotion.connect(attacker).setValidator(user.address)
      ).to.be.revertedWithCustomError(attestedMotion, 'OwnableUnauthorizedAccount');
    });

    it('Should pause and unpause', async function () {
      await attestedMotion.pause();
      expect(await attestedMotion.paused()).to.be.true;

      const nonce = 6;
      const expiry = (await time.latest()) + 3600;
      const signature = await createAttestation(user.address, dataHash, nonce, expiry);

      async function createAttestation(to: string, hash: string, n: number, exp: number) {
        const domain = {
          name: 'AttestedMotion',
          version: '1',
          chainId: (await ethers.provider.getNetwork()).chainId,
          verifyingContract: await attestedMotion.getAddress(),
        };
        return await validator.signTypedData(domain, {
          Mint: [
            { name: 'to', type: 'address' },
            { name: 'dataHash', type: 'bytes32' },
            { name: 'nonce', type: 'uint256' },
            { name: 'expiry', type: 'uint256' },
          ],
        }, { to, dataHash: hash, nonce: n, expiry: exp });
      }

      await expect(
        attestedMotion.mintWithAttestation(user.address, dataHash, nonce, expiry, signature)
      ).to.be.revertedWithCustomError(attestedMotion, 'EnforcedPause');

      await attestedMotion.unpause();
      expect(await attestedMotion.paused()).to.be.false;
    });
  });
});
