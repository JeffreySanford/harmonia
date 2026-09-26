import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { execFile, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { promisify } from 'node:util';
import {
  MUSIC_MODELS,
  MUSIC_PROVIDERS,
} from './music-model.catalog';
import { MusicRuntimeGateway } from './music-runtime.gateway';
import { ModelInstallationRuntimeService } from './model-installation-runtime.service';
import {
  HardwareFit,
  HardwareProfile,
  ModelInstallationCatalogInfo,
  MusicModelCatalogEntry,
  MusicModelDefinition,
  MusicProviderDefinition,
  MusicRuntimeCatalogResponse,
  MusicRuntimeSelectionAccepted,
  MusicRuntimeState,
  MusicRuntimeStatus,
} from './music-runtime.types';

const execFileAsync = promisify(execFile);

@Injectable()
export class MusicRuntimeService {
  private readonly logger = new Logger(MusicRuntimeService.name);
  private hardwareCache: HardwareProfile | null = null;
  private hardwareCacheAt = 0;
  private readonly validatedProviderImages = new Set<string>();
  private selectionOperationId: string | null = null;

  private status: MusicRuntimeStatus = {
    providerId: null,
    providerName: null,
    modelId: null,
    modelName: null,
    state: 'stopped',
    message: 'No music provider runtime selected.',
    healthy: false,
    progress: null,
    hardware: {
      gpuAvailable: false,
      gpuName: null,
      vramTotalGb: null,
    },
    updatedAt: new Date().toISOString(),
    error: null,
  };

  constructor(
    private readonly gateway: MusicRuntimeGateway,
    private readonly modelInstallations: ModelInstallationRuntimeService
  ) {}

  async getCatalog(): Promise<MusicRuntimeCatalogResponse> {
    await this.reconcileRuntimeOwnership();
    const hardware = await this.detectHardware();
    this.status = { ...this.status, hardware };

    const managedModelIds = MUSIC_MODELS
      .filter((model) => model.availability === 'installed')
      .map((model) => model.id);

    const installationInfo =
      await this.modelInstallations.getCatalogInstallationInfo(
        managedModelIds
      );

    return {
      hardware,
      providers: MUSIC_PROVIDERS,
      models: MUSIC_MODELS.map((model) =>
        this.toCatalogEntry(
          model,
          hardware,
          model.availability === 'installed'
            ? installationInfo[model.id]
            : {
                installationState: 'not-managed',
                installationArtifactCount: 0,
                installationVerifiedCount: 0,
                installationLastVerifiedAt: null,
              }
        )
      ),
      status: this.status,
    };
  }

  async getStatus(): Promise<MusicRuntimeStatus> {
    await this.reconcileRuntimeOwnership();
    const hardware = await this.detectHardware();
    this.status = { ...this.status, hardware };
    return this.status;
  }

  async beginGeneration(providerId: string): Promise<{
    modelId: string;
    modelName: string;
    runtimeModelId: string;
  }> {
    await this.reconcileRuntimeOwnership();
    const hardware = await this.detectHardware();

    if (this.status.providerId !== providerId || this.status.state !== 'ready') {
      throw new BadRequestException(
        `${providerId} runtime must be ready before generation.`
      );
    }

    const provider = this.getProvider(providerId);
    const model = this.status.modelId
      ? MUSIC_MODELS.find((candidate) => candidate.id === this.status.modelId)
      : null;

    if (!model || !model.runtimeModelId) {
      throw new BadRequestException(
        `${provider.name} has no selected provider-native model id.`
      );
    }

    await this.transition(
      provider,
      model,
      hardware,
      'busy',
      `Generating with ${model.name}…`,
      100,
      true
    );

    return {
      modelId: model.id,
      modelName: model.name,
      runtimeModelId: model.runtimeModelId,
    };
  }

  async finishGeneration(providerId: string): Promise<MusicRuntimeStatus> {
    const hardware = await this.detectHardware();

    if (this.status.providerId !== providerId) {
      return this.status;
    }

    const provider = this.getProvider(providerId);
    const model = this.status.modelId
      ? MUSIC_MODELS.find((candidate) => candidate.id === this.status.modelId) ||
        null
      : null;

    return this.transition(
      provider,
      model,
      hardware,
      'ready',
      model
        ? `${model.name} runtime is ready. Model remains resident until provider stop or model switch.`
        : `${provider.name} runtime is ready.`,
      100,
      true
    );
  }

  requestModelSelection(
    modelId: string
  ): MusicRuntimeSelectionAccepted {
    const model = MUSIC_MODELS.find(
      (candidate) => candidate.id === modelId
    );

    if (!model) {
      throw new BadRequestException(
        `Unknown music model: ${modelId}`
      );
    }

    if (this.status.state === 'busy') {
      throw new BadRequestException(
        'Cannot switch music models while generation is in progress.'
      );
    }

    if (this.selectionOperationId) {
      throw new BadRequestException(
        'A music runtime selection is already in progress.'
      );
    }

    const operationId = randomUUID();

    const acceptance: MusicRuntimeSelectionAccepted = {
      operationId,
      modelId,
      acceptedAt: new Date().toISOString(),
      state: 'accepted',
    };

    this.selectionOperationId = operationId;

    setImmediate(() => {
      void this.selectModel(modelId)
        .catch(async (error) => {
          const message =
            error instanceof Error
              ? error.message
              : 'Unknown runtime selection error';

          this.logger.error(
            `Async music runtime selection ${operationId} for ${modelId} failed: ${message}`
          );

          if (this.status.state === 'error') {
            return;
          }

          try {
            const provider = this.getProvider(model.providerId);
            const hardware = await this.detectHardware();

            await this.transition(
              provider,
              model,
              hardware,
              'error',
              `${provider.name} failed: ${message}`,
              null,
              false,
              message
            );
          } catch (transitionError) {
            this.logger.error(
              `Could not publish async runtime failure for ${operationId}: ${
                transitionError instanceof Error
                  ? transitionError.message
                  : String(transitionError)
              }`
            );
          }
        })
        .finally(() => {
          if (this.selectionOperationId === operationId) {
            this.selectionOperationId = null;
          }
        });
    });

    return acceptance;
  }

  async selectModel(modelId: string): Promise<MusicRuntimeStatus> {
    await this.reconcileRuntimeOwnership();
    const hardware = await this.detectHardware();
    const model = MUSIC_MODELS.find((candidate) => candidate.id === modelId);
    if (!model) {
      throw new BadRequestException(`Unknown music model: ${modelId}`);
    }

    const provider = this.getProvider(model.providerId);
    const entry = this.toCatalogEntry(model, hardware);

    if (this.status.state === 'busy') {
      throw new BadRequestException(
        'Cannot switch music models while generation is in progress.'
      );
    }

    if (!entry.selectable) {
      throw new BadRequestException(
        entry.disabledReason || `${model.name} is not selectable.`
      );
    }

    if (
      this.status.providerId === provider.id &&
      this.status.modelId === model.id &&
      this.status.state === 'ready'
    ) {
      await this.modelInstallations.markModelUsed(model.id);
      this.gateway.emitRuntimeStatus(this.status);
      return this.status;
    }

    await this.modelInstallations.assertModelReady(model.id);

    if (
      this.status.providerId &&
      this.status.providerId !== provider.id &&
      this.status.state !== 'stopped'
    ) {
      await this.stopCurrentRuntime();
    }

    try {
      await this.ensureProviderImage(provider, model, hardware);
      await this.transition(
        provider,
        model,
        hardware,
        'starting',
        `Starting ${provider.name} runtime…`,
        35
      );

      await this.compose(provider, ['up', '--detach', '--no-build', provider.dockerService!]);

      await this.transition(
        provider,
        model,
        hardware,
        'health-checking',
        `Checking ${provider.name} runtime health…`,
        65
      );

      await this.waitForHealthy(provider, 240_000);

      await this.transition(
        provider,
        model,
        hardware,
        'healthy',
        `${provider.name} container is healthy.`,
        90,
        true
      );

      if (provider.id === 'ace-step-1.5') {
        await this.transition(
          provider,
          model,
          hardware,
          'loading-model',
          `Loading ${model.name} and the 0.6B LM…`,
          95,
          true
        );

        await this.prepareProviderModel(
          provider,
          model
        );
      }

      // Give the client enough time to visibly acknowledge the successful
      // health/model-load milestone before the terminal ready notification replaces it.
      await new Promise((resolve) => setTimeout(resolve, 800));

      await this.transition(
        provider,
        model,
        hardware,
        'ready',
        provider.id === 'ace-step-1.5'
          ? `${model.name} runtime is ready. Turbo and the 0.6B LM are resident.`
          : `${model.name} runtime is ready. Model weights load on first inference.`,
        100,
        true
      );

      await this.modelInstallations.markModelUsed(model.id);

      return this.status;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown runtime error';
      await this.transition(
        provider,
        model,
        hardware,
        'error',
        `${provider.name} failed: ${message}`,
        null,
        false,
        message
      );
      throw error;
    }
  }

  async stopCurrentRuntime(): Promise<MusicRuntimeStatus> {
    const hardware = await this.detectHardware();
    if (!this.status.providerId) {
      return this.status;
    }

    const provider = this.getProvider(this.status.providerId);
    const model = this.status.modelId
      ? MUSIC_MODELS.find((candidate) => candidate.id === this.status.modelId) ||
        null
      : null;

    if (!provider.dockerService || !provider.composeProfile) {
      return this.transition(
        provider,
        model,
        hardware,
        'stopped',
        `${provider.name} runtime stopped.`,
        0
      );
    }

    await this.transition(
      provider,
      model,
      hardware,
      'stopping',
      `Stopping ${provider.name} and releasing GPU resources…`,
      25
    );

    await this.compose(provider, ['stop', provider.dockerService]);

    return this.transition(
      provider,
      model,
      hardware,
      'stopped',
      `${provider.name} stopped. GPU resources released.`,
      0
    );
  }

  private async ensureProviderImage(
    provider: MusicProviderDefinition,
    model: MusicModelDefinition,
    hardware: HardwareProfile
  ): Promise<void> {
    if (!provider.dockerService || !provider.composeProfile) {
      throw new Error(`${provider.name} has no Docker runtime configured.`);
    }

    const imageName = provider.imageName;

    if (!imageName) {
      throw new Error(`${provider.name} has no Docker image configured.`);
    }

    if (this.validatedProviderImages.has(provider.id)) {
      return;
    }

    const imageExists = await this.tryDocker([
      'image',
      'inspect',
      imageName,
      '--format',
      '{{.Id}}',
    ]);

    await this.transition(
      provider,
      model,
      hardware,
      'building',
      imageExists
        ? `Checking ${provider.name} runtime image for source changes…`
        : `Building ${provider.name} runtime image…`,
      10
    );

    // Compose/BuildKit performs the source/config freshness check. If the
    // image is current this is a cache-only reconciliation; if Dockerfile or
    // provider inputs changed, only invalidated layers rebuild.
    await this.buildProviderImage(provider, model, hardware);
    this.validatedProviderImages.add(provider.id);
  }

  private async buildProviderImage(
    provider: MusicProviderDefinition,
    model: MusicModelDefinition,
    hardware: HardwareProfile
  ): Promise<void> {
    const args = this.composeArgs(provider, [
      'build',
      '--provenance=false',
      '--progress=plain',
      provider.dockerService!,
    ]);

    this.logger.log(`docker ${args.join(' ')}`);

    await new Promise<void>((resolve, reject) => {
      const child = spawn('docker', args, {
        cwd: process.cwd(),
        windowsHide: true,
        env: process.env,
      });

      const startedAt = Date.now();
      let lastStep = '';
      let lastProgress = 10;
      let errorTail = '';

      const stripAnsiSgr = (value: string): string => {
        const escape = String.fromCharCode(27);

        return value
          .split(escape)
          .map((segment, index) => {
            if (index === 0) {
              return segment;
            }

            const sgr = segment.match(/^\[[0-9;]*m/);

            return sgr
              ? segment.slice(sgr[0].length)
              : escape + segment;
          })
          .join('');
      };

      const emitBuildLine = (raw: string): void => {
        const line = stripAnsiSgr(raw)
          .replace(/\s+/g, ' ')
          .trim();

        if (!line) {
          return;
        }

        errorTail = `${errorTail}\n${line}`.slice(-12000);

        const step = line.match(/^#\d+\s+\[(\d+)\/(\d+)\]\s+(.+)$/);
        if (step) {
          const current = Number(step[1] ?? 0);
          const total = Number(step[2] ?? 0);
          const detail = (step[3] ?? 'Docker build step').slice(0, 140);
          lastStep = `step ${current}/${total}`;
          lastProgress =
            total > 0
              ? Math.min(
                  30,
                  10 + Math.max(1, Math.round((current / total) * 20))
                )
              : lastProgress;
          void this.transition(
            provider,
            model,
            hardware,
            'building',
            `Building ${provider.name} runtime — ${lastStep}: ${detail}`,
            lastProgress
          );
          return;
        }

        if (/exporting to image/i.test(line)) {
          lastStep = 'exporting image';
          lastProgress = Math.max(lastProgress, 31);
          void this.transition(
            provider,
            model,
            hardware,
            'building',
            `Building ${provider.name} runtime — exporting image…`,
            lastProgress
          );
          return;
        }

        if (/naming to .*harmonia\//i.test(line)) {
          lastStep = 'finalizing image';
          lastProgress = Math.max(lastProgress, 33);
          void this.transition(
            provider,
            model,
            hardware,
            'building',
            `Building ${provider.name} runtime — finalizing image…`,
            lastProgress
          );
        }
      };

      const consume = (chunk: Buffer | string): void => {
        String(chunk)
          .split(/\r?\n/)
          .forEach(emitBuildLine);
      };

      child.stdout?.on('data', consume);
      child.stderr?.on('data', consume);

      const heartbeat = setInterval(() => {
        const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
        const minutes = Math.floor(elapsedSeconds / 60);
        const seconds = elapsedSeconds % 60;
        const elapsed =
          minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
        const suffix = lastStep ? ` — ${lastStep}` : '';

        void this.transition(
          provider,
          model,
          hardware,
          'building',
          `Building ${provider.name} runtime… ${elapsed} elapsed${suffix}`,
          lastProgress
        );
      }, 10_000);

      child.once('error', (error) => {
        clearInterval(heartbeat);
        reject(error);
      });

      child.once('close', (code) => {
        clearInterval(heartbeat);

        if (code === 0) {
          resolve();
          return;
        }

        reject(
          new Error(
            `Docker build exited with code ${code ?? 'unknown'}.${
              errorTail ? ` Last output: ${errorTail.slice(-2000)}` : ''
            }`
          )
        );
      });
    });
  }

  private async prepareProviderModel(
    provider: MusicProviderDefinition,
    model: MusicModelDefinition
  ): Promise<void> {
    if (provider.id !== 'ace-step-1.5') {
      return;
    }

    if (!provider.containerName) {
      throw new Error(
        `${provider.name} has no container name configured.`
      );
    }

    if (model.runtimeModelId !== 'acestep-v15-turbo') {
      throw new Error(
        `Unsupported ACE-Step runtime model: ${model.runtimeModelId || 'none'}`
      );
    }

    const payload = JSON.stringify({
      model: model.runtimeModelId,
      init_llm: true,
      lm_model_path:
        'acestep-5Hz-lm-0.6B',
    });

    const python = [
      'import json, sys, urllib.request',
      'payload = sys.argv[1].encode("utf-8")',
      'req = urllib.request.Request(',
      '    "http://127.0.0.1:8001/v1/init",',
      '    data=payload,',
      '    headers={"Content-Type": "application/json"},',
      '    method="POST",',
      ')',
      'body = urllib.request.urlopen(req, timeout=900).read().decode("utf-8")',
      'print(body)',
    ].join('\n');

    const { stdout } = await execFileAsync(
      'docker',
      [
        'exec',
        provider.containerName,
        '/opt/ACE-Step-1.5/.venv/bin/python',
        '-c',
        python,
        payload,
      ],
      {
        cwd: process.cwd(),
        windowsHide: true,
        timeout: 15 * 60 * 1000,
        maxBuffer: 16 * 1024 * 1024,
      }
    );

    const response = JSON.parse(
      String(stdout).trim()
    ) as {
      code?: number;
      error?: string | null;
      data?: {
        loaded_model?: string | null;
        loaded_lm_model?: string | null;
        llm_initialized?: boolean;
      };
    };

    if (
      response.code !== 200 ||
      response.error ||
      response.data?.loaded_model !== model.runtimeModelId ||
      response.data?.loaded_lm_model !== 'acestep-5Hz-lm-0.6B' ||
      response.data?.llm_initialized !== true
    ) {
      throw new Error(
        `ACE-Step model initialization did not reach the requested resident state: ${JSON.stringify(
          response
        )}`
      );
    }
  }

  private async recoverProviderRuntimeSnapshot(
    provider: MusicProviderDefinition
  ): Promise<{
    model: MusicModelDefinition | null;
    busy: boolean;
  }> {
    if (!provider.containerName) {
      return { model: null, busy: false };
    }

    const healthPort =
      provider.id === 'musicgen'
        ? 8765
        : provider.id === 'stable-audio-3'
          ? 8766
          : provider.id === 'ace-step-1.5'
            ? 8001
            : null;

    if (healthPort === null) {
      return { model: null, busy: false };
    }

    const pythonExecutable =
      provider.id === 'musicgen'
        ? 'python3.9'
        : provider.id === 'ace-step-1.5'
          ? '/opt/ACE-Step-1.5/.venv/bin/python'
          : 'python3';

    try {
      const { stdout } = await execFileAsync(
        'docker',
        [
          'exec',
          provider.containerName,
          pythonExecutable,
          '-c',
          [
            'import json, urllib.request',
            `body = urllib.request.urlopen('http://127.0.0.1:${healthPort}/health', timeout=3).read().decode('utf-8')`,
            'print(body)',
          ].join('; '),
        ],
        {
          cwd: process.cwd(),
          windowsHide: true,
          timeout: 5_000,
        }
      );

      const parsed = JSON.parse(String(stdout).trim()) as {
        model?: string | null;
        busy?: boolean;
        data?: {
          models_initialized?: boolean;
          llm_initialized?: boolean;
          loaded_model?: string | null;
          loaded_lm_model?: string | null;
        };
      };

      const snapshot =
        provider.id === 'ace-step-1.5'
          ? {
              model:
                parsed.data?.models_initialized &&
                parsed.data?.llm_initialized &&
                parsed.data?.loaded_lm_model === 'acestep-5Hz-lm-0.6B'
                  ? parsed.data?.loaded_model || null
                  : null,
              busy: false,
            }
          : parsed;

      const model = snapshot.model
        ? MUSIC_MODELS.find(
            (candidate) =>
              candidate.providerId === provider.id &&
              candidate.runtimeModelId === snapshot.model
          ) || null
        : null;

      return {
        model,
        busy: Boolean(snapshot.busy),
      };
    } catch (error) {
      this.logger.warn(
        `Could not recover ${provider.name} provider model state: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return { model: null, busy: false };
    }
  }

  private async reconcileRuntimeOwnership(): Promise<void> {
    if (
      ['building', 'starting', 'health-checking', 'stopping'].includes(
        this.status.state
      )
    ) {
      return;
    }

    const runtimeProviders = MUSIC_PROVIDERS.filter(
      (provider) =>
        provider.runtimeInstalled &&
        provider.containerName &&
        provider.dockerService
    );

    const running: Array<{
      provider: MusicProviderDefinition;
      healthy: boolean;
    }> = [];

    for (const provider of runtimeProviders) {
      try {
        const { stdout } = await execFileAsync('docker', [
          'inspect',
          '--format',
          '{{json .State}}',
          provider.containerName!,
        ]);
        const state = JSON.parse(String(stdout).trim()) as {
          Running?: boolean;
          Health?: { Status?: string };
        };

        if (state.Running) {
          running.push({
            provider,
            healthy: state.Health?.Status === 'healthy',
          });
        }
      } catch {
        // A provider that has never been started has no container yet.
      }
    }

    const hardware = await this.detectHardware();

    if (running.length > 1) {
      this.logger.warn(
        `Multiple model runtimes were running after state recovery: ${running
          .map(({ provider }) => provider.id)
          .join(', ')}. Stopping all providers to protect GPU ownership.`
      );

      await Promise.all(
        running.map(({ provider }) =>
          execFileAsync('docker', ['stop', provider.containerName!], {
            cwd: process.cwd(),
            windowsHide: true,
          }).catch(() => undefined)
        )
      );

      this.status = {
        providerId: null,
        providerName: null,
        modelId: null,
        modelName: null,
        state: 'stopped',
        message:
          'Recovered multiple active model runtimes; all were stopped to protect GPU ownership.',
        healthy: false,
        progress: 0,
        hardware,
        updatedAt: new Date().toISOString(),
        error: null,
      };
      this.gateway.emitRuntimeStatus(this.status);
      return;
    }

    if (running.length === 1) {
      const recovered = running[0]!;
      const sameProvider = this.status.providerId === recovered.provider.id;
      const shouldRecoverSnapshot =
        !sameProvider ||
        !this.status.modelId ||
        this.status.state === 'busy';
      const snapshot = shouldRecoverSnapshot
        ? await this.recoverProviderRuntimeSnapshot(recovered.provider)
        : {
            model: null,
            busy: this.status.state === 'busy',
          };
      const rememberedModel =
        sameProvider && this.status.modelId
          ? MUSIC_MODELS.find(
              (candidate) => candidate.id === this.status.modelId
            ) || null
          : null;
      const recoveredModel = snapshot.model || rememberedModel;
      const recoveredState: MusicRuntimeState = recovered.healthy
        ? snapshot.busy
          ? 'busy'
          : 'ready'
        : 'health-checking';

      const modelChanged =
        this.status.modelId !== (recoveredModel?.id || null);
      const stateChanged = this.status.state !== recoveredState;

      if (
        !sameProvider ||
        this.status.state === 'stopped' ||
        this.status.healthy !== recovered.healthy ||
        modelChanged ||
        stateChanged
      ) {
        const recoveredModelLabel = recoveredModel
          ? ` with resident ${recoveredModel.name}`
          : '';

        this.status = {
          providerId: recovered.provider.id,
          providerName: recovered.provider.name,
          modelId: recoveredModel?.id || null,
          modelName: recoveredModel?.name || null,
          state: recoveredState,
          message: recovered.healthy
            ? snapshot.busy
              ? `Recovered running ${recovered.provider.name}${recoveredModelLabel}; generation is in progress.`
              : `Recovered running ${recovered.provider.name}${recoveredModelLabel} after backend restart.`
            : `Recovered ${recovered.provider.name} runtime; waiting for health.`,
          healthy: recovered.healthy,
          progress: recovered.healthy ? 100 : 65,
          hardware,
          updatedAt: new Date().toISOString(),
          error: null,
        };
        this.gateway.emitRuntimeStatus(this.status);
      }
      return;
    }

    if (
      this.status.providerId &&
      ['ready', 'healthy', 'error'].includes(this.status.state)
    ) {
      this.status = {
        providerId: null,
        providerName: null,
        modelId: null,
        modelName: null,
        state: 'stopped',
        message: 'No model provider runtime is currently running.',
        healthy: false,
        progress: 0,
        hardware,
        updatedAt: new Date().toISOString(),
        error: null,
      };
      this.gateway.emitRuntimeStatus(this.status);
    }
  }

  private async waitForHealthy(
    provider: MusicProviderDefinition,
    timeoutMs: number
  ): Promise<void> {
    if (!provider.containerName) {
      throw new Error(`${provider.name} has no container name configured.`);
    }

    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      try {
        const { stdout } = await execFileAsync('docker', [
          'inspect',
          '--format',
          '{{json .State}}',
          provider.containerName,
        ]);
        const state = JSON.parse(String(stdout).trim()) as {
          Running?: boolean;
          Restarting?: boolean;
          ExitCode?: number;
          Error?: string;
          Health?: {
            Status?: string;
            FailingStreak?: number;
            Log?: Array<{
              ExitCode?: number;
              Output?: string;
            }>;
          };
        };

        if (state.Running && state.Health?.Status === 'healthy') {
          return;
        }

        if (state.Health?.Status === 'unhealthy') {
          const healthTail = (state.Health.Log || [])
            .slice(-3)
            .map(
              (entry) =>
                `exit=${entry.ExitCode ?? 'unknown'} ${String(
                  entry.Output || ''
                ).trim()}`
            )
            .join(' | ');
          throw new Error(
            `${provider.containerName} became unhealthy${
              healthTail ? `: ${healthTail}` : '.'
            }`
          );
        }

        if (!state.Running && !state.Restarting) {
          throw new Error(
            `${provider.containerName} exited before becoming healthy (exit ${state.ExitCode ?? 'unknown'}${state.Error ? `: ${state.Error}` : ''}).`
          );
        }
      } catch (error) {
        if (
          error instanceof Error &&
          (error.message.includes('exited before') ||
            error.message.includes('became unhealthy'))
        ) {
          throw error;
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    let diagnostics = '';
    try {
      const [{ stdout: inspectOut }, { stdout: logsOut }] = await Promise.all([
        execFileAsync('docker', [
          'inspect',
          '--format',
          '{{json .State}}',
          provider.containerName,
        ]),
        execFileAsync('docker', [
          'logs',
          '--tail',
          '40',
          provider.containerName,
        ]),
      ]);
      const state = JSON.parse(String(inspectOut).trim()) as {
        Running?: boolean;
        Restarting?: boolean;
        ExitCode?: number;
        Error?: string;
        Health?: {
          Status?: string;
          FailingStreak?: number;
          Log?: Array<{ ExitCode?: number; Output?: string }>;
        };
      };
      const healthTail = (state.Health?.Log || [])
        .slice(-3)
        .map(
          (entry) =>
            `health exit=${entry.ExitCode ?? 'unknown'} ${String(
              entry.Output || ''
            ).trim()}`
        )
        .join(' | ');
      diagnostics = [
        `running=${Boolean(state.Running)}`,
        `restarting=${Boolean(state.Restarting)}`,
        `exit=${state.ExitCode ?? 'unknown'}`,
        `health=${state.Health?.Status || 'none'}`,
        `failingStreak=${state.Health?.FailingStreak ?? 0}`,
        state.Error ? `dockerError=${state.Error}` : '',
        healthTail,
        String(logsOut).trim()
          ? `logs=${String(logsOut).trim().slice(-3000)}`
          : '',
      ]
        .filter(Boolean)
        .join('; ');
    } catch {
      diagnostics = 'container diagnostics unavailable';
    }

    throw new Error(
      `${provider.name} health check timed out after ${Math.round(
        timeoutMs / 1000
      )} seconds. ${diagnostics}`
    );
  }

  private composeArgs(
    provider: MusicProviderDefinition,
    operation: string[]
  ): string[] {
    const args = [
      'compose',
      '-f',
      'docker-compose.yml',
    ];

    if (
      process.env['HARMONIA_GPU_ENABLED'] === 'true' ||
      this.status.hardware.gpuAvailable
    ) {
      args.push('-f', 'docker-compose.gpu.yml');
    }

    args.push('--profile', provider.composeProfile!, ...operation);
    return args;
  }

  private async compose(
    provider: MusicProviderDefinition,
    operation: string[]
  ): Promise<void> {
    const args = this.composeArgs(provider, operation);

    this.logger.log(`docker ${args.join(' ')}`);
    await execFileAsync('docker', args, {
      cwd: process.cwd(),
      windowsHide: true,
      maxBuffer: 100 * 1024 * 1024,
    });
  }

  private async tryDocker(args: string[]): Promise<boolean> {
    try {
      await execFileAsync('docker', args, {
        cwd: process.cwd(),
        windowsHide: true,
      });
      return true;
    } catch {
      return false;
    }
  }

  private getProvider(providerId: string): MusicProviderDefinition {
    const provider = MUSIC_PROVIDERS.find(
      (candidate) => candidate.id === providerId
    );
    if (!provider) {
      throw new BadRequestException(
        `Unknown music provider: ${providerId}`
      );
    }
    return provider;
  }

  private toCatalogEntry(
    model: MusicModelDefinition,
    hardware: HardwareProfile,
    installation: ModelInstallationCatalogInfo = {
      installationState:
        model.availability === 'installed'
          ? 'unknown'
          : 'not-managed',
      installationArtifactCount: 0,
      installationVerifiedCount: 0,
      installationLastVerifiedAt: null,
    }
  ): MusicModelCatalogEntry {
    const provider = this.getProvider(model.providerId);
    const hardwareFit = this.hardwareFit(model, hardware);

    let disabledReason: string | null = null;
    if (model.availability === 'api-only') {
      disabledReason = 'Hosted/API-only model; no local runtime is available.';
    } else if (model.availability === 'unreleased') {
      disabledReason = 'Model is listed for future compatibility but is not released.';
    } else if (hardwareFit === 'unsupported') {
      disabledReason = model.minVramGb
        ? `Requires at least ${model.minVramGb} GB VRAM.`
        : 'Current hardware is not supported.';
    } else if (!provider.runtimeInstalled) {
      disabledReason = 'Provider runtime is planned but not installed yet.';
    } else if (model.availability !== 'installed') {
      disabledReason = 'Model runtime is not installed yet.';
    } else if (
      installation.installationState !== 'verified' &&
      installation.installationState !== 'unknown'
    ) {
      disabledReason =
        this.installationDisabledReason(
          model.id,
          installation.installationState
        );
    }

    return {
      ...model,
      ...installation,
      providerName: provider.name,
      hardwareFit,
      selectable: disabledReason === null,
      disabledReason,
    };
  }

  private installationDisabledReason(
    modelId: string,
    state: ModelInstallationCatalogInfo['installationState']
  ): string {
    if (state === 'missing') {
      return `Model is not initialized locally. Run: pnpm models:init --model ${modelId}`;
    }

    if (
      state === 'degraded' ||
      state === 'corrupt' ||
      state === 'failed'
    ) {
      return `Model installation needs repair. Run: pnpm models:repair --model ${modelId}`;
    }

    if (state === 'unavailable') {
      return `Model installation is unavailable. Run: pnpm models:verify --model ${modelId}`;
    }

    return 'Model installation state is unavailable.';
  }

  private hardwareFit(
    model: MusicModelDefinition,
    hardware: HardwareProfile
  ): HardwareFit {
    if (model.minVramGb === undefined) {
      return 'experimental';
    }

    const min = model.minVramGb;
    const recommended = model.recommendedVramGb ?? min;

    if (min === 0) {
      return 'recommended';
    }

    if (!hardware.gpuAvailable || hardware.vramTotalGb === null) {
      return 'unsupported';
    }

    if (hardware.vramTotalGb >= recommended) {
      return 'recommended';
    }

    if (hardware.vramTotalGb >= min) {
      return 'supported';
    }

    return 'unsupported';
  }

  private async detectHardware(): Promise<HardwareProfile> {
    if (
      this.hardwareCache &&
      Date.now() - this.hardwareCacheAt < 10_000
    ) {
      return this.hardwareCache;
    }

    try {
      const { stdout } = await execFileAsync('nvidia-smi', [
        '--query-gpu=name,memory.total',
        '--format=csv,noheader,nounits',
      ]);
      const line = String(stdout).trim().split(/\r?\n/)[0] || '';
      const lastComma = line.lastIndexOf(',');
      const name = lastComma >= 0 ? line.slice(0, lastComma).trim() : line;
      const memoryMb =
        lastComma >= 0 ? Number(line.slice(lastComma + 1).trim()) : NaN;

      this.hardwareCache = {
        gpuAvailable: Boolean(name),
        gpuName: name || null,
        vramTotalGb: Number.isFinite(memoryMb)
          ? Math.round((memoryMb / 1024) * 10) / 10
          : null,
      };
    } catch {
      this.hardwareCache = {
        gpuAvailable: false,
        gpuName: null,
        vramTotalGb: null,
      };
    }

    this.hardwareCacheAt = Date.now();
    return this.hardwareCache;
  }

  private async transition(
    provider: MusicProviderDefinition,
    model: MusicModelDefinition | null,
    hardware: HardwareProfile,
    state: MusicRuntimeState,
    message: string,
    progress: number | null,
    healthy = false,
    error: string | null = null
  ): Promise<MusicRuntimeStatus> {
    this.status = {
      providerId: state === 'stopped' ? null : provider.id,
      providerName: state === 'stopped' ? null : provider.name,
      modelId: state === 'stopped' ? null : model?.id || null,
      modelName: state === 'stopped' ? null : model?.name || null,
      state,
      message,
      healthy,
      progress,
      hardware,
      updatedAt: new Date().toISOString(),
      error,
    };

    this.gateway.emitRuntimeStatus(this.status);
    return this.status;
  }
}
