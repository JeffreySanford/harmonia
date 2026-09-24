import { BadRequestException } from '@nestjs/common';
import { ModelInstallationRuntimeService } from './model-installation-runtime.service';

interface TestVerificationResult {
  ok: boolean;
  artifacts: Array<{
    artifactId: string;
    state: string;
    requiredForSuccess?: boolean;
  }>;
}

interface TestableRuntimeService {
  verifyModel(modelId: string): Promise<TestVerificationResult>;
}

describe('ModelInstallationRuntimeService', () => {
  function createService() {
    const exec = jest.fn();
    const updateMany = jest.fn(() => ({ exec }));
    const findExec = jest.fn();
    const lean = jest.fn(() => ({ exec: findExec }));
    const find = jest.fn(() => ({ lean }));
    const model = { updateMany, find };

    const service =
      new ModelInstallationRuntimeService(
        model as never
      );

    return {
      service,
      model,
      updateMany,
      exec,
      find,
      findExec,
    };
  }

  it('derives verified and composite catalog installation state in one projection', async () => {
    const {
      service,
      find,
      findExec,
    } = createService();

    findExec.mockResolvedValue([
      {
        modelIds: [
          'musicgen-small',
        ],
        status: 'verified',
        verifiedAt:
          new Date(
            '2026-09-24T18:00:00.000Z'
          ),
      },
      {
        modelIds: [
          'diffsinger-acoustic-hifigan',
        ],
        status: 'verified',
        verifiedAt:
          new Date(
            '2026-09-24T18:01:00.000Z'
          ),
      },
      {
        modelIds: [
          'diffsinger-acoustic-hifigan',
        ],
        status: 'verified',
        verifiedAt:
          new Date(
            '2026-09-24T18:02:00.000Z'
          ),
      },
      {
        modelIds: [
          'diffsinger-acoustic-hifigan',
        ],
        status: 'verified',
        verifiedAt:
          new Date(
            '2026-09-24T18:03:00.000Z'
          ),
      },
    ]);

    const result =
      await service.getCatalogInstallationInfo([
        'musicgen-small',
        'diffsinger-acoustic-hifigan',
      ]);

    expect(find).toHaveBeenCalledTimes(1);

    expect(
      result['musicgen-small']
    ).toEqual({
      installationState:
        'verified',
      installationArtifactCount: 1,
      installationVerifiedCount: 1,
      installationLastVerifiedAt:
        '2026-09-24T18:00:00.000Z',
    });

    expect(
      result[
        'diffsinger-acoustic-hifigan'
      ]
    ).toEqual({
      installationState:
        'verified',
      installationArtifactCount: 3,
      installationVerifiedCount: 3,
      installationLastVerifiedAt:
        '2026-09-24T18:03:00.000Z',
    });
  });

  it('derives missing catalog state and returns unknown when Mongo read fails', async () => {
    const {
      service,
      findExec,
    } = createService();

    findExec.mockResolvedValueOnce([
      {
        modelIds: [
          'musicgen-medium',
        ],
        status: 'missing',
        verifiedAt: null,
      },
    ]);

    const missing =
      await service.getCatalogInstallationInfo([
        'musicgen-medium',
      ]);

    expect(
      missing['musicgen-medium']
    ).toEqual({
      installationState:
        'missing',
      installationArtifactCount: 1,
      installationVerifiedCount: 0,
      installationLastVerifiedAt:
        null,
    });

    findExec.mockRejectedValueOnce(
      new Error(
        'database unavailable'
      )
    );

    const unknown =
      await service.getCatalogInstallationInfo([
        'musicgen-small',
      ]);

    expect(
      unknown['musicgen-small']
    ).toEqual({
      installationState:
        'unknown',
      installationArtifactCount: 0,
      installationVerifiedCount: 0,
      installationLastVerifiedAt:
        null,
    });
  });

  it('accepts a deeply verified logical model', async () => {
    const { service } = createService();

    jest
      .spyOn(
        service as unknown as TestableRuntimeService,
        'verifyModel'
      )
      .mockResolvedValue({
        ok: true,
        artifacts: [
          {
            artifactId: 'artifact-a',
            state: 'verified',
            requiredForSuccess: true,
          },
          {
            artifactId: 'artifact-b',
            state: 'verified',
            requiredForSuccess: true,
          },
        ],
      });

    await expect(
      service.assertModelReady(
        'fixture-model'
      )
    ).resolves.toEqual([
      'artifact-a',
      'artifact-b',
    ]);
  });

  it('rejects missing required artifacts with an actionable message', async () => {
    const { service } = createService();

    jest
      .spyOn(
        service as unknown as TestableRuntimeService,
        'verifyModel'
      )
      .mockResolvedValue({
        ok: false,
        artifacts: [
          {
            artifactId: 'artifact-a',
            state: 'missing',
            requiredForSuccess: true,
          },
        ],
      });

    try {
      await service.assertModelReady(
        'fixture-model'
      );
      throw new Error(
        'Expected readiness rejection'
      );
    } catch (error) {
      expect(
        error
      ).toBeInstanceOf(
        BadRequestException
      );
      expect(
        (error as Error).message
      ).toContain(
        'artifact-a=missing'
      );
    }
  });

  it('updates lastUsedAt for all verified physical artifacts bound to the logical model', async () => {
    const {
      service,
      updateMany,
      exec,
    } = createService();

    exec.mockResolvedValue({
      acknowledged: true,
      matchedCount: 3,
      modifiedCount: 3,
    });

    const usedAt =
      new Date(
        '2026-09-24T19:00:00.000Z'
      );

    await expect(
      service.markModelUsed(
        'diffsinger-acoustic-hifigan',
        usedAt
      )
    ).resolves.toBeUndefined();

    expect(updateMany).toHaveBeenCalledWith(
      {
        modelIds:
          'diffsinger-acoustic-hifigan',
        status: 'verified',
      },
      {
        $set: {
          lastUsedAt: usedAt,
        },
      }
    );
    expect(exec).toHaveBeenCalledTimes(1);
  });

  it('treats lastUsedAt persistence failure as advisory', async () => {
    const {
      service,
      exec,
    } = createService();

    exec.mockRejectedValue(
      new Error('database unavailable')
    );

    await expect(
      service.markModelUsed(
        'musicgen-small'
      )
    ).resolves.toBeUndefined();
  });
});
