import { NgModule } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';

/**
 * Material Design modules used in the root App component.
 *
 * This module centralizes Material imports for the app-level layout including
 * header, footer, and sidebar navigation.
 *
 * **Components Included**:
 * - `MatCardModule` (2 KB) - Layout cards for sections
 * - `MatIconModule` (1.5 KB) - Icons for sidebar navigation and header
 * - `MatButtonModule` (3 KB) - Login/logout buttons in header
 * - `MatButtonToggleModule` (2 KB) - Mode selection toggles
 *
 * **Total Bundle Size**: ~8.5 KB
 *
 * **Usage**: Imported in `AppModule` for app-wide Material components.
 *
 * **Tree-Shaking**: Only these components are included in the main app bundle.
 * Feature-specific Material components are loaded lazily with their routes.
 *
 * @see {@link file://./docs/MATERIAL_MODULES.md} for architecture documentation
 */
@NgModule({
  imports: [
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatButtonToggleModule,
  ],
  exports: [
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatButtonToggleModule,
  ],
})
export class AppMaterialModule {}
