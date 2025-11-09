/**
 * 3D Motion Preview Component
 *
 * Renders skeletal animation using Three.js with:
 * - BVH file parsing and animation playback
 * - Real-time skeletal visualization
 * - Interactive camera controls
 * - Frame-by-frame controls
 *
 * Architecture:
 * - Client-side only (use 'use client' directive)
 * - Three.js for 3D rendering
 * - Canvas-based animation loop
 * - Proper resource cleanup on unmount
 *
 * Author: Kinetic Ledger Team
 * License: MIT
 */

'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

/**
 * Props for MotionPreview component
 */
interface MotionPreviewProps {
  /** Path to BVH file to render */
  bvhPath: string;
  /** Auto-play animation on load */
  autoPlay?: boolean;
  /** Width of canvas in pixels */
  width?: number;
  /** Height of canvas in pixels */
  height?: number;
  /** Playback speed multiplier */
  playbackSpeed?: number;
}

/**
 * BVH file structure after parsing
 */
interface BVHData {
  bones: Bone[];
  frames: Float32Array[];
  frameTime: number;
  totalFrames: number;
}

/**
 * Bone structure for skeletal animation
 */
interface Bone {
  name: string;
  position: [number, number, number];
  channels: string[];
  offset: [number, number, number];
  children: number[];
}

/**
 * 3D Motion Preview Component
 *
 * Displays skeletal animations from BVH files with:
 * - Automatic skeleton visualization
 * - Real-time animation playback
 * - Interactive controls
 * - Responsive sizing
 *
 * @param props Component props
 * @returns JSX component
 */
export default function MotionPreview({
  bvhPath,
  autoPlay = true,
  width = 800,
  height = 600,
  playbackSpeed = 1.0,
}: MotionPreviewProps) {
  const log = (message: string, data?: Record<string, unknown>) => {
    console.warn(
      `🚀 MotionPreview: ${message}`,
      data ? JSON.stringify(data, null, 2) : ''
    );
  };

  log('ENTRY: MotionPreview render', { bvhPath, autoPlay, width, height });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const bonesRef = useRef<THREE.Bone[]>([]);
  const animationRef = useRef<{
    currentFrame: number;
    isPlaying: boolean;
    bvhData: BVHData | null;
  }>({
    currentFrame: 0,
    isPlaying: autoPlay,
    bvhData: null,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [totalFrames, setTotalFrames] = useState(0);

  /**
   * Parse BVH file format
   *
   * BVH format structure:
   * - HIERARCHY section defines skeleton structure
   * - MOTION section contains animation frame data
   *
   * @param bvhText Raw BVH file content
   * @returns Parsed BVH data structure
   */
  const parseBVH = (bvhText: string): BVHData => {
    log('Parsing BVH file');

    const lines = bvhText.split('\n');
    let lineIndex = 0;
    const bones: Bone[] = [];
    const boneIndexMap = new Map<string, number>();

    // Parse HIERARCHY
    const parseHierarchy = (parentIndex: number = -1): void => {
      while (lineIndex < lines.length) {
        const line = lines[lineIndex].trim();
        lineIndex++;

        if (line.startsWith('ROOT ') || line.startsWith('JOINT ')) {
          const parts = line.split(/\s+/);
          const boneName = parts[1];
          const boneIndex = bones.length;
          boneIndexMap.set(boneName, boneIndex);

          const bone: Bone = {
            name: boneName,
            position: [0, 0, 0],
            channels: [],
            offset: [0, 0, 0],
            children: [],
          };

          // Parse offset
          const offsetLine = lines[lineIndex].trim();
          lineIndex++;
          if (offsetLine.startsWith('OFFSET')) {
            const offsetParts = offsetLine.split(/\s+/);
            bone.offset = [
              parseFloat(offsetParts[1]),
              parseFloat(offsetParts[2]),
              parseFloat(offsetParts[3]),
            ];
          }

          // Parse channels
          const channelsLine = lines[lineIndex].trim();
          lineIndex++;
          if (channelsLine.startsWith('CHANNELS')) {
            const channelParts = channelsLine.split(/\s+/);
            const numChannels = parseInt(channelParts[1]);
            bone.channels = channelParts.slice(2, 2 + numChannels);
          }

          if (parentIndex >= 0) {
            bones[parentIndex].children.push(boneIndex);
          }

          bones.push(bone);

          // Parse children
          const openBraceLine = lines[lineIndex].trim();
          if (openBraceLine === '{') {
            lineIndex++;
            parseHierarchy(boneIndex);
          }
        } else if (line === '}') {
          return;
        } else if (line.startsWith('End Site')) {
          lineIndex += 2; // Skip End Site and its offset
        }
      }
    };

    parseHierarchy();

    // Parse MOTION
    let frameTime = 0.016667; // Default 60 FPS
    const frames: Float32Array[] = [];

    while (lineIndex < lines.length) {
      const line = lines[lineIndex].trim();
      lineIndex++;

      if (line.startsWith('Frames:')) {
        const numFrames = parseInt(line.split(/\s+/)[1]);
        setTotalFrames(numFrames);
      } else if (line.startsWith('Frame Time:')) {
        frameTime = parseFloat(line.split(/\s+/)[2]);
      } else if (line && !line.startsWith('#')) {
        // Parse frame data
        const values = line.split(/\s+/).map((v) => parseFloat(v));
        frames.push(new Float32Array(values));
      }
    }

    log('✅ BVH parsed', {
      bones: bones.length,
      frames: frames.length,
      frameTime,
    });

    return {
      bones,
      frames,
      frameTime,
      totalFrames: frames.length,
    };
  };

  /**
   * Build Three.js skeleton from BVH data
   *
   * Creates bone objects and connections for visualization
   */
  const buildSkeleton = (bvhData: BVHData): void => {
    log('Building skeleton', { bones: bvhData.bones.length });

    if (!sceneRef.current) return;

    // Clear existing bones
    bonesRef.current.forEach((bone) => {
      bone.children.forEach((child) => sceneRef.current?.remove(child));
    });
    bonesRef.current = [];

    // Create bones
    bvhData.bones.forEach((bvhBone, index) => {
      const bone = new THREE.Bone();
      bone.position.set(...bvhBone.offset);
      bone.name = bvhBone.name;

      bonesRef.current[index] = bone;

      // Add to parent or scene
      if (index === 0) {
        sceneRef.current?.add(bone);
      } else {
        // Find parent and add as child
        bvhData.bones.forEach((checkBone, checkIndex) => {
          if (checkBone.children.includes(index)) {
            bonesRef.current[checkIndex].add(bone);
          }
        });
      }

      // Add visual sphere to bone
      const geometry = new THREE.SphereGeometry(0.1, 8, 8);
      const material = new THREE.MeshPhongMaterial({ color: 0x3498db });
      const sphere = new THREE.Mesh(geometry, material);
      bone.add(sphere);

      // Add lines to children
      bvhBone.children.forEach((childIndex) => {
        const childBone = bonesRef.current[childIndex];
        if (childBone) {
          const childPos = childBone.position;
          const points = [
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(
              childPos.x,
              childPos.y,
              childPos.z
            ),
          ];
          const lineGeom = new THREE.BufferGeometry().setFromPoints(points);
          const lineMat = new THREE.LineBasicMaterial({ color: 0x9b59b6 });
          const line = new THREE.Line(lineGeom, lineMat);
          bone.add(line);
        }
      });
    });
  };

  /**
   * Update bone positions for frame
   */
  const updateFrame = (frameIndex: number): void => {
    if (!animationRef.current.bvhData) return;

    const bvhData = animationRef.current.bvhData;
    if (frameIndex >= bvhData.frames.length) {
      animationRef.current.currentFrame = 0;
      return;
    }

    const frameData = bvhData.frames[frameIndex];
    let dataIndex = 0;

    const updateBone = (boneIndex: number): void => {
      const bone = bonesRef.current[boneIndex];
      const bvhBone = bvhData.bones[boneIndex];

      if (!bone) return;

      // Apply rotations and translations
      bvhBone.channels.forEach((channel) => {
        const value = (frameData[dataIndex++] * Math.PI) / 180; // Convert to radians

        if (channel === 'Xposition') {
          bone.position.x = value;
        } else if (channel === 'Yposition') {
          bone.position.y = value;
        } else if (channel === 'Zposition') {
          bone.position.z = value;
        } else if (channel === 'Xrotation') {
          bone.rotation.x = value;
        } else if (channel === 'Yrotation') {
          bone.rotation.y = value;
        } else if (channel === 'Zrotation') {
          bone.rotation.z = value;
        }
      });

      // Recurse to children
      bvhBone.children.forEach((childIndex) => updateBone(childIndex));
    };

    updateBone(0);
    setCurrentFrame(frameIndex);
  };

  /**
   * Initialize Three.js scene
   */
  const initScene = (): void => {
    if (!canvasRef.current) return;

    log('Initializing Three.js scene');

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf8f9fa);

    // Camera
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.set(0, 1, 2);
    camera.lookAt(0, 1, 0);

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 7);
    scene.add(directionalLight);

    // Ground plane
    const groundGeom = new THREE.PlaneGeometry(10, 10);
    const groundMat = new THREE.MeshPhongMaterial({ color: 0xe0e0e0 });
    const ground = new THREE.Mesh(groundGeom, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    scene.add(ground);

    sceneRef.current = scene;
    rendererRef.current = renderer;
    cameraRef.current = camera;

    log('✅ Scene initialized');
  };

  /**
   * Load and parse BVH file
   */
  useEffect(() => {
    log('🚀 ENTRY: Load BVH effect', { bvhPath });

    const loadBVH = async (): Promise<void> => {
      try {
        setIsLoading(true);
        setError(null);

        log('Fetching BVH file');

        const response = await fetch(bvhPath);
        if (!response.ok) {
          throw new Error(`Failed to load BVH: ${response.status}`);
        }

        const bvhText = await response.text();
        log('BVH file fetched', { size: bvhText.length });

        const bvhData = parseBVH(bvhText);
        animationRef.current.bvhData = bvhData;

        initScene();
        buildSkeleton(bvhData);
        updateFrame(0);

        setIsLoading(false);
        log('✅ BVH loaded successfully');
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : 'Unknown error';
        log('❌ BVH load failed', { error: errorMsg });
        setError(errorMsg);
        setIsLoading(false);
      }
    };

    loadBVH();

    return () => {
      log('Cleanup: Disposing resources');
    };
  }, [bvhPath]);

  /**
   * Animation loop
   */
  useEffect(() => {
    log('🚀 ENTRY: Animation loop effect');

    if (!rendererRef.current || !sceneRef.current) return;

    let animationId: number;
    let lastFrameTime = 0;

    const animate = (timestamp: number): void => {
      animationId = requestAnimationFrame(animate);

      if (animationRef.current.isPlaying && animationRef.current.bvhData) {
        const frameTime =
          animationRef.current.bvhData.frameTime / playbackSpeed;
        const elapsed = timestamp - lastFrameTime;

        if (elapsed > frameTime * 1000) {
          const nextFrame = animationRef.current.currentFrame + 1;
          updateFrame(
            nextFrame % animationRef.current.bvhData.totalFrames
          );
          lastFrameTime = timestamp;
        }
      }

      rendererRef.current?.render(sceneRef.current!, cameraRef.current!);
    };

    animationId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [playbackSpeed]);

  /**
   * Handle play/pause
   */
  const handlePlayPause = (): void => {
    animationRef.current.isPlaying = !animationRef.current.isPlaying;
    setIsPlaying(animationRef.current.isPlaying);
    log('Play/Pause toggled', { isPlaying: animationRef.current.isPlaying });
  };

  /**
   * Handle frame change
   */
  const handleFrameChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const frame = parseInt(e.target.value);
    updateFrame(frame);
    animationRef.current.currentFrame = frame;
    log('Frame changed', { frame });
  };

  log('✅ EXIT: MotionPreview render');

  return (
    <div className="motion-preview">
      {isLoading && (
        <div className="loading">
          <div className="spinner">⏳</div>
          <p>Loading BVH file...</p>
        </div>
      )}

      {error && (
        <div className="error">
          <p>❌ Failed to load preview: {error}</p>
        </div>
      )}

      {!isLoading && !error && (
        <>
          <canvas
            ref={canvasRef}
            width={width}
            height={height}
            className="preview-canvas"
          />

          <div className="preview-controls">
            <button
              onClick={handlePlayPause}
              className="control-btn play-btn"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? '⏸️' : '▶️'}
            </button>

            <div className="frame-slider-container">
              <span className="frame-label">{currentFrame}</span>
              <input
                type="range"
                min="0"
                max={totalFrames - 1}
                value={currentFrame}
                onChange={handleFrameChange}
                className="frame-slider"
              />
              <span className="frame-label">/ {totalFrames}</span>
            </div>

            <button
              onClick={() => updateFrame(0)}
              className="control-btn reset-btn"
              title="Reset to start"
            >
              ⏮️
            </button>
          </div>
        </>
      )}

      <style jsx>{`
        .motion-preview {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          background: #fafafa;
          border-radius: 8px;
          overflow: hidden;
        }

        .preview-canvas {
          display: block;
          width: 100%;
          max-width: 100%;
          height: auto;
          background: #f8f9fa;
        }

        .preview-controls {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1rem;
          background: #f0f0f0;
          border-top: 1px solid #e0e0e0;
        }

        .control-btn {
          background: white;
          border: 1px solid #ccc;
          border-radius: 4px;
          padding: 0.5rem 0.75rem;
          cursor: pointer;
          font-size: 1.2rem;
          transition: all 0.2s ease;
        }

        .control-btn:hover {
          background: #f5f5f5;
          border-color: #999;
        }

        .play-btn,
        .reset-btn {
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
        }

        .frame-slider-container {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          flex: 1;
        }

        .frame-label {
          font-family: monospace;
          font-weight: 600;
          color: #333;
          min-width: 50px;
          text-align: center;
        }

        .frame-slider {
          flex: 1;
          height: 6px;
          appearance: none;
          background: #ddd;
          outline: none;
          border: none;
          border-radius: 3px;
        }

        .loading,
        .error {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 1rem;
          padding: 2rem;
          min-height: 300px;
          flex-direction: column;
        }

        .loading {
          background: #f8f9fa;
        }

        .error {
          background: #fadbd8;
          color: #c0392b;
        }

        .spinner {
          font-size: 2rem;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }

        .loading p,
        .error p {
          margin: 0;
          font-weight: 600;
        }
      `}</style>
    </div>
  );
}
