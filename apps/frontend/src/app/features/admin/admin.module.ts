import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminRoutingModule } from './admin-routing.module';
import { AdminComponent } from './admin.component';
import { AdminMaterialModule } from './admin-material.module';

/**
 * Admin Feature Module
 * 
 * Admin dashboard for platform management:
 * - User management (CRUD operations)
 * - File tracking and statistics
 * - Audit log viewer
 * - Performance metrics and monitoring
 * - Real-time updates via WebSocket
 * 
 * **Access**: Admin role required
 * **State Management**: Uses NGRX AdminState (to be implemented)
 * 
 * @see {@link file://./docs/ADMIN_DASHBOARD.md} for complete specification
 */
@NgModule({
  declarations: [
    AdminComponent
  ],
  imports: [
    CommonModule,
    AdminRoutingModule,
    AdminMaterialModule
  ]
})
export class AdminModule { }
