import * as MusicRuntimeActions from './music-runtime.actions';
import {
  initialMusicRuntimeState,
  MusicRuntimeFeatureState,
  MusicRuntimeStatus,
} from './music-runtime.state';
import { musicRuntimeReducer } from './music-runtime.reducer';

const hardware = {
  gpuAvailable: true,
  gpuName: 'Test GPU',
  vramTotalGb: 10,
};

function status(
  overrides: Partial<MusicRuntimeStatus> = {}
): MusicRuntimeStatus {
  return {
    operationId: 'operation-1',
    providerId: 'musicgen',
    providerName: 'MusicGen',
    modelId: 'musicgen-small',
    modelName: 'MusicGen Small',
    state: 'building',
    message: 'building',
    healthy: false,
    progress: 20,
    hardware,
    updatedAt: '2026-09-26T00:00:00.000Z',
    error: null,
    ...overrides,
  };
}

function activeSelectionState(
  overrides: Partial<MusicRuntimeFeatureState> = {}
): MusicRuntimeFeatureState {
  return {
    ...initialMusicRuntimeState,
    selectedProviderId: 'musicgen',
    selectedModelId: 'musicgen-small',
    activeSelectionOperationId:
      'operation-1',
    switching: true,
    ...overrides,
  };
}

describe(
  'musicRuntimeReducer operation correlation',
  () => {
    it(
      'stores the operation id from HTTP acceptance',
      () => {
        const next = musicRuntimeReducer(
          {
            ...activeSelectionState(),
            activeSelectionOperationId: null,
          },
          MusicRuntimeActions.selectModelAccepted({
            acceptance: {
              operationId: 'operation-1',
              modelId: 'musicgen-small',
              acceptedAt:
                '2026-09-26T00:00:00.000Z',
              state: 'accepted',
            },
          })
        );

        expect(
          next.activeSelectionOperationId
        ).toBe('operation-1');

        expect(next.switching).toBe(true);
      }
    );

    it(
      'keeps correlated stopped intermediate during a provider switch',
      () => {
        const next = musicRuntimeReducer(
          activeSelectionState(),
          MusicRuntimeActions.runtimeStatusReceived({
            status: status({
              providerId: null,
              providerName: null,
              modelId: null,
              modelName: null,
              state: 'stopped',
              message: 'Old provider stopped',
              healthy: false,
              progress: 0,
            }),
          })
        );

        expect(next.switching).toBe(true);

        expect(
          next.activeSelectionOperationId
        ).toBe('operation-1');

        /*
         * Keep the target selection rather than bouncing the UI back to
         * the provider/model that is being removed.
         */
        expect(next.selectedModelId).toBe(
          'musicgen-small'
        );
      }
    );

    it(
      'clears correlation when matching ready arrives',
      () => {
        const next = musicRuntimeReducer(
          activeSelectionState(),
          MusicRuntimeActions.runtimeStatusReceived({
            status: status({
              state: 'ready',
              message: 'ready',
              healthy: true,
              progress: 100,
            }),
          })
        );

        expect(next.switching).toBe(false);

        expect(
          next.activeSelectionOperationId
        ).toBeNull();
      }
    );

    it(
      'clears correlation when matching error arrives',
      () => {
        const next = musicRuntimeReducer(
          activeSelectionState(),
          MusicRuntimeActions.runtimeStatusReceived({
            status: status({
              state: 'error',
              message: 'failed',
              error: 'failed',
              progress: null,
            }),
          })
        );

        expect(next.switching).toBe(false);
        expect(next.error).toBe('failed');

        expect(
          next.activeSelectionOperationId
        ).toBeNull();
      }
    );

    it(
      'ignores lifecycle events from a different operation',
      () => {
        const current =
          activeSelectionState();

        const next = musicRuntimeReducer(
          current,
          MusicRuntimeActions.runtimeStatusReceived({
            status: status({
              operationId: 'stale-operation',
              state: 'ready',
              healthy: true,
              progress: 100,
            }),
          })
        );

        expect(next).toBe(current);
      }
    );

    it(
      'can adopt the first correlated event when Socket.IO beats HTTP acceptance',
      () => {
        const pending =
          activeSelectionState({
            activeSelectionOperationId: null,
          });

        const next = musicRuntimeReducer(
          pending,
          MusicRuntimeActions.runtimeStatusReceived({
            status: status({
              state: 'building',
            }),
          })
        );

        expect(
          next.activeSelectionOperationId
        ).toBe('operation-1');

        expect(next.switching).toBe(true);
      }
    );

    it(
      'does not resurrect a terminal event that arrived before HTTP acceptance',
      () => {
        const pending =
          activeSelectionState({
            activeSelectionOperationId: null,
          });

        const terminal =
          musicRuntimeReducer(
            pending,
            MusicRuntimeActions.runtimeStatusReceived({
              status: status({
                state: 'ready',
                healthy: true,
                progress: 100,
              }),
            })
          );

        expect(terminal.switching).toBe(false);

        expect(
          terminal.activeSelectionOperationId
        ).toBeNull();

        const accepted =
          musicRuntimeReducer(
            terminal,
            MusicRuntimeActions.selectModelAccepted({
              acceptance: {
                operationId: 'operation-1',
                modelId: 'musicgen-small',
                acceptedAt:
                  '2026-09-26T00:00:00.000Z',
                state: 'accepted',
              },
            })
          );

        expect(accepted.switching).toBe(false);

        expect(
          accepted.activeSelectionOperationId
        ).toBeNull();
      }
    );

    it(
      'accepts uncorrelated recovery as authoritative runtime state',
      () => {
        const next = musicRuntimeReducer(
          activeSelectionState(),
          MusicRuntimeActions.runtimeStatusReceived({
            status: status({
              operationId: null,
              modelId:
                'musicgen-stereo-small',
              modelName:
                'MusicGen Stereo Small',
              state: 'ready',
              healthy: true,
              progress: 100,
              message:
                'Recovered running runtime',
            }),
          })
        );

        expect(
          next.activeSelectionOperationId
        ).toBeNull();

        expect(next.switching).toBe(false);

        expect(next.selectedModelId).toBe(
          'musicgen-stereo-small'
        );
      }
    );
  }
);
