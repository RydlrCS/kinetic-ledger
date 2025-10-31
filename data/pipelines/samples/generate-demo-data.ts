import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomBytes, createHash } from 'crypto';
import { mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface MotionEvent {
  wallet: string;
  timestamp: number;
  motionType: string;
  rawData: {
    duration: number;
    distance: number;
    calories: number;
    heartRate: number;
    accelerometer: number[];
    gyroscope: number[];
    gps?: { lat: number; lon: number };
  };
  dataHash: string;
  deviceId: string;
  sessionId: string;
}

const MOTION_TYPES = ['walk', 'run', 'cycle', 'swim', 'yoga', 'gym', 'hike', 'dance'];
const DEVICE_BRANDS = ['AppleWatch', 'Fitbit', 'Garmin', 'WHOOP', 'Peloton', 'Phone'];

function generateMotionEvents(count: number): MotionEvent[] {
  const events: MotionEvent[] = [];
  const wallets = Array.from({ length: 20 }, () => `0x${randomBytes(20).toString('hex')}`);
  
  for (let i = 0; i < count; i++) {
    const rawData = {
      duration: Math.floor(Math.random() * 3600) + 300, // 5-65 minutes
      distance: Math.random() * 10000, // 0-10km
      calories: Math.floor(Math.random() * 500) + 50, // 50-550 cal
      heartRate: 60 + Math.floor(Math.random() * 140), // 60-200 bpm
      accelerometer: [
        Math.random() * 2 - 1,
        Math.random() * 2 - 1,
        Math.random() * 2 - 1,
      ],
      gyroscope: [
        Math.random() * 360,
        Math.random() * 360,
        Math.random() * 360,
      ],
      ...(Math.random() > 0.3 && {
        gps: {
          lat: -1.286389 + Math.random() * 0.1, // Kenya coords
          lon: 36.817223 + Math.random() * 0.1,
        },
      }),
    };

    const dataHash = createHash('sha256')
      .update(JSON.stringify(rawData))
      .digest('hex');

    events.push({
      wallet: wallets[Math.floor(Math.random() * wallets.length)],
      timestamp: Date.now() - Math.floor(Math.random() * 86400000 * 7), // Last 7 days
      motionType: MOTION_TYPES[Math.floor(Math.random() * MOTION_TYPES.length)],
      rawData,
      dataHash: `0x${dataHash}`,
      deviceId: `${DEVICE_BRANDS[Math.floor(Math.random() * DEVICE_BRANDS.length)]}-${randomBytes(4).toString('hex')}`,
      sessionId: randomBytes(16).toString('hex'),
    });
  }

  return events;
}

// Generate 10,000 sample events
console.log('🏃 Generating 10,000 motion events...');
const events = generateMotionEvents(10000);

// Ensure samples directory exists
const samplesDir = __dirname;
mkdirSync(samplesDir, { recursive: true });

const outputPath = resolve(samplesDir, 'demo-motion-events.jsonl');

// Write one event per line (JSONL format for streaming)
const ndjson = events.map(e => JSON.stringify(e)).join('\n');
writeFileSync(outputPath, ndjson);

console.log(`✅ Generated ${events.length} events`);
console.log(`📁 Saved to: ${outputPath}`);
console.log(`📊 File size: ${(ndjson.length / 1024 / 1024).toFixed(2)} MB`);
console.log('');
console.log('Sample event:');
console.log(JSON.stringify(events[0], null, 2));
