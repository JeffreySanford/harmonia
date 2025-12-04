import { inject, Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { of } from 'rxjs';
import { catchError, map, mergeMap } from 'rxjs/operators';
import { ProfileService } from '../../services/profile.service';
import * as ProfileActions from './profile.state';

@Injectable()
export class ProfileEffects {
  private readonly actions$ = inject(Actions);
  private readonly profileService = inject(ProfileService);

  loadProfile$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ProfileActions.loadProfile),
      mergeMap(() =>
        this.profileService.getProfile().pipe(
          map((profile) => ProfileActions.loadProfileSuccess({ profile })),
          catchError((error) =>
            of(ProfileActions.loadProfileFailure({ error: error.message }))
          )
        )
      )
    )
  );

  updateProfile$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ProfileActions.updateProfile),
      mergeMap(({ profile }) =>
        this.profileService.updateProfile(profile).pipe(
          map((updatedProfile) =>
            ProfileActions.updateProfileSuccess({ profile: updatedProfile })
          ),
          catchError((error) =>
            of(ProfileActions.updateProfileFailure({ error: error.message }))
          )
        )
      )
    )
  );

  changePassword$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ProfileActions.changePassword),
      mergeMap(({ currentPassword, newPassword }) =>
        this.profileService
          .changePassword({ currentPassword, newPassword })
          .pipe(
            map((response) =>
              ProfileActions.changePasswordSuccess({
                message: response.message,
              })
            ),
            catchError((error) =>
              of(ProfileActions.changePasswordFailure({ error: error.message }))
            )
          )
      )
    )
  );

  uploadAvatar$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ProfileActions.uploadAvatar),
      mergeMap(({ avatar }) =>
        this.profileService.uploadAvatar({ avatar }).pipe(
          map((profile) => ProfileActions.uploadAvatarSuccess({ profile })),
          catchError((error) =>
            of(ProfileActions.uploadAvatarFailure({ error: error.message }))
          )
        )
      )
    )
  );

  deleteAccount$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ProfileActions.deleteAccount),
      mergeMap(() =>
        this.profileService.deleteAccount().pipe(
          map((response) =>
            ProfileActions.deleteAccountSuccess({ message: response.message })
          ),
          catchError((error) =>
            of(ProfileActions.deleteAccountFailure({ error: error.message }))
          )
        )
      )
    )
  );
}
