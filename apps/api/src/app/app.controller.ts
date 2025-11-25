import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getData() {
    return this.appService.getData();
  }

  @Get('music')
  getMusic() {
    return this.appService.getMusic();
  }

  @Get('video')
  getVideo() {
    return this.appService.getVideo();
  }

  @Get('vocal')
  getVocal() {
    return this.appService.getVocal();
  }
}
