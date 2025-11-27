import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MusicComponent } from './music.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

// Prevent socket.io-client from opening a real socket during tests
jest.mock('socket.io-client', () => ({
  io: jest.fn().mockImplementation(() => ({ on: jest.fn(), disconnect: jest.fn() }))
}));

describe('MusicComponent (audio icon display)', () => {
  let fixture: ComponentFixture<MusicComponent>;
  let component: MusicComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        FormsModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatIconModule,
        MatProgressBarModule,
        BrowserAnimationsModule
      ],
      declarations: [MusicComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(MusicComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should show audio icon and audio element after receiving a complete status with url', () => {
    const url = 'http://localhost/assets/generated/test-funny-song.wav';
    // Call private method via index signature to simulate arrival of status update
    (component as any).handleStatusUpdate({ service: 'music', status: 'complete', url });
    fixture.detectChanges();

    expect(component.audioUrl).toBe(url);
    const audio = fixture.nativeElement.querySelector('audio');
    expect(audio).not.toBeNull();
    const downloadLink = fixture.nativeElement.querySelector('a[download]');
    expect(downloadLink).not.toBeNull();
    expect(downloadLink.getAttribute('href')).toBe(url);
  });

  it('should toggle playback using audio element play/pause', () => {
    const url = 'http://localhost/assets/generated/test-funny-song.wav';
    // Provide a fake Audio to override real playback
    const fakePlay = jest.fn().mockResolvedValue(undefined);
    const fakePause = jest.fn();
    (globalThis as any).Audio = jest.fn().mockImplementation(() => ({ play: fakePlay, pause: fakePause }));

    // no audioEl prior to toggle, togglePlayback should create it and call play
    component.audioUrl = url;
    component.audioPlaying = false;
    component.togglePlayback();
    expect((globalThis as any).Audio).toHaveBeenCalledWith(url);
    expect(fakePlay).toHaveBeenCalled();
    // wait for microtasks so the promise resolved in play() resolves and sets state
    return fakePlay.mock.results[0].value.then(() => {
      expect(component.audioPlaying).toBe(true);

      // calling toggle again should call pause
      component.togglePlayback();
      expect(fakePause).toHaveBeenCalled();
      expect(component.audioPlaying).toBe(false);
    });
  });
});
