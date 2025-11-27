import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouterModule } from '@angular/router';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { JsonPipe } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatButtonModule } from '@angular/material/button';

import { AppComponent } from './app.component';
import { HeaderComponent } from './header/header.component';
import { FooterComponent } from './footer/footer.component';
import { SidenavComponent } from './sidebar/sidenav.component';
import { MusicComponent } from './music/music.component';
import { DashboardComponent } from './dashboard/dashboard.component';

import { VideoGenerationComponent } from './video-generation/video-generation.component';
import { VocalSamplingComponent } from './vocal-sampling/vocal-sampling.component';
import { ProcessDetailsDialog } from './process-dialog/process-details.dialog';

@NgModule({
  declarations: [
    AppComponent,
    HeaderComponent,
    FooterComponent,
    SidenavComponent,
    MusicComponent,
    DashboardComponent,
    VideoGenerationComponent,
    VocalSamplingComponent,
    ProcessDetailsDialog
  ],
  imports: [
    BrowserModule,
    RouterModule.forRoot([
      { path: 'dashboard', component: DashboardComponent },
      { path: 'music', component: MusicComponent },
      { path: 'video-generation', component: VideoGenerationComponent },
      { path: 'vocal-sampling', component: VocalSamplingComponent },
      { path: '', redirectTo: '/dashboard', pathMatch: 'full' }
    ]),
    HttpClientModule,
    BrowserAnimationsModule,
    MatToolbarModule,
    MatIconModule,
    MatSidenavModule,
    MatListModule,
    MatDialogModule,
    MatProgressSpinnerModule,
    MatProgressBarModule,
    MatButtonModule
    ,
    MatFormFieldModule,
    MatInputModule,
    FormsModule
  ],
  providers: [JsonPipe],
  bootstrap: [AppComponent]
})
export class AppModule {}
