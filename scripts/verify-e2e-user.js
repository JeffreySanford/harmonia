#!/usr/bin/env node
/* Verify E2E Test User
 * Usage: node scripts/verify-e2e-user.js
 * Reads environment variables from .env and attempts a login to the backend.
 * Exits with code 0 on success (HTTP 200) and non-zero on failure.
 */
const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

(async () => {
  const backend = process.env.BACKEND_URL || 'http://localhost:3000';
  const email = process.env.E2E_TEST_USER_EMAIL;
  const password = process.env.E2E_TEST_USER_PASSWORD;
  const username = process.env.E2E_TEST_USER_USERNAME;
  if (!email || !password || !username) {
    console.error('E2E_TEST_USER_* are not set in .env; cannot verify user');
    process.exit(2);
  }
  try {
    // Try login with email first, then fallback to username for convenience
    let resp;
    try {
      resp = await axios.post(
        `${backend}/api/auth/login`,
        {
          emailOrUsername: email,
          password,
        },
        { timeout: 5000 }
      );
    } catch (e) {
      // If login with email failed, try username next
      if (e.response && e.response.status === 401) {
        console.log('Login with email failed; trying username as fallback...');
        resp = await axios.post(
          `${backend}/api/auth/login`,
          {
            emailOrUsername: username,
            password,
          },
          { timeout: 5000 }
        );
      } else {
        throw e; // rethrow other errors
      }
    }
    console.log('Login response status:', resp.status);
    if (resp.status === 200 || resp.status === 201) {
      console.log('✅ E2E test user credentials valid.');
      console.log('User:', username, email);
      process.exit(0);
    }
    console.error('Unexpected login status', resp.status);
    process.exit(3);
  } catch (e) {
    if (e.response) {
      console.error(
        'Login failed with status',
        e.response.status,
        e.response.data
      );
      process.exit(4);
    }
    console.error('Login error', e.message);
    process.exit(5);
  }
})();
