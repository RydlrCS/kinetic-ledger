import { pipeline } from 'stream/promises';
import { createReadStream } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import split2 from 'split2';
import pino from 'pino';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const logger = pino({
  level: process.env.VERBOSE === 'true' ? 'trace' : 'info',
});

interface MotionEvent {
  wallet: string;
  timestamp: number;
  motionType: string;
  rawData: object;
  dataHash: string;
  deviceId: string;
  sessionId: string;
  styleId?: number;
}

interface StyleConfig {
  id: number;
  name: string;
  batchSize: number;
  aggregationWindow: number; // milliseconds
  minConfidence: number;
  processingMode: 'fast' | 'balanced' | 'accurate';
  enableGPS: boolean;
  enableMultiSensor: boolean;
}

// Generate 100 different style configurations
function generateStyleConfigs(): StyleConfig[] {
  const styles: StyleConfig[] = [];
  const processingModes: Array<'fast' | 'balanced' | 'accurate'> = ['fast', 'balanced', 'accurate'];
  
  for (let i = 1; i <= 100; i++) {
    styles.push({
      id: i,
      name: `style-${String(i).padStart(3, '0')}`,
      // Vary parameters across ranges
      batchSize: 50 + (i % 10) * 10, // 50-140 in steps of 10
      aggregationWindow: 100 + (i % 20) * 50, // 100-1050ms
      minConfidence: 0.5 + (i % 50) * 0.01, // 0.5-0.99
      processingMode: processingModes[i % 3],
      enableGPS: i % 2 === 0,
      enableMultiSensor: i % 3 !== 0,
    });
  }
  
  return styles;
}

async function processBatchWithStyle(
  batch: MotionEvent[],
  style: StyleConfig
): Promise<number> {
  const startTime = Date.now();
  
  logger.debug({
    styleId: style.id,
    styleName: style.name,
    batchSize: batch.length,
    mode: style.processingMode,
    action: 'batch_start',
  }, `Processing batch with ${style.name}`);

  // Simulate RkCNN novelty detection
  const filteredEvents = batch.filter(event => {
    // Simulate confidence scoring based on style config
    const baseConfidence = Math.random();
    const gpsBoost = style.enableGPS ? 0.1 : 0;
    const multiSensorBoost = style.enableMultiSensor ? 0.15 : 0;
    const totalConfidence = baseConfidence + gpsBoost + multiSensorBoost;
    
    return totalConfidence >= style.minConfidence;
  });

  // Simulate blockchain transaction delay based on processing mode
  const delays = { fast: 50, balanced: 100, accurate: 200 };
  await new Promise(resolve => setTimeout(resolve, delays[style.processingMode]));
  
  const processingTime = Date.now() - startTime;
  
  logger.info({
    styleId: style.id,
    styleName: style.name,
    originalCount: batch.length,
    filteredCount: filteredEvents.length,
    filterRate: ((filteredEvents.length / batch.length) * 100).toFixed(1) + '%',
    processingTime: processingTime + 'ms',
    action: 'batch_complete',
  }, `Batch processed: ${filteredEvents.length}/${batch.length} events passed`);

  return filteredEvents.length;
}

async function runPipelineTest() {
  const styles = generateStyleConfigs();
  const sampleDataPath = resolve(__dirname, 'samples/demo-motion-events.jsonl');
  
  logger.info({
    totalStyles: styles.length,
    sampleDataPath,
    action: 'test_start',
  }, '🚀 Starting 100-style pipeline test');

  const styleResults: Array<{
    styleId: number;
    name: string;
    eventsProcessed: number;
    eventsSubmitted: number;
    batches: number;
    avgBatchTime: number;
  }> = [];

  for (const style of styles) {
    const batchTimes: number[] = [];
    let batch: MotionEvent[] = [];
    let styleEventsProcessed = 0;
    let styleEventsSubmitted = 0;
    let batchCount = 0;

    try {
      const styleStartTime = Date.now();
      
      await pipeline(
        createReadStream(sampleDataPath),
        split2(JSON.parse),
        async function* (source) {
          for await (const event of source) {
            const motionEvent: MotionEvent = {
              ...event,
              styleId: style.id,
            };
            batch.push(motionEvent);
            styleEventsProcessed++;

            if (batch.length >= style.batchSize) {
              yield batch;
              batch = [];
            }
          }
          // Yield remaining events
          if (batch.length > 0) {
            yield batch;
          }
        },
        async function (batches) {
          for await (const currentBatch of batches) {
            const batchStart = Date.now();
            const submitted = await processBatchWithStyle(currentBatch, style);
            const batchTime = Date.now() - batchStart;
            
            batchTimes.push(batchTime);
            styleEventsSubmitted += submitted;
            batchCount++;
            
            // Respect aggregation window
            if (style.aggregationWindow > 0) {
              await new Promise(resolve => 
                setTimeout(resolve, style.aggregationWindow)
              );
            }
          }
        }
      );

      const styleTime = Date.now() - styleStartTime;
      const avgBatchTime = batchTimes.length > 0 
        ? Math.round(batchTimes.reduce((a, b) => a + b, 0) / batchTimes.length)
        : 0;

      styleResults.push({
        styleId: style.id,
        name: style.name,
        eventsProcessed: styleEventsProcessed,
        eventsSubmitted: styleEventsSubmitted,
        batches: batchCount,
        avgBatchTime,
      });

      logger.info({
        styleId: style.id,
        eventsProcessed: styleEventsProcessed,
        eventsSubmitted: styleEventsSubmitted,
        batches: batchCount,
        avgBatchTime: avgBatchTime + 'ms',
        totalTime: styleTime + 'ms',
        progress: `${styleResults.length}/${styles.length}`,
        action: 'style_complete',
      }, `✅ Style ${style.id} complete`);

    } catch (error) {
      logger.error({
        styleId: style.id,
        error: error instanceof Error ? error.message : String(error),
        action: 'style_failed',
      }, `❌ Failed to process style ${style.id}`);
    }
  }

  // Final summary
  const totalEventsProcessed = styleResults.reduce((sum, r) => sum + r.eventsProcessed, 0);
  const totalEventsSubmitted = styleResults.reduce((sum, r) => sum + r.eventsSubmitted, 0);
  const totalBatches = styleResults.reduce((sum, r) => sum + r.batches, 0);
  const avgSubmissionRate = ((totalEventsSubmitted / totalEventsProcessed) * 100).toFixed(1);

  logger.info({
    totalStyles: styleResults.length,
    totalEventsProcessed,
    totalEventsSubmitted,
    totalBatches,
    avgSubmissionRate: avgSubmissionRate + '%',
    action: 'test_complete',
  }, '🎉 100-style pipeline test completed');

  console.log('\n📊 Summary Statistics:');
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Total Styles Tested:       ${styleResults.length}`);
  console.log(`Total Events Processed:    ${totalEventsProcessed.toLocaleString()}`);
  console.log(`Total Events Submitted:    ${totalEventsSubmitted.toLocaleString()}`);
  console.log(`Total Batches:             ${totalBatches}`);
  console.log(`Avg Submission Rate:       ${avgSubmissionRate}%`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  // Show top 5 most efficient styles
  const topStyles = [...styleResults]
    .sort((a, b) => b.eventsSubmitted - a.eventsSubmitted)
    .slice(0, 5);

  console.log('🏆 Top 5 Most Efficient Styles:');
  topStyles.forEach((style, idx) => {
    console.log(`  ${idx + 1}. ${style.name}: ${style.eventsSubmitted} events submitted (${style.batches} batches)`);
  });
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  runPipelineTest()
    .then(() => {
      logger.info('✨ Test suite finished successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error({ error: error.message }, '💥 Test suite failed');
      process.exit(60);
    });
}

export { runPipelineTest, generateStyleConfigs };
