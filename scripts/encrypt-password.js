#!/usr/bin/env node
/**
 * Simple password encryption helper for local testing
 * Usage:
 *   ENCRYPTION_KEY=<base64-32-bytes> node scripts/encrypt-password.js --password=UserP@ssw0rd!
 * Output: base64(iv):base64(ciphertext)
 */
const crypto = require('crypto');
const args = process.argv.slice(2);

function parseArgs() {
  const opts = {};
  args.forEach((arg) => {
    const [k, v] = arg.split('=');
    if (k && v) {
      opts[k.replace(/^--/, '')] = v;
    }
  });
  return opts;
}

(async function main() {
  try {
    const opts = parseArgs();
    const password = opts.password;
    if (!password) throw new Error('Provide --password=PASSWORD');

    // Get key from env or opts
    // Key must be 32 bytes (base64 encoded or raw)
    let keyBase64 = process.env.ENCRYPTION_KEY || opts.key;
    if (!keyBase64)
      throw new Error('ENCRYPTION_KEY must be set in env or --key= provided');

    let keyBuf;
    try {
      keyBuf = Buffer.from(keyBase64, 'base64');
    } catch (e) {
      // If not base64, use raw string
      keyBuf = Buffer.from(keyBase64);
    }
    if (keyBuf.length !== 32) {
      throw new Error(
        'ENCRYPTION_KEY must be a 32 byte key encoded as base64 or raw'
      );
    }

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', keyBuf, iv);
    const encrypted = Buffer.concat([
      cipher.update(password, 'utf8'),
      cipher.final(),
    ]);

    const out = `${iv.toString('base64')}:${encrypted.toString('base64')}`;
    console.log(out);
    process.exit(0);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
})();
