#!/usr/bin/env node
// Bridges the harness-assigned PORT env var to Expo's --port flag
// (Expo CLI only reads RCT_METRO_PORT / --port, not the generic PORT var).
const { spawn } = require('child_process');
const path = require('path');

const port = process.env.PORT || '8081';
const projectRoot = path.resolve(__dirname, '..');
const child = spawn('npx', ['expo', 'start', '--web', '--port', port], {
  stdio: 'inherit',
  shell: true,
  cwd: projectRoot,
});

child.on('exit', (code) => process.exit(code ?? 0));
