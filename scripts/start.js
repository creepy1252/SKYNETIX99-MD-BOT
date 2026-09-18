#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawn } = require('node:child_process');

const projectRoot = path.resolve(__dirname, '..');
const entrypoint = process.argv[2] || 'index.js';
const entrypointPath = path.join(projectRoot, entrypoint);
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

if (!fs.existsSync(entrypointPath)) {
  console.error(`❌ Deployment entrypoint not found: ${entrypoint}`);
  process.exit(1);
}

function hasDependenciesInstalled() {
  try {
    require.resolve('chalk', { paths: [projectRoot] });
    require.resolve('@whiskeysockets/baileys', { paths: [projectRoot] });
    return true;
  } catch {
    return false;
  }
}

if (!hasDependenciesInstalled()) {
  console.log('📦 Dependencies are not installed. Installing from package-lock.json...');
  try {
    execFileSync(npmCommand, ['ci', '--omit=dev', '--no-audit', '--no-fund'], {
      cwd: projectRoot,
      stdio: 'inherit',
      env: process.env
    });
  } catch (error) {
    console.error('❌ Dependency installation failed. The bot was not started.');
    process.exit(typeof error.status === 'number' ? error.status : 1);
  }
}

console.log(`🚀 Starting ${entrypoint}...`);
const child = spawn(process.execPath, [entrypointPath], {
  cwd: projectRoot,
  env: process.env,
  stdio: 'inherit'
});

const forwardSignal = (signal) => {
  if (!child.killed) child.kill(signal);
};
process.once('SIGINT', () => forwardSignal('SIGINT'));
process.once('SIGTERM', () => forwardSignal('SIGTERM'));

child.once('error', (error) => {
  console.error('❌ Failed to start the bot process:', error.message);
  process.exit(1);
});

child.once('exit', (code, signal) => {
  if (signal) {
    console.error(`🛑 Bot process stopped by ${signal}.`);
    process.exit(1);
  }
  process.exit(typeof code === 'number' ? code : 1);
});
