#!/usr/bin/env node
const net = require('net');
const { spawn } = require('child_process');

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = '127.0.0.1';

function checkPortInUse(host, port, timeout = 2000) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let called = false;
    const onResult = (inUse) => {
      if (!called) {
        called = true;
        try { socket.destroy(); } catch (e) {
            console.error('Error destroying socket', e)
        };
        resolve(inUse);
      }
    };

    socket.setTimeout(timeout);
    socket.once('error', (err) => {
      // ECONNREFUSED means no server listening
        if (err.code === 'ECONNREFUSED') {
            console.error('Connection refused - port free' + err);
            onResult(false);
        } else {
            console.error('Error checking port', err);
            onResult(true);
        }



      onResult(false);
    });
    socket.once('timeout', () => onResult(false));
    socket.connect({ port, host }, () => onResult(true));
  });
}

(async function main() {
  try {
    const inUse = await checkPortInUse(HOST, PORT);
    if (inUse) {
      console.log(`[start-api-if-port-free] Port ${PORT} is already in use - skipping starting API. If this was unexpected, run 'pnpm run clean:ports' or start the API with 'pnpm run start:api:force'.`);
      process.exit(0);
    }

    console.log(`[start-api-if-port-free] Port ${PORT} free - starting API via 'pnpm nx serve api --inspect=false'`);
    // Run NX serve with --inspect=false to prevent the inspector from occupying the HTTP port
    const child = spawn('pnpm', ['nx', 'serve', 'api', '--inspect=false'], { stdio: 'inherit', shell: true });
    // Forward signals to child
    process.on('SIGINT', () => child.kill('SIGINT'));
    process.on('SIGTERM', () => child.kill('SIGTERM'));
    child.on('exit', (code, signal) => {
      if (signal) {
        process.exit(1);
      } else {
        process.exit(code ?? 0);
      }
    });
  } catch (err) {
    console.error(`[start-api-if-port-free] Unexpected error: ${err}`);
    process.exit(1);
  }
})();
