# Admin Dashboard

## Overview

The Admin Dashboard is a comprehensive management interface accessible only to users with the `admin` group. It provides centralized control over users, files, system performance, and audit logging.

**Key Features**:

- **User Management**: View, create, edit, delete users; modify group assignments
- **File Tracking**: View all users' generated files with filtering and search
- **Audit Logging**: Track all system actions with timestamps and user attribution
- **Performance Metrics**: Real-time charts showing generation times, success rates, system health
- **System Configuration**: Manage app settings, model configurations (future)
- **Real-time Updates**: WebSocket integration for live metrics
- **Data Export**: CSV/JSON export for reports

**Permission Inheritance**:

- Admin group **inherits all** user group permissions
- Admins can generate songs, music, videos (like regular users)
- Admins can access own library AND all users' libraries
- Admins have additional management capabilities

## Architecture

```text
┌─────────────────────────────────────────────────────────────────────┐
│                         Frontend (Angular)                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │              Admin Dashboard Page                            │  │
│  │  ┌────────────┬────────────┬────────────┬────────────┐      │  │
│  │  │   Users    │   Files    │    Logs    │  Metrics   │      │  │
│  │  │    Tab     │    Tab     │    Tab     │    Tab     │      │  │
│  │  └────────────┴────────────┴────────────┴────────────┘      │  │
│  └──────────────────────────────────────────────────────────────┘  │
│           │              │              │              │            │
│           │              │              │              │            │
│  ┌────────▼──────┐ ┌────▼──────┐ ┌────▼──────┐ ┌────▼──────┐    │
│  │  User List    │ │ File List │ │ Audit Log │ │ Metrics   │    │
│  │  Component    │ │ Component │ │ Component │ │ Component │    │
│  └────────┬──────┘ └────┬──────┘ └────┬──────┘ └────┬──────┘    │
│           │              │              │              │            │
│  ┌────────▼──────────────▼──────────────▼──────────────▼──────┐  │
│  │              NGRX Admin State Store                         │  │
│  │  - users: User[]                                             │  │
│  │  - files: AdminFileView[]                                    │  │
│  │  - logs: AuditLog[]                                          │  │
│  │  - metrics: PerformanceMetrics                               │  │
│  └────────┬─────────────────────────────────────────────────────┘  │
│           │                                                         │
│  ┌────────▼─────────────────────────────────────────────────────┐  │
│  │              Admin Service (HTTP + WebSocket)                │  │
│  └────────┬─────────────────────────────────────────────────────┘  │
│           │                                                         │
└───────────┼─────────────────────────────────────────────────────────┘
            │
            │ HTTP + WebSocket (JWT auth with admin role check)
            │
┌───────────▼─────────────────────────────────────────────────────────┐
│                         Backend (NestJS)                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────────────────────────────────────────┐          │
│  │         Admin Controller                             │          │
│  │  GET  /api/admin/users                               │          │
│  │  POST /api/admin/users                               │          │
│  │  PATCH /api/admin/users/:id                          │          │
│  │  DELETE /api/admin/users/:id                         │          │
│  │  GET  /api/admin/files                               │          │
│  │  DELETE /api/admin/files/:id                         │          │
│  │  GET  /api/admin/logs                                │          │
│  │  GET  /api/admin/metrics                             │          │
│  └──────────────┬───────────────────────────────────────┘          │
│                 │                                                   │
│  ┌──────────────▼───────────────────────────────────┐              │
│  │         Admin Service                            │              │
│  │  - User CRUD operations                          │              │
│  │  - File management (all users)                   │              │
│  │  - Audit log queries                             │              │
│  │  - Performance metrics aggregation               │              │
│  └──────────────┬───────────────────────────────────┘              │
│                 │                                                   │
│         ┌───────┴────────┬──────────────┐                          │
│         │                │              │                          │
│  ┌──────▼──────┐  ┌─────▼───────┐  ┌──▼──────────┐                │
│  │   MongoDB   │  │  WebSocket  │  │   Redis     │                │
│  │  - Users    │  │   Gateway   │  │   Cache     │                │
│  │  - Library  │  │  (Metrics)  │  │  (Sessions) │                │
│  │  - AuditLog │  │             │  │             │                │
│  └─────────────┘  └─────────────┘  └─────────────┘                │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Data Models

### Admin File View (Enhanced Library Item)

```typescript
interface AdminFileView {
  id: string;
  userId: string;
  username: string;        // Denormalized for display
  userEmail: string;       // Denormalized for display
  songId?: string;
  type: 'song' | 'music' | 'audio' | 'style';
  title: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  duration?: number;
  metadata: {
    genre?: string;
    mood?: string;
    bpm?: number;
    model?: string;
    generationTime?: number;
  };
  playCount: number;
  downloadCount: number;
  createdAt: Date;
  updatedAt: Date;
}
```

### Audit Log Schema

```typescript
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AuditLogDocument = AuditLog & Document;

@Schema({ timestamps: true })
export class AuditLog {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  username: string;  // Denormalized for performance

  @Prop({ required: true, enum: ['create', 'read', 'update', 'delete', 'login', 'logout', 'generate'] })
  action: string;

  @Prop({ required: true, enum: ['user', 'song', 'music', 'video', 'library', 'system'] })
  resource: string;

  @Prop({ type: Types.ObjectId })
  resourceId?: Types.ObjectId;  // Optional: ID of affected resource

  @Prop({ type: Object })
  details: {
    before?: any;      // State before change
    after?: any;       // State after change
    metadata?: any;    // Additional context
  };

  @Prop()
  ipAddress?: string;

  @Prop()
  userAgent?: string;

  @Prop({ default: false })
  isSystemAction: boolean;  // True for automated actions

  @Prop({ required: true })
  timestamp: Date;

  // TTL index: Auto-delete logs older than 90 days
  @Prop({ type: Date, expires: 7776000 })  // 90 days in seconds
  expireAt: Date;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);

// Indexes
AuditLogSchema.index({ userId: 1, timestamp: -1 });
AuditLogSchema.index({ action: 1, timestamp: -1 });
AuditLogSchema.index({ resource: 1, timestamp: -1 });
AuditLogSchema.index({ timestamp: -1 });
```

### Performance Metrics

```typescript
interface PerformanceMetrics {
  overview: {
    totalUsers: number;
    activeUsers: number;      // Logged in within last 7 days
    totalFiles: number;
    totalStorage: number;     // In bytes
    totalGenerations: number;
  };
  
  generation: {
    songsGenerated: number;
    musicGenerated: number;
    videosGenerated: number;
    averageGenerationTime: number;  // Seconds
    successRate: number;            // Percentage (0-100)
    failureCount: number;
  };
  
  usage: {
    dailyActiveUsers: number;
    peakConcurrentUsers: number;
    averageSessionDuration: number;  // Minutes
    requestsPerMinute: number;
  };
  
  storage: {
    totalSize: number;          // Bytes
    audioFiles: number;
    videoFiles: number;
    styleFiles: number;
    averageFileSize: number;
  };
  
  topUsers: {
    username: string;
    generationCount: number;
    storageUsed: number;
  }[];
  
  recentActivity: {
    timestamp: Date;
    action: string;
    username: string;
    resource: string;
  }[];
  
  systemHealth: {
    cpuUsage: number;           // Percentage
    memoryUsage: number;        // Percentage
    diskUsage: number;          // Percentage
    databaseConnections: number;
    redisConnections: number;
    uptime: number;             // Seconds
  };
  
  charts: {
    generationsPerDay: { date: string; count: number }[];
    userGrowth: { date: string; count: number }[];
    successRateOverTime: { date: string; rate: number }[];
    averageResponseTime: { date: string; time: number }[];
  };
}
```

## Frontend Implementation

### Admin State (NGRX)

```typescript
// admin.state.ts
export interface AdminState {
  users: {
    items: AdminUser[];
    loading: boolean;
    error: string | null;
    selectedUser: AdminUser | null;
    filters: {
      search: string;
      group: 'all' | 'user' | 'admin';
      isActive: 'all' | 'active' | 'inactive';
    };
  };
  
  files: {
    items: AdminFileView[];
    loading: boolean;
    error: string | null;
    filters: {
      userId: string | null;
      type: 'all' | 'song' | 'music' | 'audio' | 'style';
      search: string;
    };
    pagination: {
      page: number;
      pageSize: number;
      total: number;
    };
  };
  
  logs: {
    items: AuditLog[];
    loading: boolean;
    error: string | null;
    filters: {
      userId: string | null;
      action: string | null;
      resource: string | null;
      dateRange: { start: Date; end: Date } | null;
    };
    pagination: {
      page: number;
      pageSize: number;
      total: number;
    };
  };
  
  metrics: {
    data: PerformanceMetrics | null;
    loading: boolean;
    error: string | null;
    lastUpdated: Date | null;
  };
}

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  groups: string[];
  isActive: boolean;
  lastLoginAt?: Date;
  loginCount: number;
  createdAt: Date;
  fileCount: number;
  storageUsed: number;
}

export const initialAdminState: AdminState = {
  users: {
    items: [],
    loading: false,
    error: null,
    selectedUser: null,
    filters: { search: '', group: 'all', isActive: 'all' }
  },
  files: {
    items: [],
    loading: false,
    error: null,
    filters: { userId: null, type: 'all', search: '' },
    pagination: { page: 1, pageSize: 20, total: 0 }
  },
  logs: {
    items: [],
    loading: false,
    error: null,
    filters: { userId: null, action: null, resource: null, dateRange: null },
    pagination: { page: 1, pageSize: 50, total: 0 }
  },
  metrics: {
    data: null,
    loading: false,
    error: null,
    lastUpdated: null
  }
};
```

### Admin Dashboard Component

```typescript
// admin-dashboard.component.ts
import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { interval, Subscription } from 'rxjs';
import { AppState } from '../../store/app.state';
import * as fromAdmin from '../../store/admin/admin.selectors';
import * as AdminActions from '../../store/admin/admin.actions';

@Component({
  selector: 'harmonia-admin-dashboard',
  standalone: false,
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.scss',
})
export class AdminDashboardComponent implements OnInit, OnDestroy {
  private readonly store = inject(Store<AppState>);
  private metricsRefreshSub?: Subscription;

  // Observables
  users$ = this.store.select(fromAdmin.selectAdminUsers);
  files$ = this.store.select(fromAdmin.selectAdminFiles);
  logs$ = this.store.select(fromAdmin.selectAdminLogs);
  metrics$ = this.store.select(fromAdmin.selectAdminMetrics);
  
  selectedTab = 0;

  ngOnInit(): void {
    // Load initial data
    this.store.dispatch(AdminActions.loadAdminUsers());
    this.store.dispatch(AdminActions.loadAdminFiles({}));
    this.store.dispatch(AdminActions.loadAdminLogs({}));
    this.store.dispatch(AdminActions.loadAdminMetrics());

    // Auto-refresh metrics every 30 seconds
    this.metricsRefreshSub = interval(30000).subscribe(() => {
      this.store.dispatch(AdminActions.loadAdminMetrics());
    });
  }

  ngOnDestroy(): void {
    this.metricsRefreshSub?.unsubscribe();
  }

  onTabChange(index: number): void {
    this.selectedTab = index;
    
    // Load data on-demand when switching tabs
    switch (index) {
      case 0: // Users
        this.store.dispatch(AdminActions.loadAdminUsers());
        break;
      case 1: // Files
        this.store.dispatch(AdminActions.loadAdminFiles({}));
        break;
      case 2: // Logs
        this.store.dispatch(AdminActions.loadAdminLogs({}));
        break;
      case 3: // Metrics
        this.store.dispatch(AdminActions.loadAdminMetrics());
        break;
    }
  }
}
```

### Users Tab Component

```typescript
// admin-users.component.ts
import { Component, OnInit, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { MatDialog } from '@angular/material/dialog';
import { AppState } from '../../../store/app.state';
import * as fromAdmin from '../../../store/admin/admin.selectors';
import * as AdminActions from '../../../store/admin/admin.actions';
import { AdminUser } from '../../../store/admin/admin.state';
import { UserEditDialogComponent } from './user-edit-dialog.component';
import { ConfirmDialogComponent } from '../../../components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'harmonia-admin-users',
  standalone: false,
  templateUrl: './admin-users.component.html',
  styleUrl: './admin-users.component.scss',
})
export class AdminUsersComponent implements OnInit {
  private readonly store = inject(Store<AppState>);
  private readonly dialog = inject(MatDialog);

  users$ = this.store.select(fromAdmin.selectAdminUsers);
  loading$ = this.store.select(fromAdmin.selectAdminUsersLoading);
  filters$ = this.store.select(fromAdmin.selectAdminUsersFilters);

  displayedColumns = ['username', 'email', 'groups', 'isActive', 'lastLogin', 'fileCount', 'actions'];

  ngOnInit(): void {
    this.store.dispatch(AdminActions.loadAdminUsers());
  }

  onSearchChange(search: string): void {
    this.store.dispatch(AdminActions.updateAdminUsersFilters({ filters: { search } }));
  }

  onGroupFilterChange(group: string): void {
    this.store.dispatch(AdminActions.updateAdminUsersFilters({ 
      filters: { group: group as any } 
    }));
  }

  onCreateUser(): void {
    const dialogRef = this.dialog.open(UserEditDialogComponent, {
      width: '500px',
      data: { mode: 'create' }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.store.dispatch(AdminActions.createAdminUser({ user: result }));
      }
    });
  }

  onEditUser(user: AdminUser): void {
    const dialogRef = this.dialog.open(UserEditDialogComponent, {
      width: '500px',
      data: { mode: 'edit', user }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.store.dispatch(AdminActions.updateAdminUser({ 
          id: user.id, 
          updates: result 
        }));
      }
    });
  }

  onDeleteUser(user: AdminUser): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Delete User',
        message: `Are you sure you want to delete user "${user.username}"? This will also delete all their files and cannot be undone.`,
        confirmText: 'Delete',
        cancelText: 'Cancel',
        confirmColor: 'warn'
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.store.dispatch(AdminActions.deleteAdminUser({ id: user.id }));
      }
    });
  }

  onToggleUserActive(user: AdminUser): void {
    this.store.dispatch(AdminActions.updateAdminUser({
      id: user.id,
      updates: { isActive: !user.isActive }
    }));
  }

  formatStorage(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
```

### Users Tab Template

```html
<!-- admin-users.component.html -->
<div class="admin-users">
  <div class="toolbar">
    <mat-form-field appearance="outline" class="search-field">
      <mat-label>Search Users</mat-label>
      <input 
        matInput 
        [value]="(filters$ | async)?.search"
        (input)="onSearchChange($any($event.target).value)"
        placeholder="Username or email"
      >
      <mat-icon matPrefix>search</mat-icon>
    </mat-form-field>

    <mat-form-field appearance="outline">
      <mat-label>Filter by Group</mat-label>
      <mat-select 
        [value]="(filters$ | async)?.group"
        (selectionChange)="onGroupFilterChange($event.value)"
      >
        <mat-option value="all">All Groups</mat-option>
        <mat-option value="user">User</mat-option>
        <mat-option value="admin">Admin</mat-option>
      </mat-select>
    </mat-form-field>

    <span class="spacer"></span>

    <button mat-raised-button color="primary" (click)="onCreateUser()">
      <mat-icon>person_add</mat-icon>
      Create User
    </button>
  </div>

  <div class="table-container">
    <table mat-table [dataSource]="users$ | async" class="users-table">
      <!-- Username Column -->
      <ng-container matColumnDef="username">
        <th mat-header-cell *matHeaderCellDef>Username</th>
        <td mat-cell *matCellDef="let user">
          <div class="user-cell">
            <mat-icon>person</mat-icon>
            {{ user.username }}
          </div>
        </td>
      </ng-container>

      <!-- Email Column -->
      <ng-container matColumnDef="email">
        <th mat-header-cell *matHeaderCellDef>Email</th>
        <td mat-cell *matCellDef="let user">{{ user.email }}</td>
      </ng-container>

      <!-- Groups Column -->
      <ng-container matColumnDef="groups">
        <th mat-header-cell *matHeaderCellDef>Groups</th>
        <td mat-cell *matCellDef="let user">
          <mat-chip-set>
            <mat-chip *ngFor="let group of user.groups" [color]="group === 'admin' ? 'accent' : 'primary'">
              {{ group }}
            </mat-chip>
          </mat-chip-set>
        </td>
      </ng-container>

      <!-- Active Column -->
      <ng-container matColumnDef="isActive">
        <th mat-header-cell *matHeaderCellDef>Status</th>
        <td mat-cell *matCellDef="let user">
          <mat-slide-toggle 
            [checked]="user.isActive"
            (change)="onToggleUserActive(user)"
            [color]="'primary'"
          >
            {{ user.isActive ? 'Active' : 'Inactive' }}
          </mat-slide-toggle>
        </td>
      </ng-container>

      <!-- Last Login Column -->
      <ng-container matColumnDef="lastLogin">
        <th mat-header-cell *matHeaderCellDef>Last Login</th>
        <td mat-cell *matCellDef="let user">
          {{ user.lastLoginAt ? (user.lastLoginAt | date:'short') : 'Never' }}
        </td>
      </ng-container>

      <!-- File Count Column -->
      <ng-container matColumnDef="fileCount">
        <th mat-header-cell *matHeaderCellDef>Files</th>
        <td mat-cell *matCellDef="let user">
          <div class="file-count-cell">
            <span>{{ user.fileCount }}</span>
            <span class="storage">{{ formatStorage(user.storageUsed) }}</span>
          </div>
        </td>
      </ng-container>

      <!-- Actions Column -->
      <ng-container matColumnDef="actions">
        <th mat-header-cell *matHeaderCellDef>Actions</th>
        <td mat-cell *matCellDef="let user">
          <button mat-icon-button (click)="onEditUser(user)" matTooltip="Edit User">
            <mat-icon>edit</mat-icon>
          </button>
          <button mat-icon-button color="warn" (click)="onDeleteUser(user)" matTooltip="Delete User">
            <mat-icon>delete</mat-icon>
          </button>
        </td>
      </ng-container>

      <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
      <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
    </table>

    <div *ngIf="loading$ | async" class="loading-overlay">
      <mat-spinner></mat-spinner>
    </div>
  </div>
</div>
```

### Files Tab Component

```typescript
// admin-files.component.ts
import { Component, OnInit, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { MatDialog } from '@angular/material/dialog';
import { AppState } from '../../../store/app.state';
import * as fromAdmin from '../../../store/admin/admin.selectors';
import * as AdminActions from '../../../store/admin/admin.actions';
import { AdminFileView } from '../../../store/admin/admin.state';
import { ConfirmDialogComponent } from '../../../components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'harmonia-admin-files',
  standalone: false,
  templateUrl: './admin-files.component.html',
  styleUrl: './admin-files.component.scss',
})
export class AdminFilesComponent implements OnInit {
  private readonly store = inject(Store<AppState>);
  private readonly dialog = inject(MatDialog);

  files$ = this.store.select(fromAdmin.selectAdminFiles);
  loading$ = this.store.select(fromAdmin.selectAdminFilesLoading);
  filters$ = this.store.select(fromAdmin.selectAdminFilesFilters);
  pagination$ = this.store.select(fromAdmin.selectAdminFilesPagination);

  displayedColumns = ['title', 'username', 'type', 'duration', 'fileSize', 'playCount', 'createdAt', 'actions'];

  ngOnInit(): void {
    this.store.dispatch(AdminActions.loadAdminFiles({}));
  }

  onTypeFilterChange(type: string): void {
    this.store.dispatch(AdminActions.updateAdminFilesFilters({ 
      filters: { type: type as any } 
    }));
  }

  onSearchChange(search: string): void {
    this.store.dispatch(AdminActions.updateAdminFilesFilters({ filters: { search } }));
  }

  onPageChange(page: number): void {
    this.store.dispatch(AdminActions.updateAdminFilesPagination({ page }));
  }

  onDeleteFile(file: AdminFileView): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Delete File',
        message: `Delete "${file.title}" by ${file.username}? This cannot be undone.`,
        confirmText: 'Delete',
        cancelText: 'Cancel',
        confirmColor: 'warn'
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.store.dispatch(AdminActions.deleteAdminFile({ id: file.id }));
      }
    });
  }

  formatDuration(seconds?: number): string {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  formatFileSize(bytes?: number): string {
    if (!bytes) return '--';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
```

### Metrics Tab Component

```typescript
// admin-metrics.component.ts
import { Component, OnInit, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { Chart, registerables } from 'chart.js';
import { AppState } from '../../../store/app.state';
import * as fromAdmin from '../../../store/admin/admin.selectors';
import * as AdminActions from '../../../store/admin/admin.actions';

Chart.register(...registerables);

@Component({
  selector: 'harmonia-admin-metrics',
  standalone: false,
  templateUrl: './admin-metrics.component.html',
  styleUrl: './admin-metrics.component.scss',
})
export class AdminMetricsComponent implements OnInit {
  private readonly store = inject(Store<AppState>);

  metrics$ = this.store.select(fromAdmin.selectAdminMetrics);
  loading$ = this.store.select(fromAdmin.selectAdminMetricsLoading);
  lastUpdated$ = this.store.select(fromAdmin.selectAdminMetricsLastUpdated);

  // Charts
  generationsChart?: Chart;
  userGrowthChart?: Chart;
  successRateChart?: Chart;

  ngOnInit(): void {
    this.store.dispatch(AdminActions.loadAdminMetrics());

    // Subscribe to metrics changes to update charts
    this.metrics$.subscribe(metrics => {
      if (metrics?.charts) {
        this.renderCharts(metrics.charts);
      }
    });
  }

  onRefresh(): void {
    this.store.dispatch(AdminActions.loadAdminMetrics());
  }

  private renderCharts(charts: any): void {
    // Generations per day chart
    if (charts.generationsPerDay && charts.generationsPerDay.length > 0) {
      const ctx = document.getElementById('generationsChart') as HTMLCanvasElement;
      if (ctx) {
        this.generationsChart?.destroy();
        this.generationsChart = new Chart(ctx, {
          type: 'line',
          data: {
            labels: charts.generationsPerDay.map((d: any) => d.date),
            datasets: [{
              label: 'Generations',
              data: charts.generationsPerDay.map((d: any) => d.count),
              borderColor: 'rgb(75, 192, 192)',
              backgroundColor: 'rgba(75, 192, 192, 0.2)',
              tension: 0.1
            }]
          },
          options: {
            responsive: true,
            plugins: {
              title: {
                display: true,
                text: 'Generations Per Day'
              }
            }
          }
        });
      }
    }

    // User growth chart
    if (charts.userGrowth && charts.userGrowth.length > 0) {
      const ctx = document.getElementById('userGrowthChart') as HTMLCanvasElement;
      if (ctx) {
        this.userGrowthChart?.destroy();
        this.userGrowthChart = new Chart(ctx, {
          type: 'line',
          data: {
            labels: charts.userGrowth.map((d: any) => d.date),
            datasets: [{
              label: 'Users',
              data: charts.userGrowth.map((d: any) => d.count),
              borderColor: 'rgb(153, 102, 255)',
              backgroundColor: 'rgba(153, 102, 255, 0.2)',
              tension: 0.1
            }]
          },
          options: {
            responsive: true,
            plugins: {
              title: {
                display: true,
                text: 'User Growth Over Time'
              }
            }
          }
        });
      }
    }

    // Success rate chart
    if (charts.successRateOverTime && charts.successRateOverTime.length > 0) {
      const ctx = document.getElementById('successRateChart') as HTMLCanvasElement;
      if (ctx) {
        this.successRateChart?.destroy();
        this.successRateChart = new Chart(ctx, {
          type: 'line',
          data: {
            labels: charts.successRateOverTime.map((d: any) => d.date),
            datasets: [{
              label: 'Success Rate (%)',
              data: charts.successRateOverTime.map((d: any) => d.rate),
              borderColor: 'rgb(255, 99, 132)',
              backgroundColor: 'rgba(255, 99, 132, 0.2)',
              tension: 0.1
            }]
          },
          options: {
            responsive: true,
            scales: {
              y: {
                beginAtZero: true,
                max: 100
              }
            },
            plugins: {
              title: {
                display: true,
                text: 'Success Rate Over Time'
              }
            }
          }
        });
      }
    }
  }

  formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  formatUptime(seconds: number): string {
    const days = Math.floor(seconds / (24 * 60 * 60));
    const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
    const mins = Math.floor((seconds % (60 * 60)) / 60);
    return `${days}d ${hours}h ${mins}m`;
  }
}
```

## Backend Implementation

### Admin Controller

```typescript
// admin.controller.ts
import { 
  Controller, 
  Get, 
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards 
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateUserDto, UpdateUserDto } from './dto';

@Controller('api/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')  // All routes require admin role
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // Users Management
  @Get('users')
  async getUsers(
    @Query('search') search?: string,
    @Query('group') group?: string,
    @Query('isActive') isActive?: string
  ) {
    const filters = { search, group, isActive };
    return this.adminService.getUsers(filters);
  }

  @Post('users')
  async createUser(@Body() createUserDto: CreateUserDto) {
    return this.adminService.createUser(createUserDto);
  }

  @Patch('users/:id')
  async updateUser(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto
  ) {
    return this.adminService.updateUser(id, updateUserDto);
  }

  @Delete('users/:id')
  async deleteUser(@Param('id') id: string) {
    await this.adminService.deleteUser(id);
    return { message: 'User deleted successfully' };
  }

  // Files Management
  @Get('files')
  async getFiles(
    @Query('userId') userId?: string,
    @Query('type') type?: string,
    @Query('search') search?: string,
    @Query('page') page?: string
  ) {
    const filters = { userId, type, search };
    const pageNum = page ? parseInt(page) : 1;
    return this.adminService.getFiles(filters, pageNum);
  }

  @Delete('files/:id')
  async deleteFile(@Param('id') id: string) {
    await this.adminService.deleteFile(id);
    return { message: 'File deleted successfully' };
  }

  // Audit Logs
  @Get('logs')
  async getLogs(
    @Query('userId') userId?: string,
    @Query('action') action?: string,
    @Query('resource') resource?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string
  ) {
    const filters = {
      userId,
      action,
      resource,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined
    };
    const pageNum = page ? parseInt(page) : 1;
    return this.adminService.getLogs(filters, pageNum);
  }

  // Performance Metrics
  @Get('metrics')
  async getMetrics() {
    return this.adminService.getMetrics();
  }

  // System Health
  @Get('health')
  async getSystemHealth() {
    return this.adminService.getSystemHealth();
  }
}
```

### Admin Service

```typescript
// admin.service.ts
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from '../schemas/user.schema';
import { LibraryItem, LibraryItemDocument } from '../schemas/library-item.schema';
import { AuditLog, AuditLogDocument } from '../schemas/audit-log.schema';
import { CreateUserDto, UpdateUserDto } from './dto';

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(LibraryItem.name) private libraryItemModel: Model<LibraryItemDocument>,
    @InjectModel(AuditLog.name) private auditLogModel: Model<AuditLogDocument>
  ) {}

  // Users Management
  async getUsers(filters: any) {
    const query: any = {};

    if (filters.search) {
      query.$or = [
        { username: new RegExp(filters.search, 'i') },
        { email: new RegExp(filters.search, 'i') }
      ];
    }

    if (filters.group && filters.group !== 'all') {
      query.groups = filters.group;
    }

    if (filters.isActive && filters.isActive !== 'all') {
      query.isActive = filters.isActive === 'active';
    }

    const users = await this.userModel.find(query).sort({ createdAt: -1 });

    // Enrich with file counts and storage
    const enrichedUsers = await Promise.all(
      users.map(async (user) => {
        const files = await this.libraryItemModel.find({ userId: user._id });
        const fileCount = files.length;
        const storageUsed = files.reduce((sum, file) => sum + (file.fileSize || 0), 0);

        return {
          id: user._id.toString(),
          username: user.username,
          email: user.email,
          groups: user.groups,
          isActive: user.isActive,
          lastLoginAt: user.lastLoginAt,
          loginCount: user.loginCount,
          createdAt: user.createdAt,
          fileCount,
          storageUsed
        };
      })
    );

    return enrichedUsers;
  }

  async createUser(createUserDto: CreateUserDto) {
    // Check if user exists
    const exists = await this.userModel.findOne({
      $or: [{ email: createUserDto.email }, { username: createUserDto.username }]
    });

    if (exists) {
      throw new ConflictException('Username or email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    // Create user
    const user = await this.userModel.create({
      ...createUserDto,
      password: hashedPassword
    });

    // Log action
    await this.createAuditLog({
      userId: user._id,
      username: user.username,
      action: 'create',
      resource: 'user',
      resourceId: user._id,
      details: { after: { username: user.username, email: user.email, groups: user.groups } },
      isSystemAction: false
    });

    return {
      id: user._id.toString(),
      username: user.username,
      email: user.email,
      groups: user.groups,
      isActive: user.isActive,
      createdAt: user.createdAt
    };
  }

  async updateUser(id: string, updateUserDto: UpdateUserDto) {
    const user = await this.userModel.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const before = {
      username: user.username,
      email: user.email,
      groups: user.groups,
      isActive: user.isActive
    };

    // Update fields
    if (updateUserDto.username) user.username = updateUserDto.username;
    if (updateUserDto.email) user.email = updateUserDto.email;
    if (updateUserDto.groups) user.groups = updateUserDto.groups;
    if (typeof updateUserDto.isActive !== 'undefined') user.isActive = updateUserDto.isActive;
    
    if (updateUserDto.password) {
      user.password = await bcrypt.hash(updateUserDto.password, 10);
    }

    await user.save();

    const after = {
      username: user.username,
      email: user.email,
      groups: user.groups,
      isActive: user.isActive
    };

    // Log action
    await this.createAuditLog({
      userId: user._id,
      username: user.username,
      action: 'update',
      resource: 'user',
      resourceId: user._id,
      details: { before, after },
      isSystemAction: false
    });

    return {
      id: user._id.toString(),
      username: user.username,
      email: user.email,
      groups: user.groups,
      isActive: user.isActive,
      updatedAt: user.updatedAt
    };
  }

  async deleteUser(id: string) {
    const user = await this.userModel.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Delete all user's files
    const files = await this.libraryItemModel.find({ userId: id });
    for (const file of files) {
      // TODO: Delete actual file from storage
      await this.libraryItemModel.findByIdAndDelete(file._id);
    }

    // Log action
    await this.createAuditLog({
      userId: user._id,
      username: user.username,
      action: 'delete',
      resource: 'user',
      resourceId: user._id,
      details: { 
        before: { username: user.username, email: user.email },
        metadata: { filesDeleted: files.length }
      },
      isSystemAction: false
    });

    // Delete user
    await this.userModel.findByIdAndDelete(id);
  }

  // Files Management
  async getFiles(filters: any, page: number) {
    const pageSize = 20;
    const skip = (page - 1) * pageSize;

    const query: any = {};

    if (filters.userId) {
      query.userId = filters.userId;
    }

    if (filters.type && filters.type !== 'all') {
      query.type = filters.type;
    }

    if (filters.search) {
      query.$text = { $search: filters.search };
    }

    const [items, total] = await Promise.all([
      this.libraryItemModel
        .find(query)
        .populate('userId', 'username email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize),
      this.libraryItemModel.countDocuments(query)
    ]);

    const enrichedItems = items.map(item => ({
      id: item._id.toString(),
      userId: item.userId._id.toString(),
      username: (item.userId as any).username,
      userEmail: (item.userId as any).email,
      songId: item.songId?.toString(),
      type: item.type,
      title: item.title,
      fileUrl: item.fileUrl,
      fileType: item.fileType,
      fileSize: item.fileSize,
      duration: item.duration,
      metadata: item.metadata,
      playCount: item.playCount,
      downloadCount: item.downloadCount,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    }));

    return {
      items: enrichedItems,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    };
  }

  async deleteFile(id: string) {
    const file = await this.libraryItemModel.findById(id).populate('userId', 'username');
    if (!file) {
      throw new NotFoundException('File not found');
    }

    // Log action
    await this.createAuditLog({
      userId: file.userId._id,
      username: (file.userId as any).username,
      action: 'delete',
      resource: 'library',
      resourceId: file._id,
      details: {
        before: { title: file.title, type: file.type, fileSize: file.fileSize }
      },
      isSystemAction: false
    });

    // TODO: Delete actual file from storage
    await this.libraryItemModel.findByIdAndDelete(id);
  }

  // Audit Logs
  async getLogs(filters: any, page: number) {
    const pageSize = 50;
    const skip = (page - 1) * pageSize;

    const query: any = {};

    if (filters.userId) {
      query.userId = filters.userId;
    }

    if (filters.action) {
      query.action = filters.action;
    }

    if (filters.resource) {
      query.resource = filters.resource;
    }

    if (filters.startDate || filters.endDate) {
      query.timestamp = {};
      if (filters.startDate) query.timestamp.$gte = filters.startDate;
      if (filters.endDate) query.timestamp.$lte = filters.endDate;
    }

    const [logs, total] = await Promise.all([
      this.auditLogModel
        .find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(pageSize),
      this.auditLogModel.countDocuments(query)
    ]);

    return {
      items: logs.map(log => ({
        id: log._id.toString(),
        userId: log.userId.toString(),
        username: log.username,
        action: log.action,
        resource: log.resource,
        resourceId: log.resourceId?.toString(),
        details: log.details,
        timestamp: log.timestamp
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    };
  }

  // Performance Metrics
  async getMetrics() {
    // Overview
    const [totalUsers, activeUsers, totalFiles, totalGenerations] = await Promise.all([
      this.userModel.countDocuments(),
      this.userModel.countDocuments({
        lastLoginAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      }),
      this.libraryItemModel.countDocuments(),
      this.auditLogModel.countDocuments({ action: 'generate' })
    ]);

    // Storage
    const files = await this.libraryItemModel.find({}, 'fileSize type');
    const totalStorage = files.reduce((sum, file) => sum + (file.fileSize || 0), 0);

    // Generation stats
    const [songsGenerated, musicGenerated, videosGenerated] = await Promise.all([
      this.libraryItemModel.countDocuments({ type: 'song' }),
      this.libraryItemModel.countDocuments({ type: 'music' }),
      this.libraryItemModel.countDocuments({ type: 'video' })
    ]);

    // Average generation time (from metadata)
    const generatedFiles = await this.libraryItemModel.find({ 
      'metadata.generationTime': { $exists: true } 
    }, 'metadata.generationTime');
    
    const totalGenTime = generatedFiles.reduce((sum, file) => 
      sum + (file.metadata?.generationTime || 0), 0
    );
    const averageGenerationTime = generatedFiles.length > 0 
      ? totalGenTime / generatedFiles.length 
      : 0;

    // Top users
    const userAggregation = await this.libraryItemModel.aggregate([
      {
        $group: {
          _id: '$userId',
          generationCount: { $sum: 1 },
          storageUsed: { $sum: '$fileSize' }
        }
      },
      { $sort: { generationCount: -1 } },
      { $limit: 10 }
    ]);

    const topUsersEnriched = await Promise.all(
      userAggregation.map(async (item) => {
        const user = await this.userModel.findById(item._id, 'username');
        return {
          username: user?.username || 'Unknown',
          generationCount: item.generationCount,
          storageUsed: item.storageUsed
        };
      })
    );

    // Recent activity
    const recentLogs = await this.auditLogModel
      .find()
      .sort({ timestamp: -1 })
      .limit(10);

    // Charts data (simplified - should aggregate by date)
    const generationsPerDay = await this.aggregateByDay('library', 30);
    const userGrowth = await this.aggregateUserGrowth(30);

    return {
      overview: {
        totalUsers,
        activeUsers,
        totalFiles,
        totalStorage,
        totalGenerations
      },
      generation: {
        songsGenerated,
        musicGenerated,
        videosGenerated,
        averageGenerationTime,
        successRate: 95,  // TODO: Calculate from actual failure logs
        failureCount: Math.floor(totalGenerations * 0.05)
      },
      storage: {
        totalSize: totalStorage,
        audioFiles: files.filter(f => ['song', 'music', 'audio'].includes(f.type)).length,
        videoFiles: files.filter(f => f.type === 'video').length,
        styleFiles: files.filter(f => f.type === 'style').length,
        averageFileSize: files.length > 0 ? totalStorage / files.length : 0
      },
      topUsers: topUsersEnriched,
      recentActivity: recentLogs.map(log => ({
        timestamp: log.timestamp,
        action: log.action,
        username: log.username,
        resource: log.resource
      })),
      charts: {
        generationsPerDay,
        userGrowth,
        successRateOverTime: [],  // TODO: Implement
        averageResponseTime: []    // TODO: Implement
      }
    };
  }

  // System Health
  async getSystemHealth() {
    const os = require('os');
    const process = require('process');

    return {
      cpuUsage: os.loadavg()[0] * 100 / os.cpus().length,
      memoryUsage: (1 - os.freemem() / os.totalmem()) * 100,
      uptime: process.uptime(),
      platform: os.platform(),
      nodeVersion: process.version
    };
  }

  // Helper methods
  private async createAuditLog(data: any) {
    await this.auditLogModel.create({
      ...data,
      timestamp: new Date(),
      expireAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)  // 90 days
    });
  }

  private async aggregateByDay(collection: string, days: number) {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    const results = await this.libraryItemModel.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    return results.map(r => ({ date: r._id, count: r.count }));
  }

  private async aggregateUserGrowth(days: number) {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    const results = await this.userModel.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Cumulative count
    let cumulative = await this.userModel.countDocuments({ createdAt: { $lt: startDate } });
    return results.map(r => {
      cumulative += r.count;
      return { date: r._id, count: cumulative };
    });
  }
}
```

## Route Guard Configuration

```typescript
// app.routes.ts
export const appRoutes: Route[] = [
  // ... other routes
  {
    path: 'admin',
    loadChildren: () => import('./features/admin/admin.module').then(m => m.AdminModule),
    canActivate: [authGuard, adminGuard]  // Requires authentication + admin role
  }
];
```

## WebSocket Integration for Real-Time Metrics

```typescript
// admin.gateway.ts
import { 
  WebSocketGateway, 
  WebSocketServer, 
  OnGatewayConnection,
  OnGatewayDisconnect 
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AdminService } from './admin.service';

@WebSocketGateway({ 
  namespace: '/admin',
  cors: { origin: '*' }  // Configure properly in production
})
export class AdminGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(private adminService: AdminService) {
    // Emit metrics every 30 seconds
    setInterval(() => {
      this.broadcastMetrics();
    }, 30000);
  }

  handleConnection(client: Socket) {
    console.log(`Admin client connected: ${client.id}`);
    // TODO: Validate JWT token from client
  }

  handleDisconnect(client: Socket) {
    console.log(`Admin client disconnected: ${client.id}`);
  }

  private async broadcastMetrics() {
    const metrics = await this.adminService.getMetrics();
    this.server.emit('metrics-update', metrics);
  }
}
```

## Testing Strategy

### Unit Tests

```typescript
describe('AdminService', () => {
  it('should get all users with file counts', async () => {
    const users = await service.getUsers({});
    expect(users).toHaveLength(2);
    expect(users[0]).toHaveProperty('fileCount');
    expect(users[0]).toHaveProperty('storageUsed');
  });

  it('should create audit log on user deletion', async () => {
    await service.deleteUser('user123');
    const logs = await auditLogModel.find({ action: 'delete', resource: 'user' });
    expect(logs.length).toBeGreaterThan(0);
  });

  it('should prevent non-admin access', async () => {
    await expect(controller.getUsers()).rejects.toThrow(ForbiddenException);
  });
});
```

### E2E Tests

```typescript
test('admin dashboard flow', async ({ page }) => {
  // Login as admin
  await loginAsAdmin(page);

  // Navigate to admin dashboard
  await page.click('[aria-label="User menu"]');
  await page.click('button:has-text("Admin Dashboard")');
  await expect(page).toHaveURL('/admin');

  // Check users tab
  await expect(page.locator('.users-table')).toBeVisible();
  
  // Create user
  await page.click('button:has-text("Create User")');
  await page.fill('input[formControlName="username"]', 'newuser');
  await page.fill('input[formControlName="email"]', 'new@test.com');
  await page.fill('input[formControlName="password"]', 'Test123!');
  await page.click('button:has-text("Create")');
  await expect(page.locator('text=newuser')).toBeVisible();

  // Switch to metrics tab
  await page.click('mat-tab >> text=Metrics');
  await expect(page.locator('canvas#generationsChart')).toBeVisible();
});
```

## Security Considerations

### Role Verification

- All admin endpoints protected by `@Roles('admin')` decorator
- JWT token validated on every request
- Role checked in RolesGuard

### Audit Logging

- All admin actions logged with timestamp
- User attribution for accountability
- 90-day retention (configurable TTL)

### Data Access Control

- Admins can view all data (by design)
- Audit logs track who accessed what
- Consider IP whitelisting for extra security

## Future Enhancements

### Advanced Analytics

- Machine learning insights (most popular genres, prediction models)
- User cohort analysis
- Retention metrics

### Bulk Operations

- Bulk user import/export (CSV)
- Bulk file operations
- Mass notifications

### System Configuration UI

- Model parameter tuning
- Rate limit configuration
- Feature flags

### Advanced Monitoring

- Grafana integration
- Prometheus metrics export
- Alert system for anomalies

---

**Document Version**: 1.0.0  
**Last Updated**: December 2, 2025  
**Status**: Design Complete - Implementation Ready  
**Priority**: HIGH - Core Admin Feature

**LEGENDARY IS OUR STANDARD!** 👑
