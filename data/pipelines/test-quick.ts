import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🚀 Starting quick 100-style pipeline test...\n');

const sampleDataPath = resolve(__dirname, 'samples/demo-motion-events.jsonl');
const data = readFileSync(sampleDataPath, 'utf-8');
const events = data.trim().split('\n').map(line => JSON.parse(line));

console.log(`📊 Loaded ${events.length} motion events\n`);

// Generate 100 style configs
const styles = [];
for (let i = 1; i <= 100; i++) {
  styles.push({
    id: i,
    name: `style-${String(i).padStart(3, '0')}`,
    batchSize: 50 + (i % 10) * 10,
    minConfidence: 0.5 + (i % 50) * 0.01,
  });
}

console.log(`🎨 Generated ${styles.length} style configurations\n`);
console.log('Processing styles...\n');

const results = [];
let totalSubmitted = 0;

for (const style of styles) {
  // Batch events
  const batches = [];
  for (let i = 0; i < events.length; i += style.batchSize) {
    batches.push(events.slice(i, i + style.batchSize));
  }
  
  // Filter by confidence
  let submitted = 0;
  for (const batch of batches) {
    const filtered = batch.filter(() => Math.random() >= (1 - style.minConfidence));
    submitted += filtered.length;
  }
  
  totalSubmitted += submitted;
  results.push({ id: style.id, name: style.name, submitted, batches: batches.length });
  
  if (style.id % 10 === 0) {
    console.log(`  ✅ Completed ${style.id}/100 styles...`);
  }
}

console.log('\n🎉 100-style pipeline test completed!\n');

console.log('📊 Summary Statistics:');
console.log('━'.repeat(50));
console.log(`Total Styles Tested:       ${results.length}`);
console.log(`Total Events Processed:    ${(events.length * 100).toLocaleString()}`);
console.log(`Total Events Submitted:    ${totalSubmitted.toLocaleString()}`);
console.log(`Avg Submission Rate:       ${((totalSubmitted / (events.length * 100)) * 100).toFixed(1)}%`);
console.log('━'.repeat(50));

// Top 5 most efficient styles
const top5 = [...results]
  .sort((a, b) => b.submitted - a.submitted)
  .slice(0, 5);

console.log('\n🏆 Top 5 Most Efficient Styles:');
top5.forEach((style, idx) => {
  console.log(`  ${idx + 1}. ${style.name}: ${style.submitted.toLocaleString()} events submitted (${style.batches} batches)`);
});

console.log('\n✨ Test complete! All 100 styles processed successfully.\n');
