import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { execFile } from 'node:child_process';
import * as path from 'node:path';
import { promisify } from 'node:util';
import { Model } from 'mongoose';
import {
  ModelInstallation,
  ModelInstallationDocument,
} from '../schemas/model-installation.schema';
import {
  ModelInstallationCatalogInfo,
  ModelInstallationCatalogState,
} from './music-runtime.types';

const execFileAsync = promisify(execFile);

interface VerificationArtifactRow {
  artifactId: string;
  state: string;
  requiredForSuccess?: boolean;
}

interface VerificationResult {
  ok: boolean;
  artifacts: VerificationArtifactRow[];
}

interface ExecFileFailure {
  stdout?: string | Buffer;
}

@Injectable()
export class ModelInstallationRuntimeService {
  private readonly logger = new Logger(
    ModelInstallationRuntimeService.name
  );

  constructor(
    @InjectModel(ModelInstallation.name)
    private readonly installationModel: Model<ModelInstallationDocument>
  ) {}

  async getCatalogInstallationInfo(
    modelIds: string[]
  ): Promise<Record<string, ModelInstallationCatalogInfo>> {
    const uniqueModelIds = [
      ...new Set(
        modelIds.filter(Boolean)
      ),
    ];

    const unknown = Object.fromEntries(
      uniqueModelIds.map(
        (modelId) => [
          modelId,
          this.emptyCatalogInfo('unknown'),
        ]
      )
    ) as Record<
      string,
      ModelInstallationCatalogInfo
    >;

    if (uniqueModelIds.length === 0) {
      return unknown;
    }

    try {
      const rows =
        await this.installationModel
          .find(
            {
              modelIds: {
                $in: uniqueModelIds,
              },
            },
            {
              modelIds: 1,
              status: 1,
              verifiedAt: 1,
            }
          )
          .lean()
          .exec();

      const grouped = new Map<
        string,
        Array<{
          status: string;
          verifiedAt?: Date | string | null;
        }>
      >();

      for (const modelId of uniqueModelIds) {
        grouped.set(modelId, []);
      }

      for (const row of rows) {
        for (const modelId of row.modelIds || []) {
          if (!grouped.has(modelId)) {
            continue;
          }

          grouped.get(modelId)!.push({
            status: String(row.status),
            verifiedAt:
              row.verifiedAt || null,
          });
        }
      }

      const result = { ...unknown };

      for (const modelId of uniqueModelIds) {
        const modelRows =
          grouped.get(modelId) || [];

        if (modelRows.length === 0) {
          continue;
        }

        const state =
          this.deriveCatalogState(
            modelRows.map(
              (row) => row.status
            )
          );

        const verifiedCount =
          modelRows.filter(
            (row) =>
              row.status === 'verified'
          ).length;

        const verifiedTimes =
          modelRows
            .map((row) =>
              row.verifiedAt
                ? new Date(
                    row.verifiedAt
                  ).getTime()
                : Number.NaN
            )
            .filter(Number.isFinite);

        result[modelId] = {
          installationState: state,
          installationArtifactCount:
            modelRows.length,
          installationVerifiedCount:
            verifiedCount,
          installationLastVerifiedAt:
            verifiedTimes.length > 0
              ? new Date(
                  Math.max(
                    ...verifiedTimes
                  )
                ).toISOString()
              : null,
        };
      }

      return result;
    } catch {
      this.logger.warn(
        'Could not read model installation catalog metadata; returning unknown installation state.'
      );
      return unknown;
    }
  }

  async assertModelReady(modelId: string): Promise<string[]> {
    const verification =
      await this.verifyModel(modelId);

    const requiredRows =
      verification.artifacts.filter(
        (row) =>
          row.requiredForSuccess !== false
      );

    const failed = requiredRows.filter(
      (row) => row.state !== 'verified'
    );

    if (
      verification.ok !== true ||
      failed.length > 0
    ) {
      const artifacts =
        failed.length > 0
          ? failed
              .map(
                (row) =>
                  `${row.artifactId}=${row.state}`
              )
              .join(', ')
          : 'verification failed';

      throw new BadRequestException(
        `Model ${modelId} is not filesystem-ready (${artifacts}). Run "pnpm models:init --model ${modelId}" and "pnpm models:verify --model ${modelId}" before provider startup.`
      );
    }

    return requiredRows.map(
      (row) => row.artifactId
    );
  }

  async markModelUsed(
    modelId: string,
    usedAt = new Date()
  ): Promise<void> {
    try {
      const result =
        await this.installationModel
          .updateMany(
            {
              modelIds: modelId,
              status: 'verified',
            },
            {
              $set: {
                lastUsedAt: usedAt,
              },
            }
          )
          .exec();

      if (result.matchedCount === 0) {
        this.logger.warn(
          `No verified model_installations rows matched logical model ${modelId} for lastUsedAt update.`
        );
      }
    } catch {
      this.logger.warn(
        `Could not update lastUsedAt for logical model ${modelId}; provider selection remains valid.`
      );
    }
  }

  private emptyCatalogInfo(
    state: ModelInstallationCatalogState
  ): ModelInstallationCatalogInfo {
    return {
      installationState: state,
      installationArtifactCount: 0,
      installationVerifiedCount: 0,
      installationLastVerifiedAt: null,
    };
  }

  private deriveCatalogState(
    statuses: string[]
  ): ModelInstallationCatalogState {
    if (
      statuses.length > 0 &&
      statuses.every(
        (status) =>
          status === 'verified'
      )
    ) {
      return 'verified';
    }

    for (const state of [
      'corrupt',
      'failed',
      'unavailable',
      'degraded',
      'missing',
    ] as const) {
      if (statuses.includes(state)) {
        return state;
      }
    }

    return 'unknown';
  }

  private async verifyModel(
    modelId: string
  ): Promise<VerificationResult> {
    const script = path.resolve(
      process.cwd(),
      'scripts',
      'model-manager.cjs'
    );
    const args = [
      script,
      'verify',
      '--model',
      modelId,
      '--root',
      'models',
      '--offline',
      '--json',
    ];

    try {
      const { stdout } =
        await execFileAsync(
          process.execPath,
          args,
          {
            cwd: process.cwd(),
            windowsHide: true,
            maxBuffer:
              16 * 1024 * 1024,
          }
        );

      return this.parseVerification(
        String(stdout)
      );
    } catch (error) {
      const failure =
        error as ExecFileFailure;

      if (failure.stdout) {
        try {
          return this.parseVerification(
            String(failure.stdout)
          );
        } catch {
          // Fall through to the stable operator-facing error.
        }
      }

      throw new BadRequestException(
        `Could not verify filesystem readiness for model ${modelId}.`
      );
    }
  }

  private parseVerification(
    stdout: string
  ): VerificationResult {
    const parsed =
      JSON.parse(stdout) as Partial<VerificationResult>;

    if (
      typeof parsed.ok !== 'boolean' ||
      !Array.isArray(parsed.artifacts)
    ) {
      throw new Error(
        'Model verification returned an invalid machine contract.'
      );
    }

    return {
      ok: parsed.ok,
      artifacts:
        parsed.artifacts.map(
          (row) => ({
            artifactId:
              String(row.artifactId),
            state:
              String(row.state),
            requiredForSuccess:
              row.requiredForSuccess,
          })
        ),
    };
  }
}
