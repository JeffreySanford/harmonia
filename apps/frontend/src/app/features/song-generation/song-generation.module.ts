import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';

import { SongGenerationRoutingModule } from './song-generation-routing.module';
import { SongGenerationPageComponent } from './song-generation-page.component';
import { SongGenerationMaterialModule } from './song-generation-material.module';

@NgModule({
  declarations: [SongGenerationPageComponent],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    SongGenerationRoutingModule,
    SongGenerationMaterialModule,
  ],
})
export class SongGenerationModule {}
