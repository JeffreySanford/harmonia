import { appRoutes } from './app.routes';

describe('appRoutes', () => {
  it('should protect generate routes with authGuard', () => {
    const generateSong = appRoutes.find((r) => r.path === 'generate/song');
    const generateMusic = appRoutes.find((r) => r.path === 'generate/music');
    const generateVideo = appRoutes.find((r) => r.path === 'generate/video');
    const editVideo = appRoutes.find((r) => r.path === 'edit/video');

    expect(generateSong?.canActivate).toBeDefined();
    expect(generateMusic?.canActivate).toBeDefined();
    expect(generateVideo?.canActivate).toBeDefined();
    expect(editVideo?.canActivate).toBeDefined();
  });
});
