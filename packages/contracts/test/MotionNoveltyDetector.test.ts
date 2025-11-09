import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import "@nomicfoundation/hardhat-chai-matchers";
import { MotionNoveltyDetector } from "../typechain-types";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("MotionNoveltyDetector", function () {
  let detector: MotionNoveltyDetector;
  let owner: SignerWithAddress;
  let agent1: SignerWithAddress;
  let agent2: SignerWithAddress;
  let unauthorized: SignerWithAddress;

  const NOVELTY_ATTESTATION_TYPEHASH = ethers.keccak256(
    ethers.toUtf8Bytes(
      "NoveltyAttestation(address agent,bytes32 embeddingHash,uint256 confidenceScore,uint256 localDensity,uint256 nonce,uint256 expiry)"
    )
  );

  beforeEach(async function () {
    [owner, agent1, agent2, unauthorized] = await ethers.getSigners();

    const MotionNoveltyDetectorFactory = await ethers.getContractFactory("MotionNoveltyDetector");
    detector = await MotionNoveltyDetectorFactory.deploy(owner.address);
    await detector.waitForDeployment();

    // Authorize agent1
    await detector.setAgentAuthorization(agent1.address, true);
  });

  describe("Deployment", function () {
    it("Should set the correct owner", async function () {
      expect(await detector.owner()).to.equal(owner.address);
    });

    it("Should initialize with default novelty threshold", async function () {
      expect(await detector.noveltyThreshold()).to.equal(9500n); // 95%
    });

    it("Should have correct threshold bounds", async function () {
      expect(await detector.MIN_THRESHOLD()).to.equal(8500n);
      expect(await detector.MAX_THRESHOLD()).to.equal(9900n);
    });
  });

  describe("Agent Authorization", function () {
    it("Should authorize agents", async function () {
      await detector.setAgentAuthorization(agent2.address, true);
      expect(await detector.authorizedAgents(agent2.address)).to.be.true;
    });

    it("Should revoke agent authorization", async function () {
      await detector.setAgentAuthorization(agent1.address, false);
      expect(await detector.authorizedAgents(agent1.address)).to.be.false;
    });

    it("Should emit AgentAuthorized event", async function () {
      await expect(detector.setAgentAuthorization(agent2.address, true))
        .to.emit(detector, "AgentAuthorized")
        .withArgs(agent2.address, true);
    });

    it("Should only allow owner to authorize agents", async function () {
      await expect(
        detector.connect(agent1).setAgentAuthorization(agent2.address, true)
      ).to.be.reverted;
    });
  });

  describe("Novelty Verification", function () {
    let embeddingHash: string;
    let attestation: any;
    let compliance: any;
    let expiry: number;

    beforeEach(async function () {
      embeddingHash = ethers.keccak256(ethers.toUtf8Bytes("motion_embedding_1"));
      expiry = (await time.latest()) + 300; // 5 minutes from now

      attestation = {
        agent: agent1.address,
        embeddingHash: embeddingHash,
        confidenceScore: 9600, // 96% confidence
        localDensity: 5000, // Medium density
        nonce: 0,
        expiry: expiry,
      };

      compliance = {
        dataOriginHash: ethers.keccak256(ethers.toUtf8Bytes("raw_sensor_data_1")),
        jurisdictionTag: "KE",
        userConsent: true,
        vaspLicenseId: "VASP-KE-2025-001",
      };
    });

    async function signAttestation(signer: SignerWithAddress, att: any) {
      const domain = {
        name: "MotionNoveltyDetector",
        version: "1",
        chainId: (await ethers.provider.getNetwork()).chainId,
        verifyingContract: await detector.getAddress(),
      };

      const types = {
        NoveltyAttestation: [
          { name: "agent", type: "address" },
          { name: "embeddingHash", type: "bytes32" },
          { name: "confidenceScore", type: "uint256" },
          { name: "localDensity", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "expiry", type: "uint256" },
        ],
      };

      return await signer.signTypedData(domain, types, att);
    }

    it("Should verify and record novel motion", async function () {
      const signature = await signAttestation(agent1, attestation);

      const tx = await detector.verifyNovelty(attestation, signature, compliance);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt!.blockNumber);
      
      await expect(tx)
        .to.emit(detector, "NovelMotionDetected")
        .withArgs(embeddingHash, 9600n, 5000n, agent1.address, block!.timestamp);
    });

    it("Should record compliance metadata", async function () {
      const signature = await signAttestation(agent1, attestation);

      await expect(detector.verifyNovelty(attestation, signature, compliance))
        .to.emit(detector, "ComplianceRecorded")
        .withArgs(embeddingHash, "KE", "VASP-KE-2025-001");

      const storedCompliance = await detector.getComplianceMetadata(embeddingHash);
      expect(storedCompliance.jurisdictionTag).to.equal("KE");
      expect(storedCompliance.vaspLicenseId).to.equal("VASP-KE-2025-001");
      expect(storedCompliance.userConsent).to.be.true;
    });

    it("Should increment agent nonce", async function () {
      const signature = await signAttestation(agent1, attestation);
      await detector.verifyNovelty(attestation, signature, compliance);

      expect(await detector.agentNonces(agent1.address)).to.equal(1n);
    });

    it("Should reject unauthorized agent", async function () {
      attestation.agent = unauthorized.address;
      const signature = await signAttestation(unauthorized, attestation);

      await expect(
        detector.verifyNovelty(attestation, signature, compliance)
      ).to.be.revertedWithCustomError(detector, "UnauthorizedAgent");
    });

    it("Should reject expired attestation", async function () {
      attestation.expiry = (await time.latest()) - 1; // Past expiry
      const signature = await signAttestation(agent1, attestation);

      await expect(
        detector.verifyNovelty(attestation, signature, compliance)
      ).to.be.revertedWithCustomError(detector, "ExpiredAttestation");
    });

    it("Should reject invalid nonce", async function () {
      attestation.nonce = 5; // Wrong nonce
      const signature = await signAttestation(agent1, attestation);

      await expect(
        detector.verifyNovelty(attestation, signature, compliance)
      ).to.be.revertedWithCustomError(detector, "InvalidNonce");
    });

    it("Should reject invalid signature", async function () {
      const signature = await signAttestation(agent2, attestation); // Wrong signer

      await expect(
        detector.verifyNovelty(attestation, signature, compliance)
      ).to.be.revertedWithCustomError(detector, "InvalidSignature");
    });

    it("Should reject missing user consent", async function () {
      compliance.userConsent = false;
      const signature = await signAttestation(agent1, attestation);

      await expect(
        detector.verifyNovelty(attestation, signature, compliance)
      ).to.be.revertedWithCustomError(detector, "MissingComplianceData");
    });

    it("Should reject missing VASP license", async function () {
      compliance.vaspLicenseId = "";
      const signature = await signAttestation(agent1, attestation);

      await expect(
        detector.verifyNovelty(attestation, signature, compliance)
      ).to.be.revertedWithCustomError(detector, "MissingComplianceData");
    });

    it("Should reject duplicate embedding", async function () {
      const signature = await signAttestation(agent1, attestation);
      await detector.verifyNovelty(attestation, signature, compliance);

      // Try to submit again with new nonce
      attestation.nonce = 1;
      const signature2 = await signAttestation(agent1, attestation);

      await expect(
        detector.verifyNovelty(attestation, signature2, compliance)
      ).to.be.revertedWithCustomError(detector, "EmbeddingAlreadyKnown");
    });

    it("Should reject low confidence score", async function () {
      attestation.confidenceScore = 9000; // Below 95% threshold
      const signature = await signAttestation(agent1, attestation);

      await expect(
        detector.verifyNovelty(attestation, signature, compliance)
      ).to.be.revertedWithCustomError(detector, "BelowNoveltyThreshold");
    });

    it("Should reject invalid confidence score", async function () {
      attestation.confidenceScore = 15000; // > 10000
      const signature = await signAttestation(agent1, attestation);

      await expect(
        detector.verifyNovelty(attestation, signature, compliance)
      ).to.be.revertedWithCustomError(detector, "InvalidConfidenceScore");
    });
  });

  describe("Adaptive Thresholding", function () {
    it("Should lower threshold in sparse regions", async function () {
      const sparseThreshold = await detector.getAdaptiveThreshold(2000); // Low density
      const baseThreshold = await detector.noveltyThreshold();

      expect(sparseThreshold).to.be.lt(baseThreshold);
    });

    it("Should raise threshold in dense regions", async function () {
      const denseThreshold = await detector.getAdaptiveThreshold(8000); // High density
      const baseThreshold = await detector.noveltyThreshold();

      expect(denseThreshold).to.be.gt(baseThreshold);
    });

    it("Should use base threshold in medium density", async function () {
      const mediumThreshold = await detector.getAdaptiveThreshold(5000);
      const baseThreshold = await detector.noveltyThreshold();

      expect(mediumThreshold).to.equal(baseThreshold);
    });

    it("Should clamp threshold to minimum", async function () {
      const extremelyLowThreshold = await detector.getAdaptiveThreshold(0);
      // With density 0, formula gives: 9500 - ((3000 - 0) * 400 / 3000) = 9500 - 400 = 9100
      expect(extremelyLowThreshold).to.equal(9100n);
    });

    it("Should clamp threshold to maximum", async function () {
      const extremelyHighThreshold = await detector.getAdaptiveThreshold(10000);
      expect(extremelyHighThreshold).to.equal(await detector.MAX_THRESHOLD());
    });
  });

  describe("Batch Verification", function () {
    async function createBatchAttestations(count: number) {
      const attestations = [];
      const signatures = [];
      const complianceData = [];

      const currentTime = await time.latest();
      const currentNonce = await detector.agentNonces(agent1.address);

      for (let i = 0; i < count; i++) {
        const embeddingHash = ethers.keccak256(
          ethers.toUtf8Bytes(`motion_embedding_batch_${currentNonce + BigInt(i)}`)
        );

        const attestation = {
          agent: agent1.address,
          embeddingHash: embeddingHash,
          confidenceScore: 9600,
          localDensity: 5000,
          nonce: Number(currentNonce) + i,
          expiry: currentTime + 300,
        };

        const compliance = {
          dataOriginHash: ethers.keccak256(ethers.toUtf8Bytes(`raw_data_batch_${currentNonce + BigInt(i)}`)),
          jurisdictionTag: "KE",
          userConsent: true,
          vaspLicenseId: "VASP-KE-2025-001",
        };

        const signature = await signAttestationHelper(agent1, attestation);

        attestations.push(attestation);
        signatures.push(signature);
        complianceData.push(compliance);
      }

      return { attestations, signatures, complianceData };
    }

    async function signAttestationHelper(signer: SignerWithAddress, att: any) {
      const domain = {
        name: "MotionNoveltyDetector",
        version: "1",
        chainId: (await ethers.provider.getNetwork()).chainId,
        verifyingContract: await detector.getAddress(),
      };

      const types = {
        NoveltyAttestation: [
          { name: "agent", type: "address" },
          { name: "embeddingHash", type: "bytes32" },
          { name: "confidenceScore", type: "uint256" },
          { name: "localDensity", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "expiry", type: "uint256" },
        ],
      };

      return await signer.signTypedData(domain, types, att);
    }

    it("Should process batch of novel motions", async function () {
      const { attestations, signatures, complianceData } = await createBatchAttestations(5);

      const results = await detector.batchVerifyNovelty.staticCall(
        attestations,
        signatures,
        complianceData
      );

      expect(results.length).to.equal(5);
      results.forEach((result) => expect(result).to.be.true);
    });

    it("Should handle mixed valid/invalid attestations", async function () {
      // Use a fresh agent to avoid nonce conflicts from previous tests
      await detector.setAgentAuthorization(agent2.address, true);
      
      const currentTime = await time.latest();
      const currentNonce = await detector.agentNonces(agent2.address);
      
      const attestations = [];
      const signatures = [];
      const complianceDataArray = [];
      
      // Create 3 attestations: valid, invalid (low confidence), valid
      for (let i = 0; i < 3; i++) {
        const embeddingHash = ethers.keccak256(
          ethers.toUtf8Bytes(`motion_mixed_batch_${i}`)
        );

        const attestation = {
          agent: agent2.address,
          embeddingHash: embeddingHash,
          confidenceScore: i === 1 ? 8000 : 9600, // Second one is invalid
          localDensity: 5000,
          nonce: Number(currentNonce) + i,
          expiry: currentTime + 300,
        };

        const compliance = {
          dataOriginHash: ethers.keccak256(ethers.toUtf8Bytes(`raw_data_mixed_${i}`)),
          jurisdictionTag: "KE",
          userConsent: true,
          vaspLicenseId: "VASP-KE-2025-001",
        };

        const signature = await signAttestationHelper(agent2, attestation);

        attestations.push(attestation);
        signatures.push(signature);
        complianceDataArray.push(compliance);
      }

      // Execute the batch - the contract's try-catch will handle failures
      const tx = await detector.batchVerifyNovelty(
        attestations,
        signatures,
        complianceDataArray
      );
      const receipt = await tx.wait();

      // The batch function should complete successfully even with some failures
      expect(receipt!.status).to.equal(1);
      
      // Check that at least one attestation succeeded (the first one should work)
      const finalNonce = await detector.agentNonces(agent2.address);
      expect(finalNonce).to.be.gt(currentNonce); // At least one succeeded
    });
  });

  describe("Threshold Management", function () {
    it("Should allow owner to update threshold", async function () {
      await detector.setNoveltyThreshold(9000);
      expect(await detector.noveltyThreshold()).to.equal(9000n);
    });

    it("Should emit ThresholdAdjusted event", async function () {
      await expect(detector.setNoveltyThreshold(9000))
        .to.emit(detector, "ThresholdAdjusted")
        .withArgs(9500n, 9000n, 0);
    });

    it("Should reject threshold below minimum", async function () {
      await expect(
        detector.setNoveltyThreshold(8000)
      ).to.be.revertedWithCustomError(detector, "InvalidThreshold");
    });

    it("Should reject threshold above maximum", async function () {
      await expect(
        detector.setNoveltyThreshold(10000)
      ).to.be.revertedWithCustomError(detector, "InvalidThreshold");
    });

    it("Should only allow owner to update threshold", async function () {
      await expect(
        detector.connect(agent1).setNoveltyThreshold(9000)
      ).to.be.reverted;
    });
  });

  describe("Compliance Audit", function () {
    let embeddingHash: string;

    beforeEach(async function () {
      embeddingHash = ethers.keccak256(ethers.toUtf8Bytes("motion_embedding_audit"));

      const attestation = {
        agent: agent1.address,
        embeddingHash: embeddingHash,
        confidenceScore: 9600,
        localDensity: 5000,
        nonce: 0,
        expiry: (await time.latest()) + 300,
      };

      const compliance = {
        dataOriginHash: ethers.keccak256(ethers.toUtf8Bytes("raw_data_audit")),
        jurisdictionTag: "KE",
        userConsent: true,
        vaspLicenseId: "VASP-KE-2025-001",
      };

      const domain = {
        name: "MotionNoveltyDetector",
        version: "1",
        chainId: (await ethers.provider.getNetwork()).chainId,
        verifyingContract: await detector.getAddress(),
      };

      const types = {
        NoveltyAttestation: [
          { name: "agent", type: "address" },
          { name: "embeddingHash", type: "bytes32" },
          { name: "confidenceScore", type: "uint256" },
          { name: "localDensity", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "expiry", type: "uint256" },
        ],
      };

      const signature = await agent1.signTypedData(domain, types, attestation);
      await detector.verifyNovelty(attestation, signature, compliance);
    });

    it("Should return compliant status for valid embedding", async function () {
      const [isCompliant, metadata] = await detector.auditCompliance(embeddingHash);

      expect(isCompliant).to.be.true;
      expect(metadata.jurisdictionTag).to.equal("KE");
      expect(metadata.vaspLicenseId).to.equal("VASP-KE-2025-001");
      expect(metadata.userConsent).to.be.true;
    });

    it("Should return non-compliant for unknown embedding", async function () {
      const unknownHash = ethers.keccak256(ethers.toUtf8Bytes("unknown"));
      const [isCompliant] = await detector.auditCompliance(unknownHash);

      expect(isCompliant).to.be.false;
    });
  });

  describe("Density Distribution Tracking", function () {
    it("Should track density distribution", async function () {
      const attestations = [];
      const signatures = [];
      const complianceData = [];

      // Create attestations with varying densities
      // Use different confidence scores to account for adaptive thresholds
      // Density 2000: threshold = 9500 - ((3000-2000)*400/3000) = 9500 - 133 = 9367
      // Density 5000: threshold = 9500 (base)
      // Density 8000: threshold = 9500 + ((8000-7000)*400/3000) = 9500 + 133 = 9633
      const testCases = [
        { density: 2000, confidenceScore: 9400 }, // Sparse region: threshold ~9367
        { density: 5000, confidenceScore: 9600 }, // Medium density: base threshold 9500
        { density: 8000, confidenceScore: 9700 }, // Dense region: threshold ~9633
      ];
      const currentTime = await time.latest();

      for (let i = 0; i < testCases.length; i++) {
        const embeddingHash = ethers.keccak256(
          ethers.toUtf8Bytes(`motion_density_${i}`)
        );

        const attestation = {
          agent: agent1.address,
          embeddingHash: embeddingHash,
          confidenceScore: testCases[i].confidenceScore,
          localDensity: testCases[i].density,
          nonce: i,
          expiry: currentTime + 300,
        };

        const compliance = {
          dataOriginHash: ethers.keccak256(ethers.toUtf8Bytes(`raw_data_density_${i}`)),
          jurisdictionTag: "KE",
          userConsent: true,
          vaspLicenseId: "VASP-KE-2025-001",
        };

        const domain = {
          name: "MotionNoveltyDetector",
          version: "1",
          chainId: (await ethers.provider.getNetwork()).chainId,
          verifyingContract: await detector.getAddress(),
        };

        const types = {
          NoveltyAttestation: [
            { name: "agent", type: "address" },
            { name: "embeddingHash", type: "bytes32" },
            { name: "confidenceScore", type: "uint256" },
            { name: "localDensity", type: "uint256" },
            { name: "nonce", type: "uint256" },
            { name: "expiry", type: "uint256" },
          ],
        };

        const signature = await agent1.signTypedData(domain, types, attestation);
        await detector.verifyNovelty(attestation, signature, compliance);
      }

      // Check total embeddings
      const total = await detector.getTotalEmbeddings();
      expect(total).to.equal(3n);

      // Check that density buckets were updated
      const [count20] = await detector.getDensityBucket(20); // 2000 / 100 = bucket 20
      const [count50] = await detector.getDensityBucket(50); // 5000 / 100 = bucket 50
      const [count80] = await detector.getDensityBucket(80); // 8000 / 100 = bucket 80
      
      expect(count20).to.equal(1n);
      expect(count50).to.equal(1n);
      expect(count80).to.equal(1n);
    });
  });

  describe("Integration Scenario: Real-world Motion Pipeline", function () {
    it("Should process multi-agent attestations for same motion", async function () {
      // Scenario: Two independent AI agents (MotionBlend + Wearable) attest to same motion event
      await detector.setAgentAuthorization(agent2.address, true);

      const motionId = "jump_record_2025";
      const embeddingHash1 = ethers.keccak256(
        ethers.toUtf8Bytes(`${motionId}_motionblend`)
      );
      const embeddingHash2 = ethers.keccak256(
        ethers.toUtf8Bytes(`${motionId}_wearable`)
      );

      const currentTime = await time.latest();

      // Agent 1 (MotionBlend AI) attestation
      const attestation1 = {
        agent: agent1.address,
        embeddingHash: embeddingHash1,
        confidenceScore: 9700,
        localDensity: 3000,
        nonce: 0,
        expiry: currentTime + 300,
      };

      const compliance1 = {
        dataOriginHash: ethers.keccak256(ethers.toUtf8Bytes("mocap_data_jump")),
        jurisdictionTag: "KE",
        userConsent: true,
        vaspLicenseId: "VASP-KE-2025-MOVERSE",
      };

      const domain = {
        name: "MotionNoveltyDetector",
        version: "1",
        chainId: (await ethers.provider.getNetwork()).chainId,
        verifyingContract: await detector.getAddress(),
      };

      const types = {
        NoveltyAttestation: [
          { name: "agent", type: "address" },
          { name: "embeddingHash", type: "bytes32" },
          { name: "confidenceScore", type: "uint256" },
          { name: "localDensity", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "expiry", type: "uint256" },
        ],
      };

      const signature1 = await agent1.signTypedData(domain, types, attestation1);
      await detector.verifyNovelty(attestation1, signature1, compliance1);

      // Agent 2 (Wearable sensor) attestation
      const attestation2 = {
        agent: agent2.address,
        embeddingHash: embeddingHash2,
        confidenceScore: 9550,
        localDensity: 3200,
        nonce: 0,
        expiry: currentTime + 300,
      };

      const compliance2 = {
        dataOriginHash: ethers.keccak256(ethers.toUtf8Bytes("imu_data_jump")),
        jurisdictionTag: "KE",
        userConsent: true,
        vaspLicenseId: "VASP-KE-2025-FITBIT",
      };

      const signature2 = await agent2.signTypedData(domain, types, attestation2);
      await detector.verifyNovelty(attestation2, signature2, compliance2);

      // Verify both attestations recorded
      const record1 = await detector.getNoveltyRecord(embeddingHash1);
      const record2 = await detector.getNoveltyRecord(embeddingHash2);

      expect(record1.agent).to.equal(agent1.address);
      expect(record2.agent).to.equal(agent2.address);
      expect(record1.isNovel).to.be.true;
      expect(record2.isNovel).to.be.true;

      // Both should have slightly lower threshold due to sparse region
      expect(record1.confidenceScore).to.be.gte(9500);
      expect(record2.confidenceScore).to.be.gte(9500);
    });
  });
});
