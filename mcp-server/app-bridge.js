'use strict';

const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

function pingBridgeAndOpen({ proyekId = null, tab = 'hasil' } = {}) {
  return new Promise((resolve) => {
    const postData = JSON.stringify({ proyekId, tab });
    const req = http.request({
      hostname: '127.0.0.1',
      port: 48123,
      path: '/open-project',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 800
    }, (res) => {
      resolve(res.statusCode === 200);
    });

    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.write(postData);
    req.end();
  });
}

async function launchOrFocusApp({ proyekId = null, tab = 'hasil' } = {}) {
  // 1. Coba hubungi aplikasi yang sedang berjalan via local bridge
  const isAlreadyFocused = await pingBridgeAndOpen({ proyekId, tab });
  if (isAlreadyFocused) {
    return { success: true, mode: 'focused_running_app' };
  }

  // 2. Jika belum terbuka, jalankan proses Electron FreePLS secara detached
  try {
    const projectRoot = path.join(__dirname, '..');
    const args = ['.'];
    if (proyekId) args.push(`--open-project=${proyekId}`);
    if (tab) args.push(`--tab=${tab}`);

    const child = spawn('npx', ['electron', ...args], {
      cwd: projectRoot,
      detached: true,
      stdio: 'ignore',
      shell: process.platform === 'win32'
    });
    child.unref();
    return { success: true, mode: 'launched_new_instance' };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = {
  pingBridgeAndOpen,
  launchOrFocusApp
};

