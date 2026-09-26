import { JwtService } from '@nestjs/jwt';
import {
  getModelToken,
} from '@nestjs/mongoose';
import {
  Test,
  TestingModule,
} from '@nestjs/testing';
import { Types } from 'mongoose';
import {
  JobRecord,
} from '../../schemas/job-record.schema';
import {
  User,
} from '../../schemas/user.schema';
import {
  JobSubscriptionErrorPayload,
  JobsGateway,
  JobsSocket,
} from './jobs.gateway';

interface SocketJwtPayload {
  sub: string;
  username: string;
  role: string;
}

interface JobOwnershipFilter {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
}

interface UserExistenceFilter {
  _id: Types.ObjectId;
}

interface ExistenceResult {
  _id: Types.ObjectId;
}

describe(
  'JobsGateway authorization boundary',
  () => {
    const userId =
      new Types.ObjectId()
        .toString();

    const jobId =
      new Types.ObjectId()
        .toString();

    const verifyAsync =
      jest.fn(
        async (
          _token: string
        ): Promise<SocketJwtPayload> => ({
          sub: userId,
          username: 'security-user',
          role: 'user',
        })
      );

    const jobExists =
      jest.fn(
        async (
          _filter: JobOwnershipFilter
        ): Promise<ExistenceResult | null> => ({
          _id:
            new Types.ObjectId(
              jobId
            ),
        })
      );

    const userExists =
      jest.fn(
        async (
          _filter: UserExistenceFilter
        ): Promise<ExistenceResult | null> => ({
          _id:
            new Types.ObjectId(
              userId
            ),
        })
      );

    let gateway:
      JobsGateway;

    beforeEach(
      async () => {
        jest.clearAllMocks();

        const module:
          TestingModule =
          await Test
            .createTestingModule({
              providers: [
                JobsGateway,
                {
                  provide:
                    JwtService,
                  useValue: {
                    verifyAsync,
                  },
                },
                {
                  provide:
                    getModelToken(
                      JobRecord.name
                    ),
                  useValue: {
                    exists:
                      jobExists,
                  },
                },
                {
                  provide:
                    getModelToken(
                      User.name
                    ),
                  useValue: {
                    exists:
                      userExists,
                  },
                },
              ],
            })
            .compile();

        gateway =
          module.get<JobsGateway>(
            JobsGateway
          );
      }
    );

    function createClient(
      token:
        string | null =
        'signed-access-token'
    ): JobsSocket {
      const disconnect =
        jest.fn(
          (
            _close?: boolean
          ): void => {
            return;
          }
        );

      const join =
        jest.fn(
          async (
            _room: string
          ): Promise<void> => {
            return;
          }
        );

      const leave =
        jest.fn(
          async (
            _room: string
          ): Promise<void> => {
            return;
          }
        );

      const emit =
        jest.fn(
          (
            _event: string,
            _payload:
              JobSubscriptionErrorPayload
          ): boolean => true
        );

      return {
        id: 'socket-1',
        handshake: {
          auth:
            token === null
              ? {}
              : { token },
          headers: {},
        },
        data: {},
        disconnect,
        join,
        leave,
        emit,
      };
    }

    it(
      'cryptographically validates the socket token and stores the authenticated user',
      async () => {
        const client =
          createClient();

        await gateway
          .handleConnection(
            client
          );

        expect(
          verifyAsync
        ).toHaveBeenCalledWith(
          'signed-access-token'
        );

        expect(
          userExists
        ).toHaveBeenCalledTimes(
          1
        );

        const userCall =
          userExists.mock.calls[0];

        if (!userCall) {
          throw new Error(
            'Expected user existence lookup.'
          );
        }

        const userQuery =
          userCall[0];

        expect(
          String(
            userQuery._id
          )
        ).toBe(
          userId
        );

        expect(
          client.data.userId
        ).toBe(
          userId
        );

        expect(
          client.disconnect
        ).not
          .toHaveBeenCalled();
      }
    );

    it(
      'disconnects a socket whose JWT signature cannot be verified',
      async () => {
        verifyAsync
          .mockRejectedValueOnce(
            new Error(
              'invalid signature'
            )
          );

        const client =
          createClient();

        await gateway
          .handleConnection(
            client
          );

        expect(
          client.disconnect
        ).toHaveBeenCalledWith(
          true
        );

        expect(
          client.data.userId
        ).toBeUndefined();
      }
    );

    it(
      'disconnects when the token user no longer exists',
      async () => {
        userExists
          .mockResolvedValueOnce(
            null
          );

        const client =
          createClient();

        await gateway
          .handleConnection(
            client
          );

        expect(
          client.disconnect
        ).toHaveBeenCalledWith(
          true
        );

        expect(
          client.data.userId
        ).toBeUndefined();
      }
    );

    it(
      'disconnects a socket without a token',
      async () => {
        const client =
          createClient(
            null
          );

        await gateway
          .handleConnection(
            client
          );

        expect(
          verifyAsync
        ).not
          .toHaveBeenCalled();

        expect(
          client.disconnect
        ).toHaveBeenCalledWith(
          true
        );
      }
    );

    it(
      'accepts a bearer token supplied by the socket authorization header',
      async () => {
        const client =
          createClient(
            null
          );

        client.handshake
          .headers
          .authorization =
          'Bearer header-token';

        await gateway
          .handleConnection(
            client
          );

        expect(
          verifyAsync
        ).toHaveBeenCalledWith(
          'header-token'
        );

        expect(
          client.data.userId
        ).toBe(
          userId
        );
      }
    );

    it(
      'allows an authenticated user to subscribe only to a job they own',
      async () => {
        const client =
          createClient();

        client.data.userId =
          userId;

        await gateway
          .handleSubscribeToJob(
            { jobId },
            client
          );

        expect(
          jobExists
        ).toHaveBeenCalledTimes(
          1
        );

        const jobCall =
          jobExists.mock.calls[0];

        if (!jobCall) {
          throw new Error(
            'Expected job ownership lookup.'
          );
        }

        const query =
          jobCall[0];

        expect(
          String(
            query._id
          )
        ).toBe(
          jobId
        );

        expect(
          String(
            query.userId
          )
        ).toBe(
          userId
        );

        expect(
          client.join
        ).toHaveBeenCalledWith(
          `job:${jobId}`
        );
      }
    );

    it(
      'refuses a job room when the authenticated user does not own the job',
      async () => {
        jobExists
          .mockResolvedValueOnce(
            null
          );

        const client =
          createClient();

        client.data.userId =
          userId;

        await gateway
          .handleSubscribeToJob(
            { jobId },
            client
          );

        expect(
          client.join
        ).not
          .toHaveBeenCalled();

        expect(
          client.emit
        ).toHaveBeenCalledWith(
          'job:subscription:error',
          {
            jobId,
            message:
              'Job is unavailable.',
          }
        );
      }
    );

    it(
      'rejects an invalid job id before querying MongoDB',
      async () => {
        const client =
          createClient();

        client.data.userId =
          userId;

        await gateway
          .handleSubscribeToJob(
            {
              jobId:
                'not-an-object-id',
            },
            client
          );

        expect(
          jobExists
        ).not
          .toHaveBeenCalled();

        expect(
          client.join
        ).not
          .toHaveBeenCalled();
      }
    );

    it(
      'joins only the authenticated users own aggregate jobs room',
      () => {
        const client =
          createClient();

        client.data.userId =
          userId;

        gateway
          .handleSubscribeToUserJobs(
            client
          );

        expect(
          client.join
        ).toHaveBeenCalledWith(
          `user:${userId}:jobs`
        );
      }
    );
  }
);
