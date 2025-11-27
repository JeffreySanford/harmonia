// Mock ioredis to avoid requiring a running Redis instance during tests and capture publish/set calls
const publishMock = jest.fn();
const setMock = jest.fn();
const getMock = jest.fn().mockResolvedValue(null);
const subscribeMock = jest.fn();
const onMock = jest.fn();

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    set: setMock,
    publish: publishMock,
    subscribe: subscribeMock,
    on: onMock,
    get: getMock,
  }));
});

import { Test } from '@nestjs/testing';
import { AppService, ServiceStatus } from './app.service';

describe('AppService', () => {
  let service: AppService;

  beforeAll(async () => {
    const app = await Test.createTestingModule({
      providers: [AppService],
    }).compile();

    service = app.get<AppService>(AppService);
  });

  describe('getData', () => {
    it('should return "Hello API"', async () => {
      await expect(service.getData()).resolves.toEqual({ message: 'Hello API' });
    });
  });

  describe('getMusic', () => {
    it('should publish a music_request with provided lyrics and update status', async () => {
      const lyrics = 'Make a 10 second funny song about coding success';
      await expect(service.getMusic(lyrics)).resolves.toEqual({ message: 'Music Generation Service endpoint' });

      // Redis 'set' should have been called to set the music status
      expect(setMock).toHaveBeenCalledWith('music_status', 'requested');

      // 'status_updates' publish should have been called with the 'requested' status
      const expectedStatusPayload = JSON.stringify({ service: 'music', status: 'requested' });
      expect(publishMock).toHaveBeenCalledWith('status_updates', expectedStatusPayload);

      // 'music_request' publish should have been called with the lyrics passed through
      const expectedRequestPayload = JSON.stringify({ service: 'music', lyrics });
      expect(publishMock).toHaveBeenCalledWith('music_request', expectedRequestPayload);
    });
  });

  describe('status$ emissions', () => {
    it('should emit a ServiceStatus when redis publishes a message with url', async () => {
      const observed: ServiceStatus[] = [];
      service.status$.subscribe((v) => observed.push(v));

      // If subscribe was recorded, simulate a successful subscription to trigger the 'on' handler registration
      const subscribeCalls = (subscribeMock as jest.Mock).mock.calls;
      if (subscribeCalls.length > 0) {
        const cb = subscribeCalls[0][1] as ((err: Error | null, count: number) => void) | undefined;
        if (typeof cb === 'function') cb(null, 1);
      }

      // Find the 'on' call from the mock and capture the message handler
      const onCalls = (onMock as jest.Mock).mock.calls;
      let handler: ((channel: string, message: string) => void) | null = null;
      for (const call of onCalls) {
        if (call[0] === 'message' && typeof call[1] === 'function') {
          handler = call[1] as ((channel: string, message: string) => void);
        }
      }
      expect(handler).not.toBeNull();

      // Simulate Redis message for status_updates that includes a url
      const payload = JSON.stringify({ service: 'music', status: 'complete', url: 'http://cdn.example/generated/song.wav' });
      handler('status_updates', payload);

      // Small micro-task tick to flush subject subscriptions
      await new Promise((resolve) => setImmediate(resolve));
      expect(observed.length).toBeGreaterThan(0);
      expect(observed[0]).toEqual({ service: 'music', status: 'complete' });
    });
  });
});
