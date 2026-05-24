#!/usr/bin/env node

/**
 * Cross-platform Python runner for WorthIt
 * Detects OS, manages venv, and runs Python scripts.
 * 
 * Usage:
 *   node scripts/run-python.js scripts/download_data.py
 *   node scripts/run-python.js --setup   (create venv + install deps only)
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const isWin = process.platform === 'win32';
const venvDir = path.join(__dirname, '..', 'venv');
const pythonBin = isWin
  ? path.join(venvDir, 'Scripts', 'python.exe')
  : path.join(venvDir, 'bin', 'python');
const pipBin = isWin
  ? path.join(venvDir, 'Scripts', 'pip.exe')
  : path.join(venvDir, 'bin', 'pip');
const requirementsFile = path.join(__dirname, '..', 'requirements.txt');

function ensureVenv() {
  if (!fs.existsSync(pythonBin)) {
    console.log('📦 Creating Python virtual environment...');
    const pythonCmd = isWin ? 'python' : 'python3';
    try {
      execSync(`${pythonCmd} -m venv "${venvDir}"`, { stdio: 'inherit' });
      console.log('✅ Virtual environment created.');
    } catch (err) {
      console.error('❌ Failed to create venv. Make sure Python 3 is installed and accessible via `' + pythonCmd + '`.');
      process.exit(1);
    }
  }
}

function ensureDeps() {
  if (fs.existsSync(requirementsFile)) {
    console.log('📥 Checking Python dependencies...');
    try {
      execSync(`"${pipBin}" install -q -r "${requirementsFile}"`, { stdio: 'inherit' });
    } catch (err) {
      console.error('❌ Failed to install Python dependencies.');
      process.exit(1);
    }
  }
}

// Main
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error('Usage: node scripts/run-python.js <script.py>');
  console.error('       node scripts/run-python.js --setup');
  process.exit(1);
}

// Always ensure venv and deps exist
ensureVenv();
ensureDeps();

if (args[0] === '--setup') {
  console.log('✅ Setup complete. Virtual environment ready.');
  process.exit(0);
}

// Run the specified Python script
const scriptPath = path.resolve(args[0]);
if (!fs.existsSync(scriptPath)) {
  console.error(`❌ Script not found: ${scriptPath}`);
  process.exit(1);
}

const child = spawn(pythonBin, [scriptPath, ...args.slice(1)], {
  stdio: 'inherit',
  env: { ...process.env }
});

child.on('exit', (code) => {
  process.exit(code || 0);
});