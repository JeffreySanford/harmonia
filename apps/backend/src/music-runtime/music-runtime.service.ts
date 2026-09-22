import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { execFile } from 'node:child_process';
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
    const hardware = await this.detectHardware();
    this.status = { ...this.status, hardware };
    return this.status;
  }

  async selectModel(modelId: string): Promise<MusicRuntimeStatus> {
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

    const imageName = provider.id === 'diffsinger'
      ? 'harmonia/diffsinger:dev'
      : null;

    if (!imageName) {
      return;
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

    await this.compose(provider, [
      'build',
      '--provenance=false',
      provider.dockerService,
    ]);
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
        const state = JSON.parse(stdout.trim()) as {
          Running?: boolean;
          Health?: { Status?: string };
        };

        if (state.Running && state.Health?.Status === 'healthy') {
          return;
        }

        if (!state.Running) {
          throw new Error(
            `${provider.containerName} exited before becoming healthy.`
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

    throw new Error(
      `${provider.name} health check timed out after ${Math.round(
        timeoutMs / 1000
      )} seconds.`
    );
  }

  private async compose(
    provider: MusicProviderDefinition,
    operation: string[]
  ): Promise<void> {
    const args = [
      'compose',
      '-f',
      'docker-compose.yml',
    ];

    if (process.env['HARMONIA_GPU_ENABLED'] === 'true') {
      args.push('-f', 'docker-compose.gpu.yml');
    }

    args.push('--profile', provider.composeProfile!, ...operation);

    this.logger.log(`docker ${args.join(' ')}`);
    await execFileAsync('docker', args, {
      cwd: process.cwd(),
      windowsHide: true,
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
    const min = model.minVramGb ?? 0;
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
      const line = stdout.trim().split(/\r?\n/)[0] || '';
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
