import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import {
  MUSIC_MODELS,
  MUSIC_PROVIDERS,
} from './music-model.catalog';
import { MusicRuntimeGateway } from './music-runtime.gateway';
import {
  HardwareFit,
  HardwareProfile,
  MusicModelCatalogEntry,
  MusicModelDefinition,
  MusicProviderDefinition,
  MusicRuntimeCatalogResponse,
  MusicRuntimeState,
  MusicRuntimeStatus,
} from './music-runtime.types';

const execFileAsync = promisify(execFile);

@Injectable()
export class MusicRuntimeService {
  private readonly logger = new Logger(MusicRuntimeService.name);
  private hardwareCache: HardwareProfile | null = null;
  private hardwareCacheAt = 0;

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

  constructor(private readonly gateway: MusicRuntimeGateway) {}

  async getCatalog(): Promise<MusicRuntimeCatalogResponse> {
    await this.reconcileRuntimeOwnership();
    const hardware = await this.detectHardware();
    this.status = { ...this.status, hardware };

    return {
      hardware,
      providers: MUSIC_PROVIDERS,
      models: MUSIC_MODELS.map((model) =>
        this.toCatalogEntry(model, hardware)
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

  async selectModel(modelId: string): Promise<MusicRuntimeStatus> {
    await this.reconcileRuntimeOwnership();
    const hardware = await this.detectHardware();
    const model = MUSIC_MODELS.find((candidate) => candidate.id === modelId);
    if (!model) {
      throw new BadRequestException(`Unknown music model: ${modelId}`);
    }

    const provider = this.getProvider(model.providerId);
    const entry = this.toCatalogEntry(model, hardware);

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
      return this.status;
    }

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

      // Give the client enough time to visibly acknowledge the successful
      // health milestone before the terminal ready notification replaces it.
      await new Promise((resolve) => setTimeout(resolve, 800));

      await this.transition(
        provider,
        model,
        hardware,
        'ready',
        `${model.name} runtime is ready. Model weights load on first inference.`,
        100,
        true
      );

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

    const imageExists = await this.tryDocker([
      'image',
      'inspect',
      imageName,
      '--format',
      '{{.Id}}',
    ]);

    if (imageExists) {
      return;
    }

    await this.transition(
      provider,
      model,
      hardware,
      'building',
      `Building ${provider.name} runtime image…`,
      10
    );

    await this.buildProviderImage(provider, model, hardware);
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

      const emitBuildLine = (raw: string): void => {
        const line = raw
          .replace(/\u001b\[[0-9;]*m/g, '')
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
      const recoveredState = recovered.healthy ? 'ready' : 'health-checking';

      if (
        !sameProvider ||
        this.status.state === 'stopped' ||
        this.status.healthy !== recovered.healthy
      ) {
        this.status = {
          providerId: recovered.provider.id,
          providerName: recovered.provider.name,
          modelId: sameProvider ? this.status.modelId : null,
          modelName: sameProvider ? this.status.modelName : null,
          state: recoveredState,
          message: recovered.healthy
            ? `Recovered running ${recovered.provider.name} runtime after backend restart.`
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

        if (!state.Running && !state.Restarting) {
          throw new Error(
            `${provider.containerName} exited before becoming healthy (exit ${state.ExitCode ?? 'unknown'}${state.Error ? `: ${state.Error}` : ''}).`
          );
        }
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.includes('exited before')
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
    hardware: HardwareProfile
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
    }

    return {
      ...model,
      providerName: provider.name,
      hardwareFit,
      selectable: disabledReason === null,
      disabledReason,
    };
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
