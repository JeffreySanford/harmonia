import { NgModule, provideBrowserGlobalErrorListeners } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { RouterModule } from '@angular/router';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { StoreModule } from '@ngrx/store';
import { EffectsModule } from '@ngrx/effects';
import { StoreDevtoolsModule } from '@ngrx/store-devtools';
import { App } from './app';
import { appRoutes } from './app.routes';
import { AppMaterialModule } from './app-material.module';
import { AuthModule } from './features/auth/auth.module';
import { AuthInterceptor } from './interceptors/auth.interceptor';

// Reducers
import { authReducer } from './store/auth/auth.reducer';
import { modelsReducer } from './store/models/models.reducer';
import { datasetsReducer } from './store/datasets/datasets.reducer';
import { jobsReducer } from './store/jobs/jobs.reducer';
import { libraryReducer } from './store/library/library.state';
import { profileReducer } from './store/profile/profile.state';
import { songGenerationReducer } from './store/song-generation/song-generation.reducer';

// Effects
import { AuthEffects } from './store/auth/auth.effects';
import { ModelsEffects } from './store/models/models.effects';
import { DatasetsEffects } from './store/datasets/datasets.effects';
import { JobsEffects } from './store/jobs/jobs.effects';
import { LibraryEffects } from './store/library/library.effects';
import { ProfileEffects } from './store/profile/profile.effects';
import { SongGenerationEffects } from './store/song-generation/song-generation.effects';

@NgModule({
  declarations: [App],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    HttpClientModule,
    AppMaterialModule,
    AuthModule,
    RouterModule.forRoot(appRoutes),
    StoreModule.forRoot(
      {
        auth: authReducer,
        models: modelsReducer,
        datasets: datasetsReducer,
        jobs: jobsReducer,
        library: libraryReducer,
        profile: profileReducer,
        songGeneration: songGenerationReducer,
      },
      {
        runtimeChecks: {
          strictStateImmutability: true,
          strictActionImmutability: true,
          strictStateSerializability: true,
          strictActionSerializability: true,
          strictActionWithinNgZone: true,
          strictActionTypeUniqueness: true,
        },
      }
    ),
    EffectsModule.forRoot([
      AuthEffects,
      ModelsEffects,
      DatasetsEffects,
      JobsEffects,
      LibraryEffects,
      ProfileEffects,
      SongGenerationEffects,
    ]),
    StoreDevtoolsModule.instrument({
      maxAge: 25,
      logOnly: false,
      autoPause: true,
      trace: false,
      traceLimit: 75,
    }),
  ],
  providers: [
    provideBrowserGlobalErrorListeners(),
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptor,
      multi: true,
    },
  ],
  exports: [RouterModule],
  bootstrap: [App],
})
export class AppModule {}
