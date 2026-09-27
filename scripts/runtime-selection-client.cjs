const {
  existsSync,
  readFileSync,
} = require('node:fs');
const path = require('node:path');
const { parseEnv } = require('node:util');

const root = path.resolve(__dirname, '..');
const defaultEnvPath = path.join(root, '.env');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestJson(
  url,
  options = {},
  timeoutMs = 30000
) {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(timeoutMs),
  });

  const text = await response.text();
  let body = null;

  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!response.ok) {
    throw new Error(
      `${options.method || 'GET'} ${url} -> HTTP ${response.status}: ${
        typeof body === 'string'
          ? body
          : JSON.stringify(body)
      }`
    );
  }

  return {
    response,
    body,
  };
}

function readQualificationEnv(
  envPath = defaultEnvPath
) {
  if (!existsSync(envPath)) {
    return {};
  }

  return parseEnv(
    readFileSync(envPath, 'utf8')
  );
}

async function authenticateQualificationUser({
  backendBase,
  envPath = defaultEnvPath,
  username,
  password,
  timeoutMs = 30000,
} = {}) {
  if (!backendBase) {
    throw new Error(
      'authenticateQualificationUser requires backendBase'
    );
  }

  const env = readQualificationEnv(envPath);

  const resolvedUsername =
    username ||
    process.env.E2E_TEST_USER_USERNAME ||
    env.E2E_TEST_USER_USERNAME ||
    'test-user';

  const resolvedPassword =
    password ||
    process.env.E2E_TEST_USER_PASSWORD ||
    env.E2E_TEST_USER_PASSWORD ||
    'password';

  const login = await requestJson(
    `${backendBase}/api/auth/login`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        emailOrUsername: resolvedUsername,
        password: resolvedPassword,
      }),
    },
    timeoutMs
  );

  const token = login.body?.accessToken;

  if (!token) {
    throw new Error(
      'Qualification login succeeded without an access token'
    );
  }

  return {
    token,
    user: login.body?.user || null,
    username:
      login.body?.user?.username ||
      resolvedUsername,
  };
}

async function resolveAccessToken(
  token,
  tokenProvider
) {
  if (
    typeof tokenProvider === 'function'
  ) {
    const provided =
      await tokenProvider();

    if (!provided) {
      throw new Error(
        'Qualification token provider returned no access token'
      );
    }

    return provided;
  }

  if (!token) {
    throw new Error(
      'Qualification access token is missing'
    );
  }

  return token;
}
async function selectRuntimeModel({
  backendBase,
  token,
  tokenProvider = null,
  modelId,
  expectedProviderId = null,
  timeoutMs = 20 * 60 * 1000,
  pollMs = 2000,
  log = console.log,
} = {}) {
  if (!backendBase) {
    throw new Error(
      'selectRuntimeModel requires backendBase'
    );
  }

  if (
    !token &&
    typeof tokenProvider !== 'function'
  ) {
    throw new Error(
      'selectRuntimeModel requires an access token or tokenProvider'
    );
  }

  if (!modelId) {
    throw new Error(
      'selectRuntimeModel requires modelId'
    );
  }

  const acceptedToken =
    await resolveAccessToken(
      token,
      tokenProvider
    );

  const accepted = await requestJson(
    `${backendBase}/api/music/runtime/select`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${acceptedToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        modelId,
      }),
    },
    30000
  );

  const acceptance = accepted.body;

  if (accepted.response.status !== 202) {
    throw new Error(
      `Runtime selection for ${modelId} returned HTTP ${
        accepted.response.status
      }; expected 202`
    );
  }

  if (acceptance?.state !== 'accepted') {
    throw new Error(
      `Runtime selection for ${modelId} was not accepted: ${
        JSON.stringify(acceptance)
      }`
    );
  }

  if (acceptance?.modelId !== modelId) {
    throw new Error(
      `Runtime selection acknowledged unexpected model: ${
        JSON.stringify(acceptance)
      }`
    );
  }

  if (
    typeof acceptance?.operationId !== 'string' ||
    !acceptance.operationId
  ) {
    throw new Error(
      `Runtime selection for ${modelId} returned no operationId`
    );
  }

  if (typeof log === 'function') {
    log(
      `Runtime selection accepted: model=${modelId} operation=${acceptance.operationId}`
    );
  }

  const deadline = Date.now() + timeoutMs;
  let lastFingerprint = null;

  while (Date.now() < deadline) {
    const statusToken =
      await resolveAccessToken(
        token,
        tokenProvider
      );

    const current = await requestJson(
      `${backendBase}/api/music/runtime/status`,
      {
        headers: {
          authorization: `Bearer ${statusToken}`,
        },
      },
      30000
    );

    const status = current.body || {};

    const fingerprint = JSON.stringify({
      operationId: status.operationId ?? null,
      providerId: status.providerId ?? null,
      modelId: status.modelId ?? null,
      state: status.state ?? null,
      healthy: status.healthy ?? null,
      progress: status.progress ?? null,
      error: status.error ?? null,
    });

    if (
      fingerprint !== lastFingerprint &&
      typeof log === 'function'
    ) {
      log(
        `Runtime status: operation=${
          status.operationId || 'none'
        } model=${
          status.modelId || 'none'
        } state=${
          status.state || 'unknown'
        } healthy=${
          status.healthy === true
        } progress=${
          status.progress ?? '?'
        }`
      );

      lastFingerprint = fingerprint;
    }

    /*
     * Status reconciliation can briefly publish an uncorrelated
     * recovered snapshot while the accepted selection continues.
     *
     * Only the lifecycle carrying our accepted operation ID is
     * authoritative for this selection.
     */
    if (
      status.operationId !==
      acceptance.operationId
    ) {
      await sleep(pollMs);
      continue;
    }

    if (status.state === 'error') {
      throw new Error(
        `Runtime selection ${acceptance.operationId} for ${modelId} failed: ${
          status.error ||
          status.message ||
          'unknown runtime error'
        }`
      );
    }

    if (status.state === 'ready') {
      if (status.modelId !== modelId) {
        throw new Error(
          `Runtime selection ${acceptance.operationId} reached ready for unexpected model ${
            status.modelId || 'none'
          }`
        );
      }

      if (
        expectedProviderId &&
        status.providerId !== expectedProviderId
      ) {
        throw new Error(
          `Runtime selection ${acceptance.operationId} reached unexpected provider ${
            status.providerId || 'none'
          }; expected ${expectedProviderId}`
        );
      }

      if (status.healthy !== true) {
        throw new Error(
          `Runtime selection ${acceptance.operationId} reached ready without healthy=true`
        );
      }

      return {
        acceptance,
        status,
      };
    }

    await sleep(pollMs);
  }

  throw new Error(
    `Runtime selection ${acceptance.operationId} for ${modelId} timed out after ${
      Math.round(timeoutMs / 1000)
    } seconds`
  );
}

module.exports = {
  authenticateQualificationUser,
  selectRuntimeModel,
};
