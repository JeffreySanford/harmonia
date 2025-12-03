import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { VideoGenerationPageComponent } from './video-generation-page.component';

const routes: Routes = [
  {
    path: '',
    component: VideoGenerationPageComponent,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class VideoGenerationRoutingModule {}
