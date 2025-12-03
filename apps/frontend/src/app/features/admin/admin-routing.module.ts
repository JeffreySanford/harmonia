import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AdminComponent } from './admin.component';

const routes: Routes = [
  {
    path: '',
    component: AdminComponent
  }
];

/**
 * Admin Routing Module
 * 
 * Routes for admin dashboard and management.
 * 
 * **Routes**:
 * - `/admin` - Admin dashboard overview
 * 
 * **Future Routes**:
 * - `/admin/users` - User management
 * - `/admin/files` - File tracking
 * - `/admin/logs` - Audit logs
 * - `/admin/metrics` - Performance metrics
 */
@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AdminRoutingModule { }
