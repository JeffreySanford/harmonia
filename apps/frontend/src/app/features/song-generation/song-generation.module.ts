import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';

import { SongGenerationRoutingModule } from './song-generation-routing.module';
import { SongGenerationPageComponent } from './song-generation-page.component';
import { GenreSuggestionComponent } from './genre-suggestion.component';
import { SongGenerationMaterialModule } from './song-generation-material.module';

@NgModule({
  declarations: [SongGenerationPageComponent, GenreSuggestionComponent],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule, // For ngModel two-way binding
    HttpClientModule,
    SongGenerationRoutingModule,
    SongGenerationMaterialModule,
  ],
})
export class SongGenerationModule {}
