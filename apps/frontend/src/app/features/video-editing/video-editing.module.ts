import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { VideoEditingRoutingModule } from './video-editing-routing.module';
import { VideoEditingPageComponent } from './video-editing-page.component';
import { VideoEditingMaterialModule } from './video-editing-material.module';

@NgModule({
  declarations: [VideoEditingPageComponent],
  imports: [
    CommonModule,
    VideoEditingRoutingModule,
    VideoEditingMaterialModule,
  ],
})
export class VideoEditingModule {}
