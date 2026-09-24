import { BadRequestException } from '@nestjs/common';
import { ModelInstallationRuntimeService } from './model-installation-runtime.service';

describe('ModelInstallationRuntimeService', () => {
  function createService() {
    const exec = jest.fn();
    const updateMany = jest.fn(() => ({ exec }));
    const model = { updateMany };

    const service =
      new ModelInstallationRuntimeService(
        model as never
      );

    return {
      service,
      model,
      updateMany,
      exec,
    };
  }

  it('accepts a deeply verified logical model', async () => {
    const { service } = createService();

    jest
      .spyOn(service as never, 'verifyModel' as never)
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
      } as never);

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
      .spyOn(service as never, 'verifyModel' as never)
      .mockResolvedValue({
        ok: false,
        artifacts: [
          {
            artifactId: 'artifact-a',
            state: 'missing',
            requiredForSuccess: true,
          },
        ],
      } as never);

    await expect(
      service.assertModelReady(
        'fixture-model'
      )
    ).rejects.toEqual(
      expect.objectContaining({
        constructor: BadRequestException,
        message: expect.stringContaining(
          'artifact-a=missing'
        ),
      })
    );
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
