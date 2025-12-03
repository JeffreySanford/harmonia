import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';

import { MusicGenerationRoutingModule } from './music-generation-routing.module';
import { MusicGenerationPageComponent } from './music-generation-page.component';
import { MusicGenerationMaterialModule } from './music-generation-material.module';

@NgModule({
  declarations: [MusicGenerationPageComponent],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MusicGenerationRoutingModule,
    MusicGenerationMaterialModule,
  ],
})
export class MusicGenerationModule {}
