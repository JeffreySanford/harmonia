import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LibraryComponent } from './library.component';

const routes: Routes = [
  {
    path: '',
    component: LibraryComponent
  }
];

/**
 * Library Routing Module
 * 
 * Routes for user's music library feature.
 * 
 * **Routes**:
 * - `/library` - Main library view with file list
 * 
 * **Future Routes**:
 * - `/library/:id` - Individual file detail view
 * - `/library/upload` - File upload page
 */
@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class LibraryRoutingModule { }
