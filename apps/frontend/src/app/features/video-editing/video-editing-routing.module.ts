import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { VideoEditingPageComponent } from './video-editing-page.component';

const routes: Routes = [
  {
    path: '',
    component: VideoEditingPageComponent,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class VideoEditingRoutingModule {}
