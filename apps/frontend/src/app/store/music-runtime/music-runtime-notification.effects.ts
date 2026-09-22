import { inject, Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { tap } from 'rxjs/operators';
import * as MusicRuntimeActions from './music-runtime.actions';
import { MusicRuntimeStatus } from './music-runtime.state';

@Injectable()
export class MusicRuntimeNotificationEffects {
  private readonly actions$ = inject(Actions);
  private readonly snackBar = inject(MatSnackBar);

  private activeRef: { dismiss(): void } | null = null;
  private lastStatusKey = '';

  runtimeStatus$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(MusicRuntimeActions.runtimeStatusReceived),
        tap(({ status }) => this.showStatus(status))
      ),
    { dispatch: false }
  );

  failures$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(
          MusicRuntimeActions.selectModelFailure,
          MusicRuntimeActions.stopRuntimeFailure,
          MusicRuntimeActions.loadCatalogFailure
        ),
        tap(({ error }) => {
          this.activeRef?.dismiss();
          this.activeRef = this.snackBar.open(error, 'Close', {
            duration: 0,
          });
        })
      ),
    { dispatch: false }
  );

  private showStatus(status: MusicRuntimeStatus): void {
    const key = `${status.providerId}:${status.modelId}:${status.state}:${status.message}`;
    if (key === this.lastStatusKey) {
      return;
    }
    this.lastStatusKey = key;

    const label = status.modelName || status.providerName || 'Music runtime';
    const message = `${label}: ${status.message}`;

    this.activeRef?.dismiss();

    const terminal = ['ready', 'stopped'].includes(status.state);
    const healthMilestone = status.state === 'healthy';

    this.activeRef = this.snackBar.open(message, terminal ? 'OK' : 'Close', {
      duration: terminal ? 4500 : healthMilestone ? 1800 : 0,
    });
  }
}
