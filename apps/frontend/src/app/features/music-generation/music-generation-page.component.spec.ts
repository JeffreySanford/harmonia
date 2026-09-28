import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import {
  Observable,
  Subject,
} from 'rxjs';

import { JobsService } from '../../services/jobs.service';
import { WebSocketService } from '../../services/websocket.service';
import {
  MusicRuntimeStatus,
} from '../../store/music-runtime/music-runtime.state';
import {
  MusicGenerationPageComponent,
} from './music-generation-page.component';

describe(
  'MusicGenerationPageComponent protected artifact lifecycle',
  () => {
    let component: MusicGenerationPageComponent;

    let artifactStreams:
      Record<string, Subject<Blob>>;

    let objectUrls:
      Map<Blob, string>;

    const router = {
      getCurrentNavigation:
        jest.fn().mockReturnValue(null),
      navigate: jest.fn(),
    };

    const store = {
      select: jest.fn(),
      dispatch: jest.fn(),
    };

    const websocket = {
      connect: jest.fn(),
      subscribeToJob: jest.fn(),
      unsubscribeFromJob: jest.fn(),
    };

    const snackBar = {
      open: jest.fn(),
    };

    const jobsService = {
      getArtifact: jest.fn(
        (id: string): Observable<Blob> => {
          const stream = artifactStreams[id];

          if (!stream) {
            throw new Error(
              `Missing artifact stream for ${id}`
            );
          }

          return stream;
        }
      ),
    };

    const originalCreateObjectUrl =
      Object.getOwnPropertyDescriptor(
        URL,
        'createObjectURL'
      );

    const originalRevokeObjectUrl =
      Object.getOwnPropertyDescriptor(
        URL,
        'revokeObjectURL'
      );

    const createObjectUrl = jest.fn(
      (blob: Blob): string =>
        objectUrls.get(blob) ??
        'blob:unexpected'
    );

    const revokeObjectUrl =
      jest.fn();

    function loadArtifact(
      jobId: string
    ): void {
      component[
        'loadGeneratedArtifact'
      ](jobId);
    }

    beforeEach(() => {
      artifactStreams = {};
      objectUrls = new Map();

      jest.clearAllMocks();

      Object.defineProperty(
        URL,
        'createObjectURL',
        {
          configurable: true,
          value: createObjectUrl,
        }
      );

      Object.defineProperty(
        URL,
        'revokeObjectURL',
        {
          configurable: true,
          value: revokeObjectUrl,
        }
      );

      TestBed.configureTestingModule({
        providers: [
          {
            provide: Router,
            useValue: router,
          },
          {
            provide: Store,
            useValue: store,
          },
          {
            provide: WebSocketService,
            useValue: websocket,
          },
          {
            provide: JobsService,
            useValue: jobsService,
          },
          {
            provide: MatSnackBar,
            useValue: snackBar,
          },
        ],
      });

      component =
        TestBed.runInInjectionContext(
          () =>
            new MusicGenerationPageComponent()
        );
    });

    afterEach(() => {
      TestBed.resetTestingModule();

      if (originalCreateObjectUrl) {
        Object.defineProperty(
          URL,
          'createObjectURL',
          originalCreateObjectUrl
        );
      } else {
        Reflect.deleteProperty(
          URL,
          'createObjectURL'
        );
      }

      if (originalRevokeObjectUrl) {
        Object.defineProperty(
          URL,
          'revokeObjectURL',
          originalRevokeObjectUrl
        );
      } else {
        Reflect.deleteProperty(
          URL,
          'revokeObjectURL'
        );
      }
    });

    it(
      'ignores an older artifact response that arrives after its replacement',
      () => {
        const older =
          new Subject<Blob>();

        const newer =
          new Subject<Blob>();

        artifactStreams = {
          older,
          newer,
        };

        const olderBlob =
          new Blob(['older']);

        const newerBlob =
          new Blob(['newer']);

        objectUrls.set(
          olderBlob,
          'blob:older'
        );

        objectUrls.set(
          newerBlob,
          'blob:newer'
        );

        loadArtifact('older');
        loadArtifact('newer');

        newer.next(newerBlob);

        expect(
          component.generatedAudioUrl
        ).toBe('blob:newer');

        older.next(olderBlob);

        expect(
          component.generatedAudioUrl
        ).toBe('blob:newer');

        expect(
          createObjectUrl
        ).toHaveBeenCalledTimes(1);

        expect(
          createObjectUrl
        ).toHaveBeenCalledWith(
          newerBlob
        );
      }
    );

    it(
      'ignores an error from a replaced artifact request',
      () => {
        const older =
          new Subject<Blob>();

        const newer =
          new Subject<Blob>();

        artifactStreams = {
          older,
          newer,
        };

        const newerBlob =
          new Blob(['newer']);

        objectUrls.set(
          newerBlob,
          'blob:newer'
        );

        loadArtifact('older');
        loadArtifact('newer');

        newer.next(newerBlob);

        snackBar.open.mockClear();

        older.error(
          new Error(
            'late obsolete request failure'
          )
        );

        expect(
          component.generatedAudioUrl
        ).toBe('blob:newer');

        expect(
          snackBar.open
        ).not.toHaveBeenCalled();
      }
    );

    it(
      'cancels a pending artifact request when the component is destroyed',
      () => {
        const pending =
          new Subject<Blob>();

        artifactStreams = {
          pending,
        };

        const blob =
          new Blob(['late']);

        objectUrls.set(
          blob,
          'blob:late'
        );

        loadArtifact('pending');

        component.ngOnDestroy();

        pending.next(blob);

        expect(
          createObjectUrl
        ).not.toHaveBeenCalled();

        expect(
          component.generatedAudioUrl
        ).toBeNull();
      }
    );

    it(
      'cancels a pending artifact request when replacement generation begins',
      () => {
        const pending =
          new Subject<Blob>();

        artifactStreams = {
          pending,
        };

        const staleBlob =
          new Blob(['stale']);

        objectUrls.set(
          staleBlob,
          'blob:stale'
        );

        loadArtifact('pending');

        component.musicTitle =
          'Replacement generation';

        component.genre = 'rock';

        component.selectedModelId =
          'musicgen-small';

        component.selectedProviderId =
          'musicgen';

        component.runtimeStatus = {
          operationId: null,
          providerId: 'musicgen',
          providerName: 'MusicGen',
          modelId: 'musicgen-small',
          modelName: 'MusicGen Small',
          state: 'ready',
          message: 'Ready',
          healthy: true,
          progress: 100,
          hardware: {
            gpuAvailable: true,
            gpuName: 'Test GPU',
            vramTotalGb: 8,
          },
          updatedAt:
            '2026-09-26T20:00:00.000Z',
          error: null,
        } as MusicRuntimeStatus;

        component.generateMusic();

        expect(
          store.dispatch
        ).toHaveBeenCalled();

        pending.next(staleBlob);

        expect(
          createObjectUrl
        ).not.toHaveBeenCalled();

        expect(
          component.generatedAudioUrl
        ).toBeNull();
      }
    );
  }
);
