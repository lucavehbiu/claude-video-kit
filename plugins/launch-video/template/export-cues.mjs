// Hand the film's timeline to the score so both read the same cue times.
import { writeFileSync, mkdirSync } from 'node:fs';
import { T, BPM, DURATION } from './src/timeline.js';
mkdirSync('dist', { recursive: true });
writeFileSync('dist/cues.json', JSON.stringify({ BPM, DURATION, ...T }, null, 1));
console.log('wrote dist/cues.json');
