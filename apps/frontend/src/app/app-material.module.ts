import { NgModule } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

/**
 * Material Design modules used in the root App component
 * Only imports what's needed for tree-shaking optimization
 */
@NgModule({
  imports: [
    MatCardModule,
    MatIconModule,
  ],
  exports: [
    MatCardModule,
    MatIconModule,
  ]
})
export class AppMaterialModule { }
