const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root =
  path.resolve(
    __dirname,
    '..'
  );

const jobsPath =
  path.join(
    root,
    'apps',
    'backend',
    'src',
    'jobs',
    'jobs.service.ts'
  );

const jobs =
  fs.readFileSync(
    jobsPath,
    'utf8'
  );

function methodBlock(
  startNeedle,
  endNeedle
) {
  const start =
    jobs.indexOf(
      startNeedle
    );

  assert.ok(
    start >= 0,
    `${startNeedle} must exist`
  );

  const end =
    jobs.indexOf(
      endNeedle,
      start + startNeedle.length
    );

  assert.ok(
    end > start,
    `${endNeedle} must follow ${startNeedle}`
  );

  return jobs.slice(
    start,
    end
  );
}

test(
  'durable restart reconciliation remains the recovery foundation',
  () => {
    assert.match(
      jobs,
      /private async reconcileGenerationQueue\s*\(/
    );

    assert.match(
      jobs,
      /generationQueue\.getJob\s*\(/
    );

    assert.match(
      jobs,
      /generationQueue\.add\s*\(/
    );

    assert.match(
      jobs,
      /Recovered after backend restart; queued for durable replay/
    );
  }
);

test(
  'orphan reconciliation checks for a completed artifact before replay',
  () => {
    const reconcile =
      methodBlock(
        'private async reconcileGenerationQueue',
        'async findAll'
      );

    assert.match(
      reconcile,
      /recoverCompletedGenerationArtifact/
    );

    const artifactRecovery =
      reconcile.indexOf(
        'recoverCompletedGenerationArtifact'
      );

    const resetQueued =
      reconcile.indexOf(
        "job.status = 'queued'"
      );

    const bullAdd =
      reconcile.indexOf(
        'this.generationQueue.add'
      );

    assert.ok(
      artifactRecovery >= 0,
      'artifact recovery must be attempted'
    );

    assert.ok(
      resetQueued >= 0,
      'processing replay reset must remain available'
    );

    assert.ok(
      bullAdd >= 0,
      'Bull replay must remain available'
    );

    assert.ok(
      artifactRecovery < resetQueued,
      'artifact recovery must run before processing is reset to queued'
    );

    assert.ok(
      artifactRecovery < bullAdd,
      'artifact recovery must run before Bull replay'
    );

    assert.match(
      reconcile,
      /if\s*\(\s*await this\.recoverCompletedGenerationArtifact\s*\(/s
    );

    assert.match(
      reconcile,
      /continue\s*;/
    );
  }
);

test(
  'completed artifact recovery uses the canonical job WAV and normal validator',
  () => {
    const recovery =
      methodBlock(
        'private async recoverCompletedGenerationArtifact',
        'async findAll'
      );

    assert.match(
      recovery,
      /path\.join\(\s*process\.cwd\(\),\s*['"]exports['"],\s*['"]jobs['"],\s*jobId,\s*['"]music\.wav['"]\s*\)/s
    );

    assert.match(
      recovery,
      /requestedDurationSeconds/
    );

    assert.match(
      recovery,
      /await this\.validateWav\s*\(\s*hostPath,\s*requestedDurationSeconds\s*\)/s
    );

    assert.match(
      recovery,
      /catch\s*\{[\s\S]*return false\s*;/s
    );
  }
);

test(
  'valid recovered artifact is finalized instead of being regenerated',
  () => {
    const recovery =
      methodBlock(
        'private async recoverCompletedGenerationArtifact',
        'async findAll'
      );

    assert.match(
      recovery,
      /job\.status\s*=\s*['"]completed['"]/
    );

    assert.match(
      recovery,
      /job\.completedAt\s*=\s*new Date\s*\(\s*\)/
    );

    assert.match(
      recovery,
      /percentage:\s*100/
    );

    assert.match(
      recovery,
      /message:\s*['"]Completed['"]/
    );

    assert.match(
      recovery,
      /outputPath:\s*downloadUrl/
    );

    assert.match(
      recovery,
      /recoveredAfterRestart:\s*true/
    );

    assert.match(
      recovery,
      /actualDurationSeconds:\s*wav\.durationSeconds/
    );

    assert.match(
      recovery,
      /channels:\s*wav\.channels/
    );

    assert.match(
      recovery,
      /sampleRate:\s*wav\.sampleRate/
    );

    assert.match(
      recovery,
      /bitsPerSample:\s*wav\.bitsPerSample/
    );

    assert.match(
      recovery,
      /size:\s*wav\.size/
    );

    assert.match(
      recovery,
      /await job\.save\s*\(\s*\)/
    );

    assert.match(
      recovery,
      /emitJobCompleted/
    );

    assert.match(
      recovery,
      /return true\s*;/
    );
  }
);

test(
  'artifact recovery derives expected duration from the persisted generation request',
  () => {
    const recovery =
      methodBlock(
        'private async recoverCompletedGenerationArtifact',
        'async findAll'
      );

    assert.match(
      recovery,
      /job\.modelId/
    );

    assert.match(
      recovery,
      /MUSIC_MODELS\.find/
    );

    assert.match(
      recovery,
      /job\.parameters/
    );

    assert.match(
      recovery,
      /parameters\[['"]duration['"]\]/
    );

    assert.match(
      recovery,
      /parseDiffSingerScore/
    );
  }
);
