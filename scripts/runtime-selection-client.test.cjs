const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  selectRuntimeModel,
} = require('./runtime-selection-client.cjs');

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() {
      return body == null
        ? ''
        : JSON.stringify(body);
    },
  };
}

test(
  'async selector ignores uncorrelated snapshots and waits for correlated ready',
  async (t) => {
    const originalFetch = global.fetch;

    t.after(() => {
      global.fetch = originalFetch;
    });

    const calls = [];

    const replies = [
      response(202, {
        operationId: 'operation-ready',
        modelId: 'musicgen-small',
        acceptedAt: '2026-09-26T22:30:00.000Z',
        state: 'accepted',
      }),

      /*
       * This simulates ownership reconciliation exposing a perfectly
       * healthy resident snapshot that does NOT belong to our accepted
       * selection operation. It must not complete the selector.
       */
      response(200, {
        operationId: null,
        providerId: 'musicgen',
        providerName: 'MusicGen',
        modelId: 'musicgen-small',
        modelName: 'MusicGen Small',
        state: 'ready',
        healthy: true,
        progress: 100,
        message: 'Recovered resident runtime.',
        error: null,
      }),

      response(200, {
        operationId: 'operation-ready',
        providerId: 'musicgen',
        providerName: 'MusicGen',
        modelId: 'musicgen-small',
        modelName: 'MusicGen Small',
        state: 'building',
        healthy: false,
        progress: 20,
        message: 'Building provider image.',
        error: null,
      }),

      response(200, {
        operationId: 'operation-ready',
        providerId: 'musicgen',
        providerName: 'MusicGen',
        modelId: 'musicgen-small',
        modelName: 'MusicGen Small',
        state: 'ready',
        healthy: true,
        progress: 100,
        message: 'MusicGen Small runtime is ready.',
        error: null,
      }),
    ];

    global.fetch = async (url, options = {}) => {
      calls.push({
        url: String(url),
        options,
      });

      const next = replies.shift();

      if (!next) {
        throw new Error(
          `Unexpected fetch: ${String(url)}`
        );
      }

      return next;
    };

    const result = await selectRuntimeModel({
      backendBase: 'http://harmonia.test',
      token: 'qualification-token',
      modelId: 'musicgen-small',
      expectedProviderId: 'musicgen',
      timeoutMs: 1000,
      pollMs: 0,
      log: () => {},
    });

    assert.equal(
      result.acceptance.operationId,
      'operation-ready'
    );

    assert.equal(
      result.status.operationId,
      'operation-ready'
    );

    assert.equal(
      result.status.modelId,
      'musicgen-small'
    );

    assert.equal(
      result.status.providerId,
      'musicgen'
    );

    assert.equal(
      result.status.state,
      'ready'
    );

    assert.equal(
      result.status.healthy,
      true
    );

    assert.equal(
      replies.length,
      0
    );

    assert.equal(
      calls.length,
      4
    );

    assert.equal(
      calls[0].url,
      'http://harmonia.test/api/music/runtime/select'
    );

    assert.equal(
      calls[0].options.method,
      'POST'
    );

    assert.equal(
      calls[0].options.headers.authorization,
      'Bearer qualification-token'
    );

    const submitted = JSON.parse(
      calls[0].options.body
    );

    assert.deepEqual(
      submitted,
      {
        modelId: 'musicgen-small',
      }
    );

    const statusCalls = calls.slice(1);

    assert.equal(
      statusCalls.length,
      3
    );

    for (const call of statusCalls) {
      assert.equal(
        call.url,
        'http://harmonia.test/api/music/runtime/status'
      );

      assert.equal(
        call.options.headers.authorization,
        'Bearer qualification-token'
      );
    }
  }
);

test(
  'async selector rejects immediately when the correlated operation reaches error',
  async (t) => {
    const originalFetch = global.fetch;

    t.after(() => {
      global.fetch = originalFetch;
    });

    const calls = [];

    const replies = [
      response(202, {
        operationId: 'operation-error',
        modelId: 'stable-audio-3-small-music',
        acceptedAt: '2026-09-26T22:31:00.000Z',
        state: 'accepted',
      }),

      response(200, {
        operationId: 'operation-error',
        providerId: 'stable-audio-3',
        providerName: 'Stable Audio 3',
        modelId: 'stable-audio-3-small-music',
        modelName: 'Stable Audio 3 Small-Music',
        state: 'error',
        healthy: false,
        progress: null,
        message:
          'Stable Audio 3 failed: qualification boom',
        error: 'qualification boom',
      }),
    ];

    global.fetch = async (url, options = {}) => {
      calls.push({
        url: String(url),
        options,
      });

      const next = replies.shift();

      if (!next) {
        throw new Error(
          `Unexpected fetch: ${String(url)}`
        );
      }

      return next;
    };

    await assert.rejects(
      () =>
        selectRuntimeModel({
          backendBase: 'http://harmonia.test',
          token: 'qualification-token',
          modelId:
            'stable-audio-3-small-music',
          expectedProviderId:
            'stable-audio-3',
          timeoutMs: 1000,
          pollMs: 0,
          log: () => {},
        }),
      /Runtime selection operation-error.*qualification boom/
    );

    assert.equal(
      calls.length,
      2
    );

    assert.equal(
      replies.length,
      0
    );
  }
);

test(
  'async selector rejects a non-202 selection response',
  async (t) => {
    const originalFetch = global.fetch;

    t.after(() => {
      global.fetch = originalFetch;
    });

    global.fetch = async () =>
      response(200, {
        operationId: 'wrong-http-contract',
        modelId: 'musicgen-small',
        state: 'accepted',
      });

    await assert.rejects(
      () =>
        selectRuntimeModel({
          backendBase: 'http://harmonia.test',
          token: 'qualification-token',
          modelId: 'musicgen-small',
          timeoutMs: 1000,
          pollMs: 0,
          log: () => {},
        }),
      /returned HTTP 200; expected 202/
    );
  }
);

test(
  'token provider is consulted for selection and polling',
  async (t) => {
    const originalFetch = global.fetch;

    t.after(() => {
      global.fetch = originalFetch;
    });

    const calls = [];

    const replies = [
      response(202, {
        operationId: 'renewable-operation',
        modelId: 'musicgen-small',
        state: 'accepted',
      }),

      response(200, {
        operationId: 'renewable-operation',
        providerId: 'musicgen',
        modelId: 'musicgen-small',
        state: 'ready',
        healthy: true,
        progress: 100,
      }),
    ];

    global.fetch = async (url, options = {}) => {
      calls.push({
        url: String(url),
        options,
      });

      return replies.shift();
    };

    const supplied = [
      'qualification-token-1',
      'qualification-token-2',
    ];

    await selectRuntimeModel({
      backendBase: 'http://harmonia.test',
      tokenProvider: async () =>
        supplied.shift(),
      modelId: 'musicgen-small',
      timeoutMs: 1000,
      pollMs: 0,
      log: () => {},
    });

    assert.equal(
      calls[0].options.headers.authorization,
      'Bearer qualification-token-1'
    );

    assert.equal(
      calls[1].options.headers.authorization,
      'Bearer qualification-token-2'
    );
  }
);
