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
      getCatalogInstallationInfo:
        jest.fn(),
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

    const reconcileSpy = jest
      .spyOn(
        internals,
        'reconcileRuntimeOwnership'
      )
      .mockResolvedValue();

    const hardwareSpy = jest
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
      reconcileSpy,
      hardwareSpy,
    };
  }

  it('merges verified installation metadata into catalog entries', async () => {
    const {
      service,
      installations,
    } = createService();

    installations.getCatalogInstallationInfo.mockResolvedValue({
      'musicgen-small': {
        installationState:
          'verified',
        installationArtifactCount: 1,
        installationVerifiedCount: 1,
        installationLastVerifiedAt:
          '2026-09-24T18:00:00.000Z',
      },
      'musicgen-stereo-small': {
        installationState:
          'verified',
        installationArtifactCount: 1,
        installationVerifiedCount: 1,
        installationLastVerifiedAt:
          '2026-09-24T18:00:00.000Z',
      },
      'musicgen-medium': {
        installationState:
          'missing',
        installationArtifactCount: 1,
        installationVerifiedCount: 0,
        installationLastVerifiedAt:
          null,
      },
      'musicgen-stereo-medium': {
        installationState:
          'missing',
        installationArtifactCount: 1,
        installationVerifiedCount: 0,
        installationLastVerifiedAt:
          null,
      },
      'diffsinger-acoustic-hifigan': {
        installationState:
          'verified',
        installationArtifactCount: 3,
        installationVerifiedCount: 3,
        installationLastVerifiedAt:
          '2026-09-24T18:00:00.000Z',
      },
      'stable-audio-3-small-music': {
        installationState:
          'verified',
        installationArtifactCount: 1,
        installationVerifiedCount: 1,
        installationLastVerifiedAt:
          '2026-09-24T18:00:00.000Z',
      },
    });

    const catalog =
      await service.getCatalog();

    const small =
      catalog.models.find(
        (model) =>
          model.id ===
          'musicgen-small'
      );

    const diffsinger =
      catalog.models.find(
        (model) =>
          model.id ===
          'diffsinger-acoustic-hifigan'
      );

    const planned =
      catalog.models.find(
        (model) =>
          model.id ===
          'stable-audio-3-medium'
      );

    expect(small).toEqual(
      expect.objectContaining({
        installationState:
          'verified',
        installationArtifactCount: 1,
        installationVerifiedCount: 1,
        selectable: true,
      })
    );

    expect(diffsinger).toEqual(
      expect.objectContaining({
        installationState:
          'verified',
        installationArtifactCount: 3,
        installationVerifiedCount: 3,
      })
    );

    expect(planned).toEqual(
      expect.objectContaining({
        installationState:
          'not-managed',
        installationArtifactCount: 0,
      })
    );
  });

  it('disables a missing local model when hardware would otherwise support it', async () => {
    const {
      service,
      installations,
      hardwareSpy,
    } = createService();

    hardwareSpy.mockResolvedValue({
      gpuAvailable: true,
      gpuName: 'Large Test GPU',
      vramTotalGb: 24,
    });

    installations.getCatalogInstallationInfo.mockResolvedValue({
      'musicgen-medium': {
        installationState:
          'missing',
        installationArtifactCount: 1,
        installationVerifiedCount: 0,
        installationLastVerifiedAt:
          null,
      },
    });

    const catalog =
      await service.getCatalog();

    const medium =
      catalog.models.find(
        (model) =>
          model.id ===
          'musicgen-medium'
      );

    expect(medium).toEqual(
      expect.objectContaining({
        hardwareFit:
          'recommended',
        installationState:
          'missing',
        selectable: false,
      })
    );

    expect(
      medium?.disabledReason
    ).toContain(
      'pnpm models:init --model musicgen-medium'
    );
  });

  it('keeps unknown Mongo installation state advisory for an installed model', async () => {
    const {
      service,
      installations,
    } = createService();

    installations.getCatalogInstallationInfo.mockResolvedValue({});

    const catalog =
      await service.getCatalog();

    const small =
      catalog.models.find(
        (model) =>
          model.id ===
          'musicgen-small'
      );

    expect(small).toEqual(
      expect.objectContaining({
        installationState:
          'unknown',
        selectable: true,
      })
    );
  });

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
