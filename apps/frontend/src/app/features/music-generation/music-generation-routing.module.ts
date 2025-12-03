import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { MusicGenerationPageComponent } from './music-generation-page.component';

const routes: Routes = [
  {
    path: '',
    component: MusicGenerationPageComponent,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class MusicGenerationRoutingModule {}
