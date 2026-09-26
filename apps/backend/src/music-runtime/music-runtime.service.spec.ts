import { BadRequestException } from '@nestjs/common';
import { MusicRuntimeService } from './music-runtime.service';
import type { MusicRuntimeStatus } from './music-runtime.types';

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
        status: MusicRuntimeStatus;
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
      gateway,
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
      'acestep-v15-turbo-06b': {
        installationState:
          'verified',
        installationArtifactCount: 2,
        installationVerifiedCount: 2,
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

    const ace =
      catalog.models.find(
        (model) =>
          model.id ===
          'acestep-v15-turbo-06b'
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

    expect(ace).toEqual(
      expect.objectContaining({
        installationState:
          'verified',
        installationArtifactCount: 2,
        installationVerifiedCount: 2,
        selectable: true,
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
      operationId: null,
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
      operationId: null,
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


  it(
    'correlates an already-ready selection and clears that correlation for a later direct selection',
    async () => {
      const {
        service,
        internals,
        installations,
        gateway,
      } = createService();

      const originalUpdatedAt =
        '2026-09-25T20:30:00.000Z';

      internals.status = {
        operationId: null,
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
        updatedAt: originalUpdatedAt,
        error: null,
      };

      installations.markModelUsed.mockResolvedValue(
        undefined
      );

      const stop = jest.spyOn(
        service,
        'stopCurrentRuntime'
      );

      const ensureImage = jest.spyOn(
        internals,
        'ensureProviderImage'
      );

      const correlated =
        await service.selectModel(
          'musicgen-small',
          'selection-operation-1'
        );

      expect(correlated).toEqual(
        expect.objectContaining({
          operationId:
            'selection-operation-1',
          state: 'ready',
        })
      );

      expect(
        correlated.updatedAt
      ).not.toBe(originalUpdatedAt);

      expect(
        gateway.emitRuntimeStatus
      ).toHaveBeenLastCalledWith(
        expect.objectContaining({
          operationId:
            'selection-operation-1',
          state: 'ready',
        })
      );

      const correlatedUpdatedAt =
        correlated.updatedAt;

      const direct =
        await service.selectModel(
          'musicgen-small'
        );

      expect(
        direct.operationId
      ).toBeNull();

      expect(
        direct.updatedAt
      ).toBe(correlatedUpdatedAt);

      expect(
        gateway.emitRuntimeStatus
      ).toHaveBeenLastCalledWith(
        expect.objectContaining({
          operationId: null,
          state: 'ready',
          updatedAt:
            correlatedUpdatedAt,
        })
      );

      expect(
        installations.markModelUsed
      ).toHaveBeenCalledTimes(2);

      expect(stop).not.toHaveBeenCalled();

      expect(
        ensureImage
      ).not.toHaveBeenCalled();
    }
  );
});


describe('Phase 13C asynchronous selection behavior', () => {
  function createAsyncSelectionService() {
    const gateway = {
      emitRuntimeStatus: jest.fn(),
    };

    const installations = {
      assertModelReady: jest.fn(),
      markModelUsed: jest.fn(),
      getCatalogInstallationInfo: jest.fn(),
    };

    return new MusicRuntimeService(
      gateway as never,
      installations as never
    );
  }

  function readyStatus(modelId: string) {
    return {
      operationId: null,
      providerId: 'musicgen',
      providerName: 'MusicGen',
      modelId,
      modelName: 'Test model',
      state: 'ready' as const,
      message: 'ready',
      healthy: true,
      progress: 100,
      hardware: {
        gpuAvailable: true,
        gpuName: 'Test GPU',
        vramTotalGb: 10,
      },
      updatedAt: new Date().toISOString(),
      error: null,
    };
  }

  it(
    'returns acceptance before delayed model selection finishes and releases the operation lock afterward',
    async () => {
      const service =
        createAsyncSelectionService();

      let releaseSelection:
        (value: ReturnType<typeof readyStatus>) => void =
        () => {
          throw new Error(
            'Delayed selection release callback was not initialized.'
          );
        };

      const delayedSelection =
        new Promise<ReturnType<typeof readyStatus>>(
          (resolve) => {
            releaseSelection = resolve;
          }
        );

      const selectSpy = jest
        .spyOn(service, 'selectModel')
        .mockReturnValue(delayedSelection);

      const acceptance =
        service.requestModelSelection(
          'musicgen-small'
        );

      expect(acceptance).toEqual(
        expect.objectContaining({
          modelId: 'musicgen-small',
          state: 'accepted',
          operationId: expect.any(String),
          acceptedAt: expect.any(String),
        })
      );

      expect(
        acceptance.operationId.length
      ).toBeGreaterThan(0);

      /*
       * setImmediate has not executed yet. The HTTP-facing method has
       * already returned while the expensive worker has not even started.
       */
      expect(selectSpy).not.toHaveBeenCalled();

      /*
       * The operation reservation is made synchronously, preventing a
       * second provider switch from racing the first.
       */
      expect(() =>
        service.requestModelSelection(
          'musicgen-stereo-small'
        )
      ).toThrow(
        'A music runtime selection is already in progress.'
      );

      await new Promise<void>((resolve) =>
        setImmediate(resolve)
      );

      /*
       * Background orchestration has now started, but its deliberately
       * unresolved promise proves acceptance did not wait for completion.
       */
      expect(selectSpy).toHaveBeenCalledTimes(1);
      expect(selectSpy).toHaveBeenCalledWith(
        'musicgen-small',
        acceptance.operationId
      );

      let completed = false;

      void delayedSelection.then(() => {
        completed = true;
      });

      await Promise.resolve();

      expect(completed).toBe(false);


      releaseSelection(
        readyStatus('musicgen-small')
      );

      await delayedSelection;
      await new Promise<void>((resolve) =>
        setImmediate(resolve)
      );

      expect(completed).toBe(true);

      /*
       * Once .finally() releases selectionOperationId, another request can
       * be accepted. Make subsequent worker execution immediately resolve
       * so this test leaves no pending async work.
       */
      selectSpy.mockResolvedValue(
        readyStatus('musicgen-stereo-small')
      );

      const secondAcceptance =
        service.requestModelSelection(
          'musicgen-stereo-small'
        );

      expect(secondAcceptance).toEqual(
        expect.objectContaining({
          modelId: 'musicgen-stereo-small',
          state: 'accepted',
        })
      );

      expect(
        secondAcceptance.operationId
      ).not.toEqual(
        acceptance.operationId
      );

      await new Promise<void>((resolve) =>
        setImmediate(resolve)
      );

      await new Promise<void>((resolve) =>
        setImmediate(resolve)
      );
    }
  );
});
