#!/usr/bin/env node

const {
  selectRuntimeModel,
} = require(
  './runtime-selection-client.cjs'
);

const {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} = require(
  'node:fs'
);

const path =
  require(
    'node:path'
  );

const {
  parseEnv,
} = require(
  'node:util'
);

const root =
  path.resolve(
    __dirname,
    '..'
  );

const envPath =
  path.join(
    root,
    '.env'
  );

const backendBase =
  process.env.HARMONIA_QUALIFY_BACKEND_BASE ||
  'http://localhost:3000';

const frontendBase =
  process.env.HARMONIA_QUALIFY_FRONTEND_BASE ||
  'http://localhost:4200';

const modelId =
  'acestep-v15-turbo-06b';

const expectedProviderId =
  'ace-step-1.5';

const expectedRuntimeModelId =
  'acestep-v15-turbo';

const expectedLmModelId =
  'acestep-5Hz-lm-0.6B';

const requestedDuration =
  300;

const bpm =
  118;

const seed =
  9272026;

const pollMs =
  3000;

const timeoutMs =
  45 *
  60 *
  1000;

const title =
  'Push It to Master';

const style =
  [
    'anthemic modern classic rock and roll',
    '118 BPM',
    'gritty overdriven electric rhythm guitars',
    'melodic blues-rock lead guitar',
    'warm overdriven bass',
    'punchy live acoustic drums',
    'subtle Hammond organ',
    'powerful expressive male rock vocal',
    'big gang-vocal choruses',
    'wide stereo arena-rock production',
    'dynamic arrangement that starts restrained and grows',
    'large melodic guitar solo around the final third',
    'organic live-band feel',
    'energetic but not metal',
    'strong memorable chorus',
    'extended final chorus and rock outro',
  ].join(
    ', '
  );

const lyrics = `[Intro]
Yeah...
One more build.
One more run.
One more green light.

[Verse 1]
Started with a branch and an empty line
Seventeen changes and a little more time
Mongo on the left, Redis on the wire
Docker starts humming, GPU catches fire

We taught every job how to know its name
How to come back standing when the server changed
Queue it up durable, write it down right
If the process disappears, we're alive next night

[Pre-Chorus]
No ghosts in the worker
No promises lost
Every state has a reason
Every failure has a cost

[Chorus]
Push it to master
Let the whole thing roll
From queued to processing
We gave the machine a soul

Push it to master
Green across the board
No job left behind us
No broken state ignored

We built it, we broke it
We proved it could last
Turn up the guitars
And push it to master

[Verse 2]
MusicGen was waiting with the engine cold
Three hundred million reasons for the story to unfold
Image took forever, but we let it run
Gigabytes of CUDA underneath the setting sun

Then the runtime hit ready and the real test came
One hundred twenty seconds underneath a job name
Processing in Mongo, runtime running hot
Provider client spinning, now cancel the shot

[Pre-Chorus]
Busy into stopping
Stopping into stopped
No resurrection
No completion after drop

[Chorus]
Push it to master
Let the whole thing roll
From queued to processing
We gave the machine a soul

Push it to master
Green across the board
No job left behind us
No broken state ignored

We built it, we broke it
We proved it could last
Turn up the guitars
And push it to master

[Verse 3]
The container went silent, but the system stayed clean
No false failed status hiding in between
Cancellation landed where cancellation belongs
No phantom WAV pretending it had finished the song

Bull queue untouched and the database knew
Cancelled means cancelled when the worker comes through
Startup recovery, artifacts too
Every contract written so tomorrow knows what to do

[Bridge]
There were nights when the build just kept going
Lines on the screen like a river overflowing
But every red light told us something we could use
Every timeout gave us one more thing to refuse

No shortcuts
No mystery state
No probably works
No leaving it to fate

If it's green, then prove it
If it's stopped, let it stay
If it's durable, restart it
And make it find its way

[Instrumental Break]
Let it run
Let it run

[Guitar Solo]
Long melodic blues-rock guitar solo
Sustained bends and wide vibrato
Build into faster pentatonic runs
Finish with harmonized twin-guitar lines

[Breakdown]
Queued!
Processing!
Busy!
Stopping!
Stopped!

No resurrection!

Queued!
Processing!
Busy!
Stopping!
Stopped!

That's how you know it's done!

[Final Chorus]
Push it to master
Let the whole thing roll
Mongo keeps the history
Redis keeps control

Push it to master
Green across the board
Seventeen commits behind us
Every contract restored

We built it, we broke it
We ran it through the blast
Real provider running
Real cancellation passed

Push it to master
Let the speakers roar
Harmonia keeps playing
Stronger than before

We tested every boundary
We made the future fast
Raise up the volume

And push it
Push it
Push it to master!

[Outro]
Busy
Stopping
Stopped

Green

Harmonia`;

function sleep(
  ms
) {
  return new Promise(
    (
      resolve
    ) =>
      setTimeout(
        resolve,
        ms
      )
  );
}

async function request(
  url,
  options = {},
  timeout =
    30000
) {
  const response =
    await fetch(
      url,
      {
        ...options,

        signal:
          AbortSignal.timeout(
            timeout
          ),
      }
    );

  const text =
    await response.text();

  let body =
    null;

  if (
    text
  ) {
    try {
      body =
        JSON.parse(
          text
        );
    } catch {
      body =
        text;
    }
  }

  if (
    !response.ok
  ) {
    throw new Error(
      `${options.method || 'GET'} ${url} -> HTTP ${response.status}: ${
        typeof body ===
        'string'
          ? body
          : JSON.stringify(
              body
            )
      }`
    );
  }

  return {
    response,
    body,
  };
}

function readWav(
  buffer
) {
  if (
    buffer.length <
      44 ||
    buffer.toString(
      'ascii',
      0,
      4
    ) !==
      'RIFF' ||
    buffer.toString(
      'ascii',
      8,
      12
    ) !==
      'WAVE'
  ) {
    throw new Error(
      'Generated ACE-Step artifact is not a RIFF/WAVE file.'
    );
  }

  let offset =
    12;

  let audioFormat =
    0;

  let channels =
    0;

  let sampleRate =
    0;

  let bitsPerSample =
    0;

  let byteRate =
    0;

  let dataBytes =
    0;

  while (
    offset +
      8 <=
    buffer.length
  ) {
    const id =
      buffer.toString(
        'ascii',
        offset,
        offset +
          4
      );

    const size =
      buffer.readUInt32LE(
        offset +
          4
      );

    const start =
      offset +
      8;

    if (
      start +
        size >
      buffer.length
    ) {
      throw new Error(
        'Generated WAV contains a truncated chunk.'
      );
    }

    if (
      id ===
        'fmt ' &&
      size >=
        16
    ) {
      audioFormat =
        buffer.readUInt16LE(
          start
        );

      channels =
        buffer.readUInt16LE(
          start +
            2
        );

      sampleRate =
        buffer.readUInt32LE(
          start +
            4
        );

      byteRate =
        buffer.readUInt32LE(
          start +
            8
        );

      bitsPerSample =
        buffer.readUInt16LE(
          start +
            14
        );
    }

    if (
      id ===
      'data'
    ) {
      dataBytes =
        size;
    }

    offset =
      start +
      size +
      (
        size %
        2
      );
  }

  if (
    !audioFormat ||
    !channels ||
    !sampleRate ||
    !bitsPerSample ||
    !byteRate ||
    !dataBytes
  ) {
    throw new Error(
      'Generated WAV is missing required audio metadata.'
    );
  }

  return {
    audioFormat,
    channels,
    sampleRate,
    bitsPerSample,

    durationSeconds:
      dataBytes /
      byteRate,

    bytes:
      buffer.length,
  };
}

async function main() {
  console.log(
    '============================================================'
  );

  console.log(
    ' HARMONIA SONG GENERATION'
  );

  console.log(
    ` TITLE: ${title}`
  );

  console.log(
    ' MODEL: ACE-Step 1.5 Turbo + 0.6B LM'
  );

  console.log(
    ` DURATION: ${requestedDuration}s`
  );

  console.log(
    '============================================================'
  );

  if (
    !existsSync(
      envPath
    )
  ) {
    throw new Error(
      '.env is missing.'
    );
  }

  const env =
    parseEnv(
      readFileSync(
        envPath,
        'utf8'
      )
    );

  const username =
    env.E2E_TEST_USER_USERNAME ||
    'test-user';

  const password =
    env.E2E_TEST_USER_PASSWORD ||
    'password';

  console.log('');
  console.log(
    '=== 1. CHECK HARMONIA ==='
  );

  await request(
    `${backendBase}/api/__health`
  );

  console.log(
    `backend=${backendBase}`
  );

  console.log('');
  console.log(
    '=== 2. AUTHENTICATE ==='
  );

  const login =
    await request(
      `${backendBase}/api/auth/login`,
      {
        method:
          'POST',

        headers: {
          'content-type':
            'application/json',
        },

        body:
          JSON.stringify({
            emailOrUsername:
              username,

            password,
          }),
      }
    );

  const token =
    login.body
      ?.accessToken;

  if (
    !token
  ) {
    throw new Error(
      'Login succeeded without an access token.'
    );
  }

  console.log(
    `authenticated_as=${
      login.body
        ?.user
        ?.username ||
      username
    }`
  );

  console.log('');
  console.log(
    '=== 3. SELECT ACE-STEP ==='
  );

  const {
    acceptance,
    status,
  } =
    await selectRuntimeModel({
      backendBase,

      token,

      modelId,

      expectedProviderId,

      timeoutMs:
        30 *
        60 *
        1000,

      pollMs,

      log:
        console.log,
    });

  console.log(
    `runtime_ready=true`
  );

  console.log(
    `operation_id=${acceptance.operationId}`
  );

  console.log(
    `runtime_model=${
      status.modelName ||
      modelId
    }`
  );

  console.log('');
  console.log(
    '=== 4. SUBMIT SONG ==='
  );

  console.log(
    `title=${title}`
  );

  console.log(
    `bpm=${bpm}`
  );

  console.log(
    `duration=${requestedDuration}`
  );

  console.log(
    `seed=${seed}`
  );

  console.log(
    `style=${style}`
  );

  const created =
    await request(
      `${backendBase}/api/jobs`,
      {
        method:
          'POST',

        headers: {
          authorization:
            `Bearer ${token}`,

          'content-type':
            'application/json',
        },

        body:
          JSON.stringify({
            jobType:
              'generate',

            modelId,

            parameters: {
              title,

              prompt:
                style,

              lyrics,

              duration:
                requestedDuration,

              genre:
                'Rock and Roll',

              mood:
                'Triumphant',

              bpm,

              instruments: [
                'electric guitar',
                'lead guitar',
                'bass guitar',
                'acoustic drums',
                'Hammond organ',
              ],

              vocalsStyle:
                'powerful expressive male rock vocal',

              vocalLanguage:
                'en',

              seed,
            },
          }),
      }
    );

  const jobId =
    created.body
      ?.id;

  if (
    !jobId
  ) {
    throw new Error(
      'Song job returned no id: ' +
      JSON.stringify(
        created.body
      )
    );
  }

  console.log(
    `job_id=${jobId}`
  );

  console.log('');
  console.log(
    '=== 5. GENERATE ==='
  );

  const started =
    Date.now();

  let job =
    created.body;

  let lastFingerprint =
    '';

  while (
    ![
      'completed',
      'failed',
      'cancelled',
    ].includes(
      job.status
    )
  ) {
    if (
      Date.now() -
        started >
      timeoutMs
    ) {
      throw new Error(
        `Song generation exceeded ${Math.round(
          timeoutMs /
            60000
        )} minutes.`
      );
    }

    await sleep(
      pollMs
    );

    const current =
      await request(
        `${backendBase}/api/jobs/${jobId}`,
        {
          headers: {
            authorization:
              `Bearer ${token}`,
          },
        }
      );

    job =
      current.body;

    const fingerprint =
      [
        job.status,
        job.progress
          ?.percentage,
        job.progress
          ?.message,
      ].join(
        '|'
      );

    if (
      fingerprint !==
      lastFingerprint
    ) {
      console.log(
        `status=${job.status} progress=${job.progress?.percentage ?? '?'}% message=${
          job.progress?.message ||
          ''
        }`
      );

      lastFingerprint =
        fingerprint;
    }
  }

  if (
    job.status !==
    'completed'
  ) {
    throw new Error(
      `Song generation ended as ${job.status}: ${
        job.result
          ?.error ||
        JSON.stringify(
          job.result
        )
      }`
    );
  }

  console.log('');
  console.log(
    '=== 6. VERIFY ACE RESULT ==='
  );

  const metadata =
    job.result
      ?.metadata ||
    {};

  const ace =
    metadata.aceStep ||
    {};

  if (
    metadata.providerId !==
    expectedProviderId
  ) {
    throw new Error(
      `Unexpected provider: ${metadata.providerId}`
    );
  }

  if (
    metadata.modelId !==
    modelId
  ) {
    throw new Error(
      `Unexpected model: ${metadata.modelId}`
    );
  }

  if (
    metadata.runtimeModelId !==
    expectedRuntimeModelId
  ) {
    throw new Error(
      `Unexpected ACE runtime model: ${metadata.runtimeModelId}`
    );
  }

  if (
    ace.ditModel !==
    expectedRuntimeModelId
  ) {
    throw new Error(
      `Unexpected ACE DiT model: ${ace.ditModel}`
    );
  }

  if (
    ace.lmModel !==
    expectedLmModelId
  ) {
    throw new Error(
      `Unexpected ACE LM model: ${ace.lmModel}`
    );
  }

  if (
    metadata.lyrics !==
    lyrics
  ) {
    throw new Error(
      'Durable job metadata did not preserve the requested lyrics.'
    );
  }

  if (
    ace.lyrics !==
    lyrics
  ) {
    throw new Error(
      'ACE-Step did not preserve the requested lyrics.'
    );
  }

  if (
    !ace.taskId
  ) {
    throw new Error(
      'ACE-Step returned no upstream task id.'
    );
  }

  const outputPath =
    job.result
      ?.outputPath;

  if (
    outputPath !==
    `/api/jobs/${jobId}/artifact`
  ) {
    throw new Error(
      `Unexpected artifact path: ${outputPath}`
    );
  }

  console.log(
    `ace_task_id=${ace.taskId}`
  );

  console.log(
    `ace_dit_model=${ace.ditModel}`
  );

  console.log(
    `ace_lm_model=${ace.lmModel}`
  );

  console.log(
    'lyrics_preserved=true'
  );

  console.log('');
  console.log(
    '=== 7. DOWNLOAD FINISHED SONG ==='
  );

  const artifactResponse =
    await fetch(
      `${backendBase}${outputPath}`,
      {
        headers: {
          authorization:
            `Bearer ${token}`,
        },

        signal:
          AbortSignal.timeout(
            120000
          ),
      }
    );

  if (
    !artifactResponse.ok
  ) {
    throw new Error(
      `Artifact download failed: HTTP ${artifactResponse.status}`
    );
  }

  const buffer =
    Buffer.from(
      await artifactResponse
        .arrayBuffer()
    );

  const wav =
    readWav(
      buffer
    );

  if (
    wav.durationSeconds <
    requestedDuration *
      0.9
  ) {
    throw new Error(
      `Generated song is only ${wav.durationSeconds.toFixed(
        2
      )} seconds; expected approximately ${requestedDuration}.`
    );
  }

  const showcaseDir =
    path.join(
      root,
      'exports',
      'showcase'
    );

  mkdirSync(
    showcaseDir,
    {
      recursive:
        true,
    }
  );

  const friendlyPath =
    path.join(
      showcaseDir,
      'push-it-to-master.wav'
    );

  writeFileSync(
    friendlyPath,
    buffer
  );

  const elapsedSeconds =
    (
      Date.now() -
      started
    ) /
    1000;

  console.log('');
  console.log(
    '============================================================'
  );

  console.log(
    ' PUSH IT TO MASTER - GENERATION COMPLETE'
  );

  console.log(
    '============================================================'
  );

  console.log(
    `title               = ${title}`
  );

  console.log(
    `model               = ${modelId}`
  );

  console.log(
    `provider            = ${expectedProviderId}`
  );

  console.log(
    `aceTaskId           = ${ace.taskId}`
  );

  console.log(
    `jobId               = ${jobId}`
  );

  console.log(
    `status              = ${job.status}`
  );

  console.log(
    `requestedDuration   = ${requestedDuration}s`
  );

  console.log(
    `actualDuration      = ${wav.durationSeconds.toFixed(2)}s`
  );

  console.log(
    `channels            = ${wav.channels}`
  );

  console.log(
    `sampleRate          = ${wav.sampleRate}`
  );

  console.log(
    `bitsPerSample       = ${wav.bitsPerSample}`
  );

  console.log(
    `audioFormat         = ${wav.audioFormat}`
  );

  console.log(
    `artifactBytes       = ${wav.bytes}`
  );

  console.log(
    `generationElapsed   = ${elapsedSeconds.toFixed(2)}s`
  );

  console.log(
    `durableArtifact     = ${outputPath}`
  );

  console.log(
    `showcaseCopy        = ${path.relative(
      root,
      friendlyPath
    )}`
  );

  console.log('');
  console.log(
    'PUSH_IT_TO_MASTER_GENERATION_OK'
  );
}

main()
  .catch(
    (
      error
    ) => {
      console.error('');

      console.error(
        'PUSH_IT_TO_MASTER_GENERATION_FAILED'
      );

      console.error(
        error instanceof Error
          ? error.stack ||
            error.message
          : String(
              error
            )
      );

      process.exitCode =
        1;
    }
  );
