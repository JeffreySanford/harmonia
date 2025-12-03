import { NgModule, provideBrowserGlobalErrorListeners, isDevMode } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { RouterModule } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { StoreModule } from '@ngrx/store';
import { EffectsModule } from '@ngrx/effects';
import { StoreDevtoolsModule } from '@ngrx/store-devtools';
import { App } from './app';
import { appRoutes } from './app.routes';
import { AppMaterialModule } from './app-material.module';

// Reducers
import { authReducer } from './store/auth/auth.reducer';
import { modelsReducer } from './store/models/models.reducer';
import { datasetsReducer } from './store/datasets/datasets.reducer';
import { jobsReducer } from './store/jobs/jobs.reducer';

// Effects
import { AuthEffects } from './store/auth/auth.effects';
import { ModelsEffects } from './store/models/models.effects';
import { DatasetsEffects } from './store/datasets/datasets.effects';
import { JobsEffects } from './store/jobs/jobs.effects';

@NgModule({
  declarations: [App],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    HttpClientModule,
    AppMaterialModule,
    RouterModule.forRoot(appRoutes),
    StoreModule.forRoot(
      {
        auth: authReducer,
        models: modelsReducer,
        datasets: datasetsReducer,
        jobs: jobsReducer,
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
    ]),
    StoreDevtoolsModule.instrument({
      maxAge: 25,
      logOnly: !isDevMode(),
      autoPause: true,
      trace: false,
      traceLimit: 75,
    }),
  ],
  providers: [provideBrowserGlobalErrorListeners()],
  exports: [RouterModule],
  bootstrap: [App],
})
export class AppModule {}
