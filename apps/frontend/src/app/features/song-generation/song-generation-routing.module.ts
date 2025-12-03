import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SongGenerationPageComponent } from './song-generation-page.component';

const routes: Routes = [
  {
    path: '',
    component: SongGenerationPageComponent,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class SongGenerationRoutingModule {}
