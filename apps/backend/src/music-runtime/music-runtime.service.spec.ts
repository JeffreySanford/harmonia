import { BadRequestException } from '@nestjs/common';
import { MusicRuntimeService } from './music-runtime.service';

describe('MusicRuntimeService model readiness ordering', () => {
  function createService() {
    const gateway = {
      emitRuntimeStatus: jest.fn(),
    };

    const installations = {
      assertModelReady: jest.fn(),
      markModelUsed: jest.fn(),
    };

    const service =
      new MusicRuntimeService(
        gateway as never,
        installations as never
      );

    const internals =
      service as unknown as {
        reconcileRuntimeOwnership(): Promise<void>;
        detectHardware(): Promise<{
          gpuAvailable: boolean;
          gpuName: string | null;
          vramTotalGb: number | null;
        }>;
        ensureProviderImage(): Promise<void>;
        status: {
          providerId: string | null;
          providerName: string | null;
          modelId: string | null;
          modelName: string | null;
          state: string;
          message: string;
          healthy: boolean;
          progress: number | null;
          hardware: {
            gpuAvailable: boolean;
            gpuName: string | null;
            vramTotalGb: number | null;
          };
          updatedAt: string;
          error: string | null;
        };
      };

    jest
      .spyOn(
        internals,
        'reconcileRuntimeOwnership'
      )
      .mockResolvedValue();

    jest
      .spyOn(
        internals,
        'detectHardware'
      )
      .mockResolvedValue({
        gpuAvailable: true,
        gpuName: 'Test GPU',
        vramTotalGb: 10,
      });

    return {
      service,
      internals,
      installations,
    };
  }

  it('does not stop the current provider or build the target when filesystem readiness fails', async () => {
    const {
      service,
      internals,
      installations,
    } = createService();

    internals.status = {
      providerId: 'diffsinger',
      providerName: 'DiffSinger',
      modelId:
        'diffsinger-acoustic-hifigan',
      modelName: 'Acoustic + HiFi-GAN',
      state: 'ready',
      message: 'ready',
      healthy: true,
      progress: 100,
      hardware: {
        gpuAvailable: true,
        gpuName: 'Test GPU',
        vramTotalGb: 10,
      },
      updatedAt:
        new Date().toISOString(),
      error: null,
    };

    installations.assertModelReady.mockRejectedValue(
      new BadRequestException(
        'musicgen-small is not filesystem-ready'
      )
    );

    const stop = jest.spyOn(
      service,
      'stopCurrentRuntime'
    );

    const ensureImage = jest.spyOn(
      internals,
      'ensureProviderImage'
    );

    await expect(
      service.selectModel(
        'musicgen-small'
      )
    ).rejects.toThrow(
      'not filesystem-ready'
    );

    expect(
      installations.assertModelReady
    ).toHaveBeenCalledWith(
      'musicgen-small'
    );
    expect(stop).not.toHaveBeenCalled();
    expect(
      ensureImage
    ).not.toHaveBeenCalled();
    expect(
      installations.markModelUsed
    ).not.toHaveBeenCalled();
  });

  it('refreshes usage for an already-ready model without restarting or reverifying', async () => {
    const {
      service,
      internals,
      installations,
    } = createService();

    internals.status = {
      providerId: 'musicgen',
      providerName: 'MusicGen',
      modelId: 'musicgen-small',
      modelName: 'MusicGen Small',
      state: 'ready',
      message: 'ready',
      healthy: true,
      progress: 100,
      hardware: {
        gpuAvailable: true,
        gpuName: 'Test GPU',
        vramTotalGb: 10,
      },
      updatedAt:
        new Date().toISOString(),
      error: null,
    };

    installations.markModelUsed.mockResolvedValue(undefined);

    const stop = jest.spyOn(
      service,
      'stopCurrentRuntime'
    );

    const ensureImage = jest.spyOn(
      internals,
      'ensureProviderImage'
    );

    await expect(
      service.selectModel(
        'musicgen-small'
      )
    ).resolves.toEqual(
      internals.status
    );

    expect(
      installations.markModelUsed
    ).toHaveBeenCalledWith(
      'musicgen-small'
    );
    expect(
      installations.assertModelReady
    ).not.toHaveBeenCalled();
    expect(stop).not.toHaveBeenCalled();
    expect(
      ensureImage
    ).not.toHaveBeenCalled();
  });
});
