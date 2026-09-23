import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { BehaviorSubject, map, Observable } from 'rxjs';
import {
  Meta,
  StoryObj,
  applicationConfig,
  moduleMetadata,
} from '@storybook/angular';
import { expect, fn } from 'storybook/test';

import { WebSocketService } from '../../services/websocket.service';
import { initialAuthState } from '../../store/auth/auth.state';
import * as JobsActions from '../../store/jobs/jobs.actions';
import { initialJobsState } from '../../store/jobs/jobs.reducer';
import { Job, JobsState } from '../../store/jobs/jobs.state';
import {
  HardwareProfile,
  MusicModelCatalogEntry,
  MusicProviderDefinition,
  MusicRuntimeFeatureState,
  MusicRuntimeStatus,
} from '../../store/music-runtime/music-runtime.state';
import { MusicGenerationModule } from './music-generation.module';
import { MusicGenerationPageComponent } from './music-generation-page.component';

interface MusicStoryState {
  auth: typeof initialAuthState;
  musicRuntime: MusicRuntimeFeatureState;
  jobs: JobsState;
}

class MusicStoryStore {
  private readonly state$: BehaviorSubject<MusicStoryState>;
  readonly dispatchSpy = fn();

  constructor(
    state: MusicStoryState,
    private readonly onDispatch?: (
      action: any,
      store: MusicStoryStore
    ) => void
  ) {
    this.state$ = new BehaviorSubject<MusicStoryState>(state);
  }

  select<T>(selector: (state: any) => T): Observable<T> {
    return this.state$.pipe(map((state) => selector(state)));
  }

  dispatch(action: any): void {
    this.dispatchSpy(action);
    this.onDispatch?.(action, this);
  }

  setState(state: MusicStoryState): void {
    this.state$.next(state);
  }

  snapshot(): MusicStoryState {
    return this.state$.value;
  }
}

const hardware: HardwareProfile = {
  gpuAvailable: true,
  gpuName: 'NVIDIA GeForce RTX 3080',
  vramTotalGb: 10,
};

const musicGenProvider: MusicProviderDefinition = {
  id: 'musicgen',
  name: 'MusicGen',
  description: 'Local Meta AudioCraft MusicGen runtime',
  runtimeInstalled: true,
  imageName: 'harmonia/musicgen:dev',
  dockerService: 'musicgen',
  containerName: 'harmonia-musicgen',
  composeProfile: 'model-musicgen',
};

const musicGenSmall: MusicModelCatalogEntry = {
  id: 'musicgen-small',
  providerId: 'musicgen',
  providerName: 'MusicGen',
  name: 'MusicGen Small',
  modelSize: '300M',
  availability: 'installed',
  minVramGb: 4,
  recommendedVramGb: 8,
  maxDurationSeconds: 120,
  capabilities: ['text-to-music', 'instrumental'],
  runtimeCost: 'local-free',
  commercialUse: 'review-required',
  notes: 'Storybook runtime fixture',
  hardwareFit: 'recommended',
  selectable: true,
  disabledReason: null,
};

const musicGenMedium: MusicModelCatalogEntry = {
  id: 'musicgen-medium',
  providerId: 'musicgen',
  providerName: 'MusicGen',
  name: 'MusicGen Medium',
  modelSize: '1.5B',
  availability: 'installed',
  minVramGb: 16,
  recommendedVramGb: 20,
  maxDurationSeconds: 120,
  capabilities: ['text-to-music', 'instrumental'],
  runtimeCost: 'local-free',
  commercialUse: 'review-required',
  notes: 'Visible but unavailable on the 10 GB Storybook hardware fixture',
  hardwareFit: 'unsupported',
  selectable: false,
  disabledReason: 'Requires at least 16 GB VRAM.',
};

const readyStatus: MusicRuntimeStatus = {
  providerId: 'musicgen',
  providerName: 'MusicGen',
  modelId: 'musicgen-small',
  modelName: 'MusicGen Small',
  state: 'ready',
  message: 'MusicGen Small runtime is ready.',
  healthy: true,
  progress: 100,
  hardware,
  updatedAt: '2026-09-23T18:30:13.692Z',
  error: null,
};

const buildingStatus: MusicRuntimeStatus = {
  ...readyStatus,
  state: 'building',
  message: 'Building MusicGen runtime image...',
  healthy: false,
  progress: 42,
};

function storyState(
  status: MusicRuntimeStatus,
  jobs: JobsState = initialJobsState
): MusicStoryState {
  return {
    auth: {
      ...initialAuthState,
      token: 'storybook-test-token',
      isAuthenticated: true,
    },
    musicRuntime: {
      providers: [musicGenProvider],
      models: [musicGenSmall, musicGenMedium],
      hardware,
      status,
      selectedProviderId: 'musicgen',
      selectedModelId: 'musicgen-small',
      loading: false,
      switching: status.state === 'building',
      error: null,
    },
    jobs,
  };
}

function jobsWith(job: Job): JobsState {
  return {
    ...initialJobsState,
    ids: [job.id],
    entities: {
      [job.id]: job,
    },
    selectedJobId: job.id,
  };
}

const readyStore = new MusicStoryStore(storyState(readyStatus));
const buildingStore = new MusicStoryStore(storyState(buildingStatus));

const completedStore = new MusicStoryStore(
  storyState(readyStatus),
  (action, store) => {
    if (action?.type !== JobsActions.createJob.type) {
      return;
    }

    const completedJob: Job = {
      id: 'storybook-musicgen-job',
      jobType: 'generate',
      status: 'completed',
      priority: 0,
      userId: 'storybook-user',
      modelId: 'musicgen-small',
      parameters: action.parameters,
      progress: {
        current: 100,
        total: 100,
        percentage: 100,
        message: 'Completed',
      },
      result: {
        outputPath:
          '/downloads/jobs/storybook-musicgen-job/music.wav',
      },
      createdAt: '2026-09-23T18:30:13.692Z',
      startedAt: '2026-09-23T18:30:14.000Z',
      completedAt: '2026-09-23T18:30:22.000Z',
      estimatedDuration: null,
    };

    window.setTimeout(() => {
      const current = store.snapshot();
      store.setState({
        ...current,
        jobs: jobsWith(completedJob),
      });
    }, 50);
  }
);

const router = {
  getCurrentNavigation: () => null,
  navigate: fn(),
};

const websocket = {
  connect: fn(),
  subscribeToJob: fn(),
  unsubscribeFromJob: fn(),
};

const snackBar = {
  open: fn(),
};

const withStore = (store: MusicStoryStore) =>
  moduleMetadata({
    providers: [{ provide: Store, useValue: store }],
  });

const meta: Meta<MusicGenerationPageComponent> = {
  title: 'Actual UI/Music/Music Generation',
  component: MusicGenerationPageComponent,
  tags: ['autodocs'],
  decorators: [
    applicationConfig({
      providers: [provideNoopAnimations()],
    }),
    moduleMetadata({
      imports: [MusicGenerationModule],
      providers: [
        { provide: Router, useValue: router },
        { provide: WebSocketService, useValue: websocket },
        { provide: MatSnackBar, useValue: snackBar },
      ],
    }),
  ],
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<MusicGenerationPageComponent>;

export const RuntimeReady: Story = {
  decorators: [withStore(readyStore)],
  play: async ({ canvas }) => {
    await expect(
      canvas.getByText('NVIDIA GeForce RTX 3080')
    ).toBeVisible();
    await expect(canvas.getByText(/10\.0 GB VRAM detected/i)).toBeVisible();
    await expect(canvas.getByText('Ready')).toBeVisible();
    await expect(
      canvas.getByRole('button', { name: /generate music/i })
    ).toBeDisabled();
  },
};

export const GenerateMusicDispatchesPersistentJob: Story = {
  decorators: [withStore(readyStore)],
  play: async ({ canvas, userEvent }) => {
    readyStore.dispatchSpy.mockClear();

    const title = canvas.getByPlaceholderText('Enter music title');
    const generate = canvas.getByRole('button', {
      name: /generate music/i,
    });

    await userEvent.type(title, 'Storybook Rock Demo');

    await expect(generate).toBeEnabled();
    await userEvent.click(generate);

    await expect(readyStore.dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: JobsActions.createJob.type,
        jobType: 'generate',
        modelId: 'musicgen-small',
        parameters: expect.objectContaining({
          title: 'Storybook Rock Demo',
          genre: 'pop',
          mood: 'calm',
          duration: 30,
          bpm: 120,
        }),
      })
    );

    await expect(canvas.getByText('Generating Audio...')).toBeVisible();
    await expect(canvas.getByText('0% complete')).toBeVisible();
    await expect(
      canvas.getByRole('button', { name: /generating/i })
    ).toBeDisabled();
  },
};

export const RuntimeNotReadyPreventsGeneration: Story = {
  decorators: [withStore(buildingStore)],
  play: async ({ canvas, userEvent }) => {
    buildingStore.dispatchSpy.mockClear();
    snackBar.open.mockClear();

    await userEvent.type(
      canvas.getByPlaceholderText('Enter music title'),
      'Blocked Generation'
    );

    const startModelButton = canvas.getByRole('button', {
      name: /select \/ start model/i,
    });

    await expect(startModelButton).toBeEnabled();
    await userEvent.click(startModelButton);

    await expect(snackBar.open).toHaveBeenCalledWith(
      'Select a compatible model and wait for its runtime to become ready.',
      'Close',
      { duration: 5000 }
    );

    await expect(buildingStore.dispatchSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({
        type: JobsActions.createJob.type,
      })
    );
  },
};

export const CompletedGenerationShowsAudioPlayer: Story = {
  decorators: [withStore(completedStore)],
  play: async ({ canvas, canvasElement, userEvent }) => {
    completedStore.dispatchSpy.mockClear();

    await userEvent.type(
      canvas.getByPlaceholderText('Enter music title'),
      'Completed Storybook Demo'
    );

    await userEvent.click(
      canvas.getByRole('button', { name: /generate music/i })
    );

    await expect(
      await canvas.findByText('Generation Complete!')
    ).toBeVisible();

    const audio = canvasElement.querySelector('audio');

    await expect(audio).not.toBeNull();
    await expect(audio).toHaveAttribute(
      'src',
      '/downloads/jobs/storybook-musicgen-job/music.wav'
    );

    await expect(
      canvas.getByRole('button', { name: /download audio file/i })
    ).toBeVisible();
  },
};
