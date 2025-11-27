import { WebSocketGateway, WebSocketServer, OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { AppService, ServiceStatus } from './app.service';

@WebSocketGateway({ cors: { origin: '*' } })
@Injectable()
export class AppGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(AppGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(private readonly appService: AppService) {
    // subscribe to status updates from AppService
    this.appService.status$.subscribe((update) => {
      // Emit to all connected clients
      this.server?.emit('status_update', update);
    });
  }

  afterInit(server: Server) {
    this.logger.log('Gateway initialized');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    // Send current statuses to client when they connect
    (async () => {
      try {
        const music = await this.appService.getMusicStatus();
        const video = await this.appService.getVideoStatus();
        const vocal = await this.appService.getVocalStatus();
        client.emit('status_update', { service: 'music', status: music.status });
        client.emit('status_update', { service: 'video', status: video.status });
        client.emit('status_update', { service: 'vocal', status: vocal.status });
      } catch (err) {
        this.logger.error('Failed to send initial statuses', err);
      }
    })();
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }
}
