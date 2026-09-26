import {
  INestApplication,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AddressInfo } from 'node:net';
import {
  request as httpRequest,
} from 'node:http';
import { MusicRuntimeController } from './music-runtime.controller';
import { MusicRuntimeService } from './music-runtime.service';

interface HttpResult {
  statusCode: number | undefined;
  body: string;
}

function postJson(
  port: number,
  path: string,
  payload: unknown
): Promise<HttpResult> {
  const body = JSON.stringify(payload);

  return new Promise((resolve, reject) => {
    const request = httpRequest(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method: 'POST',
        headers: {
          'content-type':
            'application/json',
          'content-length':
            Buffer.byteLength(body),
        },
      },
      (response) => {
        const chunks: Buffer[] = [];

        response.on(
          'data',
          (chunk: Buffer) => {
            chunks.push(chunk);
          }
        );

        response.on('end', () => {
          resolve({
            statusCode:
              response.statusCode,
            body:
              Buffer.concat(chunks)
                .toString('utf8'),
          });
        });
      }
    );

    request.once('error', reject);
    request.end(body);
  });
}

describe(
  'MusicRuntimeController Phase 13C HTTP acceptance',
  () => {
    let app: INestApplication;

    const acceptance = {
      operationId:
        'phase13c-operation',
      modelId:
        'musicgen-small',
      acceptedAt:
        '2026-09-25T18:45:00.000Z',
      state:
        'accepted' as const,
    };

    const runtime = {
      requestModelSelection:
        jest.fn(() => acceptance),
      getCatalog: jest.fn(),
      getStatus: jest.fn(),
      stopCurrentRuntime: jest.fn(),
    };

    beforeAll(async () => {
      const module =
        await Test.createTestingModule({
          controllers: [
            MusicRuntimeController,
          ],
          providers: [
            {
              provide:
                MusicRuntimeService,
              useValue: runtime,
            },
          ],
        }).compile();

      app =
        module.createNestApplication();

      app.setGlobalPrefix('api');

      await app.listen(
        0,
        '127.0.0.1'
      );
    });

    afterAll(async () => {
      await app.close();
    });

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it(
      'returns HTTP 202 with an acceptance object rather than final runtime status',
      async () => {
        const address =
          app
            .getHttpServer()
            .address() as AddressInfo;

        const result =
          await postJson(
            address.port,
            '/api/music/runtime/select',
            {
              modelId:
                'musicgen-small',
            }
          );

        expect(
          result.statusCode
        ).toBe(202);

        expect(
          JSON.parse(result.body)
        ).toEqual(acceptance);

        expect(
          runtime
            .requestModelSelection
        ).toHaveBeenCalledTimes(1);

        expect(
          runtime
            .requestModelSelection
        ).toHaveBeenCalledWith(
          'musicgen-small'
        );
      }
    );
  }
);
