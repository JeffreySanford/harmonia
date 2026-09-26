export type MusicRuntimeState =
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

export type ModelAvailability =
  | 'installed'
  | 'planned'
  | 'api-only'
  | 'unreleased';

export type ModelInstallationCatalogState =
  | 'verified'
  | 'missing'
  | 'degraded'
  | 'corrupt'
  | 'unavailable'
  | 'failed'
  | 'unknown'
  | 'not-managed';

export interface ModelInstallationCatalogInfo {
  installationState: ModelInstallationCatalogState;
  installationArtifactCount: number;
  installationVerifiedCount: number;
  installationLastVerifiedAt: string | null;
}

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

export interface MusicModelDefinition {
  id: string;
  providerId: string;
  name: string;
  modelSize?: string;
  runtimeModelId?: string;
  availability: ModelAvailability;
  minVramGb?: number;
  recommendedVramGb?: number;
  maxDurationSeconds?: number;
  capabilities: string[];
  runtimeCost: 'local-free' | 'hosted-paid';
  commercialUse: 'allowed' | 'restricted' | 'review-required';
  notes?: string;
}

export interface MusicModelCatalogEntry
  extends MusicModelDefinition,
    ModelInstallationCatalogInfo {
  providerName: string;
  hardwareFit: HardwareFit;
  selectable: boolean;
  disabledReason: string | null;
}

export interface MusicRuntimeStatus {
  operationId: string | null;
  providerId: string | null;
  providerName: string | null;
  modelId: string | null;
  modelName: string | null;
  state: MusicRuntimeState;
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
