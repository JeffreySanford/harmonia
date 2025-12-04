import { platformBrowser } from '@angular/platform-browser';
import { AppModule } from './app/app-module';

// Reducers
// NOTE: reducer and effect imports removed because we're using module-based bootstrap in `AppModule`

platformBrowser()
  .bootstrapModule(AppModule, {
    ngZoneEventCoalescing: true,
  })
  .catch((err) => console.error(err));
