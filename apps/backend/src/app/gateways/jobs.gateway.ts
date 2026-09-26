/**
 * Jobs Gateway
 * WebSocket gateway for authenticated real-time job status updates.
 */

import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Model, Types } from 'mongoose';
import { Server } from 'socket.io';
import {
  JobRecord,
  JobRecordDocument,
} from '../../schemas/job-record.schema';
import {
  User,
  UserDocument,
} from '../../schemas/user.schema';

interface JobSubscribePayload {
  jobId: string;
}

interface JobStatusPayload {
  id: string;
  status: string;
}

interface JobProgress {
  current: number;
  total: number;
  percentage: number;
  message: string;
}

interface JobProgressPayload {
  id: string;
  progress: JobProgress;
}

interface JobRoutingIdentity {
  id: string;
  userId: string;
}

interface JobCompletedPayload<
  TJob extends JobRoutingIdentity,
> {
  job: TJob;
}

interface JobFailedPayload {
  id: string;
  error: string;
}

export interface JobSubscriptionErrorPayload {
  jobId: string;
  message: string;
}

interface SocketJwtPayload {
  sub?: string;
  username?: string;
  role?: string;
}

interface JobsSocketHandshake {
  auth: {
    token?: string;
  };
  headers: {
    authorization?: string;
  };
}

interface JobsSocketData {
  userId?: string;
}

export interface JobsSocket {
  id: string;
  handshake: JobsSocketHandshake;
  data: JobsSocketData;
  disconnect(close?: boolean): void;
  join(room: string): void | Promise<void>;
  leave(room: string): void | Promise<void>;
  emit(
    event: string,
    payload: JobSubscriptionErrorPayload
  ): boolean;
}

@WebSocketGateway({
  cors: {
    origin:
      process.env.CORS_ORIGIN ||
      'http://localhost:4200',
    credentials: true,
  },
  namespace: '/',
})
export class JobsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger =
    new Logger(JobsGateway.name);

  private readonly socketUsers =
    new Map<string, string>();

  constructor(
    private readonly jwtService: JwtService,
    @InjectModel(JobRecord.name)
    private readonly jobModel:
      Model<JobRecordDocument>,
    @InjectModel(User.name)
    private readonly userModel:
      Model<UserDocument>
  ) {}

  async handleConnection(
    client: JobsSocket
  ): Promise<void> {
    const userId =
      await this.authenticateClient(client);

    if (!userId) {
      this.logger.warn(
        `Rejected unauthenticated socket ${client.id}`
      );
      client.disconnect(true);
      return;
    }

    client.data.userId = userId;

    this.socketUsers.set(
      client.id,
      userId
    );

    this.logger.log(
      `Client ${client.id} connected (user: ${userId})`
    );
  }

  handleDisconnect(
    client: JobsSocket
  ): void {
    const userId =
      this.socketUsers.get(client.id);

    this.socketUsers.delete(client.id);

    if (userId) {
      this.logger.log(
        `Client ${client.id} disconnected (user: ${userId})`
      );
    }
  }

  @SubscribeMessage('job:subscribe')
  async handleSubscribeToJob(
    @MessageBody() data: JobSubscribePayload,
    @ConnectedSocket() client: JobsSocket
  ): Promise<void> {
    const userId =
      this.getAuthenticatedUserId(client);

    if (!userId) {
      client.disconnect(true);
      return;
    }

    if (
      !data?.jobId ||
      !Types.ObjectId.isValid(data.jobId)
    ) {
      this.rejectJobSubscription(
        client,
        data?.jobId || '',
        'Invalid job subscription.'
      );
      return;
    }

    const ownedJob =
      await this.jobModel.exists({
        _id:
          new Types.ObjectId(
            data.jobId
          ),
        userId:
          new Types.ObjectId(
            userId
          ),
      });

    if (!ownedJob) {
      this.logger.warn(
        `Denied socket ${client.id} access to job ${data.jobId}`
      );

      this.rejectJobSubscription(
        client,
        data.jobId,
        'Job is unavailable.'
      );
      return;
    }

    const room =
      `job:${data.jobId}`;

    await client.join(room);

    this.logger.log(
      `Client ${client.id} subscribed to job ${data.jobId}`
    );
  }

  @SubscribeMessage('job:unsubscribe')
  handleUnsubscribeFromJob(
    @MessageBody() data: JobSubscribePayload,
    @ConnectedSocket() client: JobsSocket
  ): void {
    const room =
      `job:${data.jobId}`;

    client.leave(room);

    this.logger.log(
      `Client ${client.id} unsubscribed from job ${data.jobId}`
    );
  }

  @SubscribeMessage('jobs:subscribe:user')
  handleSubscribeToUserJobs(
    @ConnectedSocket() client: JobsSocket
  ): void {
    const userId =
      this.getAuthenticatedUserId(client);

    if (!userId) {
      client.disconnect(true);
      return;
    }

    const room =
      `user:${userId}:jobs`;

    client.join(room);

    this.logger.log(
      `Client ${client.id} subscribed to user jobs`
    );
  }

  @SubscribeMessage('jobs:unsubscribe:user')
  handleUnsubscribeFromUserJobs(
    @ConnectedSocket() client: JobsSocket
  ): void {
    const userId =
      this.getAuthenticatedUserId(client);

    if (!userId) {
      client.disconnect(true);
      return;
    }

    const room =
      `user:${userId}:jobs`;

    client.leave(room);

    this.logger.log(
      `Client ${client.id} unsubscribed from user jobs`
    );
  }

  emitJobStatus(
    jobId: string,
    status: string
  ): void {
    const room =
      `job:${jobId}`;

    const payload: JobStatusPayload = {
      id: jobId,
      status,
    };

    this.server
      .to(room)
      .emit(
        'job:status',
        payload
      );

    this.logger.debug(
      `Emitted status update for job ${jobId}: ${status}`
    );
  }

  emitJobProgress(
    jobId: string,
    progress: JobProgress
  ): void {
    const room =
      `job:${jobId}`;

    const payload:
      JobProgressPayload = {
        id: jobId,
        progress,
      };

    this.server
      .to(room)
      .emit(
        'job:progress',
        payload
      );

    this.logger.debug(
      `Emitted progress update for job ${jobId}: ${progress.percentage}%`
    );
  }

  emitJobCompleted<
    TJob extends JobRoutingIdentity,
  >(
    job: TJob
  ): void {
    const jobRoom =
      `job:${job.id}`;

    const userRoom =
      `user:${job.userId}:jobs`;

    const payload:
      JobCompletedPayload<TJob> = {
        job,
      };

    this.server
      .to(jobRoom)
      .to(userRoom)
      .emit(
        'job:completed',
        payload
      );

    this.logger.log(
      `Emitted completion for job ${job.id}`
    );
  }

  emitJobFailed(
    jobId: string,
    userId: string,
    error: string
  ): void {
    const jobRoom =
      `job:${jobId}`;

    const userRoom =
      `user:${userId}:jobs`;

    const payload:
      JobFailedPayload = {
        id: jobId,
        error,
      };

    this.server
      .to(jobRoom)
      .to(userRoom)
      .emit(
        'job:failed',
        payload
      );

    this.logger.log(
      `Emitted failure for job ${jobId}`
    );
  }

  emitJobStatusToUser(
    userId: string,
    jobId: string,
    status: string
  ): void {
    const userRoom =
      `user:${userId}:jobs`;

    const payload:
      JobStatusPayload = {
        id: jobId,
        status,
      };

    this.server
      .to(userRoom)
      .emit(
        'job:status',
        payload
      );
  }

  private async authenticateClient(
    client: JobsSocket
  ): Promise<string | null> {
    const token =
      this.getHandshakeToken(client);

    if (!token) {
      return null;
    }

    try {
      const payload =
        await this.jwtService
          .verifyAsync<SocketJwtPayload>(
            token
          );

      if (
        !payload.sub ||
        !Types.ObjectId.isValid(
          payload.sub
        )
      ) {
        return null;
      }

      const userExists =
        await this.userModel.exists({
          _id:
            new Types.ObjectId(
              payload.sub
            ),
        });

      return userExists
        ? payload.sub
        : null;
    } catch {
      return null;
    }
  }

  private getHandshakeToken(
    client: JobsSocket
  ): string | null {
    const authToken =
      client.handshake.auth.token;

    if (
      typeof authToken === 'string' &&
      authToken.trim()
    ) {
      return authToken.trim();
    }

    const authorization =
      client.handshake.headers
        .authorization;

    if (
      authorization &&
      authorization.startsWith(
        'Bearer '
      )
    ) {
      const token =
        authorization
          .slice(7)
          .trim();

      return token || null;
    }

    return null;
  }

  private getAuthenticatedUserId(
    client: JobsSocket
  ): string | null {
    const userId =
      client.data.userId;

    return (
      typeof userId === 'string' &&
      Types.ObjectId.isValid(
        userId
      )
    )
      ? userId
      : null;
  }

  private rejectJobSubscription(
    client: JobsSocket,
    jobId: string,
    message: string
  ): void {
    client.emit(
      'job:subscription:error',
      {
        jobId,
        message,
      }
    );
  }
}
