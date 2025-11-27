import { Controller, Get, Req, Ip, Headers, Post, Body } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getData() {
    return this.appService.getData();
  }

  @Get('music')
  getMusic(
    @Req() req: unknown,
    @Ip() ip?: string,
    @Headers('user-agent') ua?: string,
  ) {
    try {
      const userAgent = ua ?? (req as Record<string, unknown>)?.headers?.['user-agent'];
      console.log(`[API] GET /api/music called - src=${ip} ua=${userAgent}`);
    } catch (e: unknown) {
      console.warn('[API] Failed to parse request info in getMusic', e);
    }
    return this.appService.getMusic();
  }

  @Post('music')
  postMusic(
    @Body() body: { lyrics?: string },
    @Req() req: unknown,
    @Ip() ip?: string,
    @Headers('user-agent') ua?: string,
  ) {
    try {
      const userAgent = ua ?? (req as Record<string, unknown>)?.headers?.['user-agent'];
      const rawBody = typeof (req as any)?.rawBody !== 'undefined' ? (req as any).rawBody : null;
      if (rawBody) {
        console.log(`[API] POST /api/music called - src=${ip || 'unknown'} ua=${userAgent || 'unknown'} body=${JSON.stringify(body)} rawBody=${rawBody}`);
      } else {
        console.log(`[API] POST /api/music called - src=${ip || 'unknown'} ua=${userAgent || 'unknown'} body=${JSON.stringify(body)}`);
      }
    } catch (e: unknown) {
      console.warn('[API] Failed to parse request info in postMusic', e);
    }
    return this.appService.getMusic(body?.lyrics);
  }

  @Get('video')
  getVideo() {
    return this.appService.getVideo();
  }

  @Get('vocal')
  getVocal() {
    return this.appService.getVocal();
  }

  @Get('music/status')
  getMusicStatus() {
    return this.appService.getMusicStatus();
  }

  @Get('video/status')
  getVideoStatus() {
    return this.appService.getVideoStatus();
  }

  @Get('vocal/status')
  getVocalStatus() {
    return this.appService.getVocalStatus();
  }
}

