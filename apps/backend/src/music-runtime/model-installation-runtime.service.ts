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
