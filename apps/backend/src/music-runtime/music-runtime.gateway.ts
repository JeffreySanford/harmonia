import { Logger } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { MusicRuntimeStatus } from './music-runtime.types';

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/',
})
export class MusicRuntimeGateway {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(MusicRuntimeGateway.name);

  emitRuntimeStatus(status: MusicRuntimeStatus): void {
    this.server.emit('music-runtime:status', status);
    this.logger.debug(
      `Runtime status: ${status.providerId ?? 'none'}/${status.modelId ?? 'none'} -> ${status.state}`
    );
  }
}
