import { createReducer, on } from '@ngrx/store';
import * as MusicRuntimeActions from './music-runtime.actions';
import {
  initialMusicRuntimeState,
  MusicRuntimeFeatureState,
  MusicRuntimeStatus,
} from './music-runtime.state';

function applyRuntimeStatus(
  state: MusicRuntimeFeatureState,
  status: MusicRuntimeStatus
): MusicRuntimeFeatureState {
  const activeOperationId =
    state.activeSelectionOperationId;

  const incomingOperationId =
    status.operationId;

  /*
   * A lifecycle event from a different accepted operation is stale.
   */
  if (
    activeOperationId !== null &&
    incomingOperationId !== null &&
    activeOperationId !== incomingOperationId
  ) {
    return state;
  }

  /*
   * setImmediate makes HTTP acceptance normally arrive first, but transport
   * scheduling can still let the first Socket.IO event arrive first.
   *
   * Adopt that operation only while a model switch is pending and the event
   * belongs to the model the user selected.
   */
  const canAdoptBeforeAcceptance =
    activeOperationId === null &&
    incomingOperationId !== null &&
    state.switching &&
    status.modelId === state.selectedModelId;

  if (
    incomingOperationId !== null &&
    activeOperationId === null &&
    !canAdoptBeforeAcceptance
  ) {
    return state;
  }

  const correlated =
    incomingOperationId !== null;

  /*
   * "stopped" can be an intermediate state when changing providers.
   * Only ready/error terminate a correlated selection.
   */
  const selectionTerminal =
    correlated &&
    (
      status.state === 'ready' ||
      status.state === 'error'
    );

  /*
   * Uncorrelated status represents ordinary runtime activity, explicit stop,
   * or backend/Docker recovery. Preserve the pre-Phase-14 terminal rules.
   */
  const uncorrelatedTerminal =
    !correlated &&
    ['ready', 'stopped', 'error'].includes(
      status.state
    );

  return {
    ...state,
    status,
    hardware: status.hardware,

    /*
     * During a correlated switch, stopping the old provider must not replace
     * the requested provider/model selection in the UI.
     */
    selectedProviderId:
      correlated
        ? state.selectedProviderId
        : status.providerId ||
          state.selectedProviderId,

    selectedModelId:
      correlated
        ? state.selectedModelId
        : status.modelId ||
          state.selectedModelId,

    activeSelectionOperationId:
      correlated && !selectionTerminal
        ? incomingOperationId
        : null,

    switching:
      correlated
        ? !selectionTerminal
        : !uncorrelatedTerminal,

    error: status.error,
  };
}

export const musicRuntimeReducer =
  createReducer<MusicRuntimeFeatureState>(
    initialMusicRuntimeState,

    on(MusicRuntimeActions.loadCatalog, (state) => ({
      ...state,
      loading: true,
      error: null,
    })),

    on(
      MusicRuntimeActions.loadCatalogSuccess,
      (state, { catalog }) => ({
        ...state,
        providers: catalog.providers,
        models: catalog.models,
        hardware: catalog.hardware,
        status: catalog.status,
        selectedProviderId:
          state.selectedProviderId ||
          catalog.status.providerId ||
          null,
        selectedModelId:
          state.selectedModelId ||
          catalog.status.modelId ||
          null,
        loading: false,
      })
    ),

    on(
      MusicRuntimeActions.loadCatalogFailure,
      (state, { error }) => ({
        ...state,
        loading: false,
        error,
      })
    ),

    on(
      MusicRuntimeActions.chooseProvider,
      (state, { providerId }) => ({
        ...state,
        selectedProviderId: providerId,
        selectedModelId: null,
        error: null,
      })
    ),

    on(
      MusicRuntimeActions.selectModel,
      (state, { modelId }) => {
        const model = state.models.find(
          (candidate) =>
            candidate.id === modelId
        );

        return {
          ...state,
          selectedModelId: modelId,
          selectedProviderId:
            model?.providerId ||
            state.selectedProviderId,
          activeSelectionOperationId: null,
          switching: true,
          error: null,
        };
      }
    ),

    on(
      MusicRuntimeActions.selectModelAccepted,
      (state, { acceptance }) => {
        /*
         * If a same-ready terminal event beat the HTTP acknowledgement over
         * the network, do not resurrect an already-completed operation.
         */
        const terminalAlreadyReceived =
          state.status?.operationId ===
            acceptance.operationId &&
          (
            state.status.state === 'ready' ||
            state.status.state === 'error'
          );

        return {
          ...state,
          selectedModelId:
            acceptance.modelId,
          activeSelectionOperationId:
            terminalAlreadyReceived
              ? null
              : acceptance.operationId,
          switching:
            terminalAlreadyReceived
              ? false
              : state.switching,
          error:
            terminalAlreadyReceived
              ? state.error
              : null,
        };
      }
    ),

    on(
      MusicRuntimeActions.selectModelFailure,
      (state, { error }) => ({
        ...state,
        activeSelectionOperationId: null,
        switching: false,
        error,
      })
    ),

    on(MusicRuntimeActions.stopRuntime, (state) => ({
      ...state,
      activeSelectionOperationId: null,
      switching: true,
      error: null,
    })),

    on(
      MusicRuntimeActions.stopRuntimeSuccess,
      (state, { status }) => ({
        ...state,
        status,
        activeSelectionOperationId: null,
        switching: false,
        error: null,
      })
    ),

    on(
      MusicRuntimeActions.stopRuntimeFailure,
      (state, { error }) => ({
        ...state,
        activeSelectionOperationId: null,
        switching: false,
        error,
      })
    ),

    on(
      MusicRuntimeActions.runtimeStatusReceived,
      (state, { status }) =>
        applyRuntimeStatus(state, status)
    ),

    on(MusicRuntimeActions.clearError, (state) => ({
      ...state,
      error: null,
    }))
  );
