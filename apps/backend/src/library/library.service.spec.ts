import {
  BadRequestException,
} from '@nestjs/common';
import {
  getModelToken,
} from '@nestjs/mongoose';
import {
  Test,
  type TestingModule,
} from '@nestjs/testing';
import {
  Types,
} from 'mongoose';
import {
  firstValueFrom,
} from 'rxjs';
import {
  promises as fs,
} from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import {
  LibraryItem,
  type LibraryItemDocument,
} from '../schemas/library-item.schema';
import {
  type CreateLibraryItemInput,
  LibraryService,
  type LibraryUploadFile,
  MAX_LIBRARY_UPLOAD_BYTES,
} from './library.service';

describe(
  'LibraryService private upload security',
  () => {
    const userId =
      '507f1f77bcf86cd799439011';

    const otherUserId =
      '507f191e810c19729de860ea';

    interface PersistedLibraryInput
      extends CreateLibraryItemInput {
      userId: string;
      playCount: number;
      downloadCount: number;
    }

    interface OwnedLibraryQuery {
      _id: Types.ObjectId;
      userId: Types.ObjectId;
    }

    interface LibraryFixtureOptions {
      id: string;
      ownerId?: string;
      type?: LibraryItem['type'];
      title?: string;
      fileUrl: string;
      fileType?: string;
    }

    let tempDir:
      string;

    let service:
      LibraryService;

    let saveError:
      Error | null;

    function uploadedFile(
      originalname: string,
      mimetype: string,
      size = 1
    ): LibraryUploadFile {
      return {
        fieldname:
          'file',
        originalname,
        encoding:
          '7bit',
        mimetype,
        buffer:
          Buffer.from('x'),
        size,
      };
    }

    function libraryDocument(
      options:
        LibraryFixtureOptions
    ): LibraryItemDocument {
      return {
        _id:
          new Types.ObjectId(
            options.id
          ),
        userId:
          new Types.ObjectId(
            options.ownerId ||
            userId
          ),
        type:
          options.type ||
          'audio',
        title:
          options.title ||
          'Library fixture',
        fileUrl:
          options.fileUrl,
        fileType:
          options.fileType ||
          'wav',
        metadata: {},
        isPublic: false,
        playCount: 0,
        downloadCount: 0,
        createdAt:
          new Date(),
        updatedAt:
          new Date(),
      } as LibraryItemDocument;
    }

    function setUploadDir(
      target:
        LibraryService,
      directory:
        string
    ): void {
      Object.defineProperty(
        target,
        'uploadDir',
        {
          value:
            directory,
          configurable:
            true,
        }
      );
    }

    async function createService(
      model:
        object
    ): Promise<LibraryService> {
      const module:
        TestingModule =
          await Test
            .createTestingModule({
              providers: [
                LibraryService,
                {
                  provide:
                    getModelToken(
                      LibraryItem.name
                    ),
                  useValue:
                    model,
                },
              ],
            })
            .compile();

      const instance =
        module.get<LibraryService>(
          LibraryService
        );

      setUploadDir(
        instance,
        tempDir
      );

      return instance;
    }

    function ownedQueryMatches(
      query:
        OwnedLibraryQuery,
      itemId:
        string,
      ownerId:
        string
    ): boolean {
      return (
        query._id.toString() ===
          itemId &&
        query.userId.toString() ===
          ownerId
      );
    }

    function modelWithOwnedItem(
      item:
        LibraryItemDocument,
      itemId:
        string,
      ownerId:
        string
    ) {
      const findOne =
        jest.fn(
          (
            query:
              OwnedLibraryQuery
          ) => ({
            exec:
              jest
                .fn()
                .mockResolvedValue(
                  ownedQueryMatches(
                    query,
                    itemId,
                    ownerId
                  )
                    ? item
                    : null
                ),
          })
        );

      return Object.assign(
        jest.fn(),
        {
          findOne,
          findById:
            jest.fn(
              async (
                id:
                  string
              ) =>
                id === itemId
                  ? item
                  : null
            ),
          findByIdAndDelete:
            jest.fn(
              async () =>
                item
            ),
          findOneAndDelete:
            jest.fn(
              () => ({
                exec:
                  jest
                    .fn()
                    .mockResolvedValue(
                      item
                    ),
              })
            ),
        }
      );
    }

    beforeEach(
      async () => {
        tempDir =
          await fs.mkdtemp(
            path.join(
              os.tmpdir(),
              'harmonia-library-test-'
            )
          );

        saveError =
          null;

        const modelConstructor =
          jest
            .fn()
            .mockImplementation(
              (
                dto:
                  PersistedLibraryInput
              ) => {
                const document =
                  libraryDocument({
                    id:
                      new Types
                        .ObjectId()
                        .toString(),
                    ownerId:
                      dto.userId,
                    type:
                      dto.type,
                    title:
                      dto.title,
                    fileUrl:
                      dto.fileUrl,
                    fileType:
                      dto.fileType ||
                      'wav',
                  });

                document.description =
                  dto.description;

                document.fileSize =
                  dto.fileSize;

                document.duration =
                  dto.duration;

                document.thumbnailUrl =
                  dto.thumbnailUrl;

                document.metadata =
                  dto.metadata || {};

                document.isPublic =
                  dto.isPublic ||
                  false;

                document.playCount =
                  dto.playCount;

                document.downloadCount =
                  dto.downloadCount;

                Object.defineProperty(
                  document,
                  'save',
                  {
                    value:
                      jest.fn(
                        async () => {
                          if (
                            saveError
                          ) {
                            throw saveError;
                          }

                          return document;
                        }
                      ),
                    configurable:
                      true,
                  }
                );

                return document;
              }
            );

        service =
          await createService(
            modelConstructor
          );
      }
    );

    afterEach(
      async () => {
        await fs.rm(
          tempDir,
          {
            recursive:
              true,
            force:
              true,
          }
        );
      }
    );

    it(
      'accepts supported MIME and extension pairs',
      () => {
        expect(
          service[
            'validateUploadFile'
          ](
            uploadedFile(
              'track.wav',
              'audio/wav'
            )
          )
        ).toEqual({
          fileType:
            'wav',
          extension:
            '.wav',
        });

        expect(
          service[
            'validateUploadFile'
          ](
            uploadedFile(
              'track.mp3',
              'audio/mpeg'
            )
          )
        ).toEqual({
          fileType:
            'mp3',
          extension:
            '.mp3',
        });

        expect(
          service[
            'validateUploadFile'
          ](
            uploadedFile(
              'track.flac',
              'audio/flac'
            )
          )
        ).toEqual({
          fileType:
            'flac',
          extension:
            '.flac',
        });

        expect(
          service[
            'validateUploadFile'
          ](
            uploadedFile(
              'metadata.json',
              'application/json'
            )
          )
        ).toEqual({
          fileType:
            'json',
          extension:
            '.json',
        });
      }
    );

    it(
      'rejects MIME and extension mismatch',
      () => {
        expect(
          () =>
            service[
              'validateUploadFile'
            ](
              uploadedFile(
                'fake.mp3',
                'audio/wav'
              )
            )
        ).toThrow(
          BadRequestException
        );
      }
    );

    it(
      'rejects unsupported MIME types',
      () => {
        expect(
          () =>
            service[
              'validateUploadFile'
            ](
              uploadedFile(
                'payload.exe',
                'application/octet-stream'
              )
            )
        ).toThrow(
          BadRequestException
        );
      }
    );

    it(
      'rejects oversized files',
      () => {
        expect(
          () =>
            service[
              'validateUploadFile'
            ](
              uploadedFile(
                'large.wav',
                'audio/wav',
                MAX_LIBRARY_UPLOAD_BYTES +
                  1
              )
            )
        ).toThrow(
          BadRequestException
        );
      }
    );

    it(
      'rejects empty files',
      () => {
        expect(
          () =>
            service[
              'validateUploadFile'
            ](
              uploadedFile(
                'empty.wav',
                'audio/wav',
                0
              )
            )
        ).toThrow(
          BadRequestException
        );
      }
    );

    it(
      'writes beneath the authenticated user directory',
      async () => {
        const result =
          await firstValueFrom(
            service.uploadFile(
              uploadedFile(
                'track.wav',
                'audio/wav'
              ),
              {
                type:
                  'audio',
                title:
                  'Private track',
              },
              userId
            )
          );

        const userRoot =
          path.join(
            tempDir,
            userId
          );

        const files =
          await fs.readdir(
            userRoot
          );

        expect(
          files
        ).toHaveLength(1);

        expect(
          result.fileUrl
        ).toBe(
          `/uploads/library/${userId}/${files[0]}`
        );
      }
    );

    it(
      'does not delete another users locator',
      async () => {
        const userRoot =
          path.join(
            tempDir,
            userId
          );

        await fs.mkdir(
          userRoot,
          {
            recursive:
              true,
          }
        );

        const filePath =
          path.join(
            userRoot,
            'owned.wav'
          );

        await fs.writeFile(
          filePath,
          Buffer.from(
            'owned'
          )
        );

        await firstValueFrom(
          service[
            'deleteOwnedFile'
          ](
            `/uploads/library/${userId}/owned.wav`,
            otherUserId
          )
        );

        await expect(
          fs.access(
            filePath
          )
        ).resolves
          .toBeUndefined();
      }
    );

    it(
      'blocks traversal locators',
      async () => {
        const outsideFile =
          path.join(
            tempDir,
            'outside.wav'
          );

        await fs.writeFile(
          outsideFile,
          Buffer.from(
            'outside'
          )
        );

        await firstValueFrom(
          service[
            'deleteOwnedFile'
          ](
            `/uploads/library/${userId}/../outside.wav`,
            userId
          )
        );

        await expect(
          fs.access(
            outsideFile
          )
        ).resolves
          .toBeUndefined();
      }
    );

    it(
      'deletes an owned file',
      async () => {
        const userRoot =
          path.join(
            tempDir,
            userId
          );

        await fs.mkdir(
          userRoot,
          {
            recursive:
              true,
          }
        );

        const filePath =
          path.join(
            userRoot,
            'owned.wav'
          );

        await fs.writeFile(
          filePath,
          Buffer.from(
            'owned'
          )
        );

        await firstValueFrom(
          service[
            'deleteOwnedFile'
          ](
            `/uploads/library/${userId}/owned.wav`,
            userId
          )
        );

        await expect(
          fs.access(
            filePath
          )
        ).rejects
          .toMatchObject({
            code:
              'ENOENT',
          });
      }
    );

    it(
      'removes physical upload when persistence fails',
      async () => {
        saveError =
          new Error(
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
                type:
                  'audio',
                title:
                  'Orphan test',
              },
              userId
            )
          )
        ).rejects.toThrow(
          'simulated persistence failure'
        );

        const files =
          await fs.readdir(
            path.join(
              tempDir,
              userId
            )
          );

        expect(
          files
        ).toEqual([]);
      }
    );

    it(
      'reads an owned legacy flat library file',
      async () => {
        const itemId =
          '507f1f77bcf86cd799439012';

        const filePath =
          path.join(
            tempDir,
            'legacy.wav'
          );

        await fs.writeFile(
          filePath,
          Buffer.from(
            'legacy'
          )
        );

        const item =
          libraryDocument({
            id:
              itemId,
            fileUrl:
              '/uploads/library/legacy.wav',
            title:
              'Legacy owned track',
          });

        const model =
          modelWithOwnedItem(
            item,
            itemId,
            userId
          );

        const legacyService =
          await createService(
            model
          );

        const resolved =
          await legacyService
            .resolveOwnedFile(
              itemId,
              userId
            );

        expect(
          resolved.filePath
        ).toBe(
          filePath
        );

        expect(
          resolved.filename
        ).toBe(
          'legacy.wav'
        );

        expect(
          resolved.contentType
        ).toBe(
          'audio/wav'
        );
      }
    );

    it(
      'denies another user access to a legacy flat library file',
      async () => {
        const itemId =
          '507f1f77bcf86cd799439013';

        const filePath =
          path.join(
            tempDir,
            'private-legacy.wav'
          );

        await fs.writeFile(
          filePath,
          Buffer.from(
            'private'
          )
        );

        const item =
          libraryDocument({
            id:
              itemId,
            fileUrl:
              '/uploads/library/private-legacy.wav',
          });

        const model =
          modelWithOwnedItem(
            item,
            itemId,
            userId
          );

        const legacyService =
          await createService(
            model
          );

        await expect(
          legacyService
            .resolveOwnedFile(
              itemId,
              otherUserId
            )
        ).rejects.toThrow(
          'Library item not found'
        );

        await expect(
          fs.access(
            filePath
          )
        ).resolves
          .toBeUndefined();
      }
    );

    it(
      'deletes an owned legacy flat library file',
      async () => {
        const itemId =
          '507f1f77bcf86cd799439014';

        const filePath =
          path.join(
            tempDir,
            'delete-legacy.wav'
          );

        await fs.writeFile(
          filePath,
          Buffer.from(
            'legacy-delete'
          )
        );

        const item =
          libraryDocument({
            id:
              itemId,
            fileUrl:
              '/uploads/library/delete-legacy.wav',
            title:
              'Legacy delete',
          });

        const model =
          modelWithOwnedItem(
            item,
            itemId,
            userId
          );

        const legacyService =
          await createService(
            model
          );

        await firstValueFrom(
          legacyService.delete(
            itemId,
            userId
          )
        );

        await expect(
          fs.access(
            filePath
          )
        ).rejects
          .toMatchObject({
            code:
              'ENOENT',
          });
      }
    );

    it(
      'does not delete a legacy flat file for another user',
      async () => {
        const itemId =
          '507f1f77bcf86cd799439015';

        const filePath =
          path.join(
            tempDir,
            'cross-user-legacy.wav'
          );

        await fs.writeFile(
          filePath,
          Buffer.from(
            'owned-by-first-user'
          )
        );

        const item =
          libraryDocument({
            id:
              itemId,
            fileUrl:
              '/uploads/library/cross-user-legacy.wav',
            title:
              'Cross-user legacy',
          });

        const model =
          modelWithOwnedItem(
            item,
            itemId,
            userId
          );

        const legacyService =
          await createService(
            model
          );

        await expect(
          firstValueFrom(
            legacyService.delete(
              itemId,
              otherUserId
            )
          )
        ).rejects
          .toBeDefined();

        await expect(
          fs.access(
            filePath
          )
        ).resolves
          .toBeUndefined();

        expect(
          model
            .findByIdAndDelete
        ).not
          .toHaveBeenCalled();

        expect(
          model
            .findOneAndDelete
        ).not
          .toHaveBeenCalled();
      }
    );
  }
);
