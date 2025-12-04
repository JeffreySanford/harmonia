import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { LandingComponent } from './landing.component';
import { LandingRoutingModule } from './landing-routing.module';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { AppMaterialModule } from '../../app-material.module';
import { AuthModule } from '../auth/auth.module';

@NgModule({
  declarations: [LandingComponent],
  imports: [
    CommonModule,
    RouterModule,
    LandingRoutingModule,
    AppMaterialModule,
    MatButtonModule,
    MatCardModule,
    AuthModule,
  ],
  exports: [LandingComponent],
})
export class LandingModule {}
