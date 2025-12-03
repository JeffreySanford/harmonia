import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LibraryRoutingModule } from './library-routing.module';
import { LibraryComponent } from './library.component';
import { LibraryMaterialModule } from './library-material.module';

/**
 * Library Feature Module
 * 
 * Manages user's personal music library with:
 * - File listing (grid/list views)
 * - Audio playback
 * - File upload
 * - File management (delete, rename)
 * - Pagination and filtering
 * 
 * **State Management**: Uses NGRX LibraryState (to be implemented)
 * 
 * @see {@link file://./docs/USER_LIBRARY.md} for complete specification
 */
@NgModule({
  declarations: [
    LibraryComponent
  ],
  imports: [
    CommonModule,
    LibraryRoutingModule,
    LibraryMaterialModule
  ]
})
export class LibraryModule { }
