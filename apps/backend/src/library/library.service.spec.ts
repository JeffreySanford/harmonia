import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { firstValueFrom } from 'rxjs';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  LibraryService,
  MAX_LIBRARY_UPLOAD_BYTES,
} from './library.service';

describe('LibraryService private upload security', () => {
  const userId = '507f1f77bcf86cd799439011';
  const otherUserId = '507f191e810c19729de860ea';

  let tempDir: string;
  let service: any;
  let saveError: Error | null;

  function uploadedFile(
    originalname: string,
    mimetype: string,
    size = 1
  ) {
    return {
      fieldname: 'file',
      originalname,
      encoding: '7bit',
      mimetype,
      buffer: Buffer.from('x'),
      size,
    };
  }

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'harmonia-library-test-')
    );

    saveError = null;

    const modelConstructor: any = jest.fn().mockImplementation(
      (dto: Record<string, any>) => {
        const document: any = {
          ...dto,
          _id: new Types.ObjectId(),
          userId: new Types.ObjectId(dto.userId),
          playCount: dto.playCount ?? 0,
          downloadCount: dto.downloadCount ?? 0,
        };

        document.save = jest.fn(async () => {
          if (saveError) {
            throw saveError;
          }

          return document;
        });

        return document;
      }
    );

    service = new LibraryService(modelConstructor);
    service.uploadDir = tempDir;
  });

  afterEach(async () => {
    await fs.rm(tempDir, {
      recursive: true,
      force: true,
    });
  });

  it('accepts supported MIME and extension pairs', () => {
    expect(
      service.validateUploadFile(
        uploadedFile('track.wav', 'audio/wav')
      )
    ).toEqual({
      fileType: 'wav',
      extension: '.wav',
    });

    expect(
      service.validateUploadFile(
        uploadedFile('track.mp3', 'audio/mpeg')
      )
    ).toEqual({
      fileType: 'mp3',
      extension: '.mp3',
    });

    expect(
      service.validateUploadFile(
        uploadedFile('track.flac', 'audio/flac')
      )
    ).toEqual({
      fileType: 'flac',
      extension: '.flac',
    });

    expect(
      service.validateUploadFile(
        uploadedFile(
          'metadata.json',
          'application/json'
        )
      )
    ).toEqual({
      fileType: 'json',
      extension: '.json',
    });
  });

  it('rejects MIME and extension mismatch', () => {
    expect(() =>
      service.validateUploadFile(
        uploadedFile('fake.mp3', 'audio/wav')
      )
    ).toThrow(BadRequestException);
  });

  it('rejects unsupported MIME types', () => {
    expect(() =>
      service.validateUploadFile(
        uploadedFile(
          'payload.exe',
          'application/octet-stream'
        )
      )
    ).toThrow(BadRequestException);
  });

  it('rejects oversized files', () => {
    expect(() =>
      service.validateUploadFile(
        uploadedFile(
          'large.wav',
          'audio/wav',
          MAX_LIBRARY_UPLOAD_BYTES + 1
        )
      )
    ).toThrow(BadRequestException);
  });

  it('rejects empty files', () => {
    expect(() =>
      service.validateUploadFile(
        uploadedFile(
          'empty.wav',
          'audio/wav',
          0
        )
      )
    ).toThrow(BadRequestException);
  });

  it('writes beneath the authenticated user directory', async () => {
    const result: any = await firstValueFrom(
      service.uploadFile(
        uploadedFile(
          'track.wav',
          'audio/wav'
        ),
        {
          type: 'audio',
          title: 'Private track',
        },
        userId
      )
    );

    const userRoot = path.join(
      tempDir,
      userId
    );

    const files = await fs.readdir(
      userRoot
    );

    expect(files).toHaveLength(1);

    expect(result.fileUrl).toBe(
      `/uploads/library/${userId}/${files[0]}`
    );
  });

  it('does not delete another users locator', async () => {
    const userRoot = path.join(
      tempDir,
      userId
    );

    await fs.mkdir(
      userRoot,
      { recursive: true }
    );

    const filePath = path.join(
      userRoot,
      'owned.wav'
    );

    await fs.writeFile(
      filePath,
      Buffer.from('owned')
    );

    await firstValueFrom(
      service.deleteOwnedFile(
        `/uploads/library/${userId}/owned.wav`,
        otherUserId
      )
    );

    await expect(
      fs.access(filePath)
    ).resolves.toBeUndefined();
  });

  it('blocks traversal locators', async () => {
    const outsideFile = path.join(
      tempDir,
      'outside.wav'
    );

    await fs.writeFile(
      outsideFile,
      Buffer.from('outside')
    );

    await firstValueFrom(
      service.deleteOwnedFile(
        `/uploads/library/${userId}/../outside.wav`,
        userId
      )
    );

    await expect(
      fs.access(outsideFile)
    ).resolves.toBeUndefined();
  });

  it('deletes an owned file', async () => {
    const userRoot = path.join(
      tempDir,
      userId
    );

    await fs.mkdir(
      userRoot,
      { recursive: true }
    );

    const filePath = path.join(
      userRoot,
      'owned.wav'
    );

    await fs.writeFile(
      filePath,
      Buffer.from('owned')
    );

    await firstValueFrom(
      service.deleteOwnedFile(
        `/uploads/library/${userId}/owned.wav`,
        userId
      )
    );

    await expect(
      fs.access(filePath)
    ).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('removes physical upload when persistence fails', async () => {
    saveError = new Error(
      'simulated persistence failure'
    );

    await expect(
      firstValueFrom(
        service.uploadFile(
          uploadedFile(
            'orphan.wav',
            'audio/wav'
          ),
          {
            type: 'audio',
            title: 'Orphan test',
          },
          userId
        )
      )
    ).rejects.toThrow(
      'simulated persistence failure'
    );

    const files = await fs.readdir(
      path.join(
        tempDir,
        userId
      )
    );

    expect(files).toEqual([]);
  });
});
