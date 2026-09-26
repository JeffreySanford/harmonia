export type MusicRuntimeStateName =
  | 'stopped'
  | 'building'
  | 'starting'
  | 'health-checking'
  | 'healthy'
  | 'loading-model'
  | 'ready'
  | 'busy'
  | 'unloading-model'
  | 'stopping'
  | 'error'
  | 'disabled';

export type HardwareFit =
  | 'recommended'
  | 'supported'
  | 'experimental'
  | 'unsupported';

export interface HardwareProfile {
  gpuAvailable: boolean;
  gpuName: string | null;
  vramTotalGb: number | null;
}

export interface MusicProviderDefinition {
  id: string;
  name: string;
  description: string;
  runtimeInstalled: boolean;
  imageName?: string;
  dockerService?: string;
  containerName?: string;
  composeProfile?: string;
}

export type ModelInstallationCatalogState =
  | 'verified'
  | 'missing'
  | 'degraded'
  | 'corrupt'
  | 'unavailable'
  | 'failed'
  | 'unknown'
  | 'not-managed';

export interface MusicModelCatalogEntry {
  id: string;
  providerId: string;
  providerName: string;
  name: string;
  runtimeModelId?: string;
  modelSize?: string;
  availability: 'installed' | 'planned' | 'api-only' | 'unreleased';
  minVramGb?: number;
  recommendedVramGb?: number;
  maxDurationSeconds?: number;
  capabilities: string[];
  runtimeCost: 'local-free' | 'hosted-paid';
  commercialUse: 'allowed' | 'restricted' | 'review-required';
  notes?: string;
  hardwareFit: HardwareFit;
  installationState: ModelInstallationCatalogState;
  installationArtifactCount: number;
  installationVerifiedCount: number;
  installationLastVerifiedAt: string | null;
  selectable: boolean;
  disabledReason: string | null;
}

export interface MusicRuntimeStatus {
  operationId: string | null;
  providerId: string | null;
  providerName: string | null;
  modelId: string | null;
  modelName: string | null;
  state: MusicRuntimeStateName;
  message: string;
  healthy: boolean;
  progress: number | null;
  hardware: HardwareProfile;
  updatedAt: string;
  error: string | null;
}

export interface MusicRuntimeSelectionAccepted {
  operationId: string;
  modelId: string;
  acceptedAt: string;
  state: 'accepted';
}

export interface MusicRuntimeCatalogResponse {
  hardware: HardwareProfile;
  providers: MusicProviderDefinition[];
  models: MusicModelCatalogEntry[];
  status: MusicRuntimeStatus;
}

export interface MusicRuntimeFeatureState {
  providers: MusicProviderDefinition[];
  models: MusicModelCatalogEntry[];
  hardware: HardwareProfile | null;
  status: MusicRuntimeStatus | null;
  selectedProviderId: string | null;
  selectedModelId: string | null;
  activeSelectionOperationId: string | null;
  loading: boolean;
  switching: boolean;
  error: string | null;
}

export const initialMusicRuntimeState: MusicRuntimeFeatureState = {
  providers: [],
  models: [],
  hardware: null,
  status: null,
  selectedProviderId: null,
  selectedModelId: null,
  activeSelectionOperationId: null,
  loading: false,
  switching: false,
  error: null,
};
