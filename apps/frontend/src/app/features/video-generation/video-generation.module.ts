import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';

import { VideoGenerationRoutingModule } from './video-generation-routing.module';
import { VideoGenerationPageComponent } from './video-generation-page.component';
import { VideoGenerationMaterialModule } from './video-generation-material.module';

@NgModule({
  declarations: [VideoGenerationPageComponent],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    VideoGenerationRoutingModule,
    VideoGenerationMaterialModule,
  ],
})
export class VideoGenerationModule {}
