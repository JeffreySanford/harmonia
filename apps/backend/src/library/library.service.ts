import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { promises as fs } from 'fs';
import * as path from 'path';
import { Observable, from } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';
import {
  LibraryItem,
  LibraryItemDocument,
} from '../schemas/library-item.schema';

export interface LibraryUploadFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  buffer?: Buffer;
  path?: string;
  size: number;
  filename?: string;
}

export const MAX_LIBRARY_UPLOAD_BYTES = 100 * 1024 * 1024;

export interface ResolvedPrivateFile {
  filePath: string;
  filename: string;
  contentType: string;
  size: number;
}

@Injectable()
export class LibraryService {
  private readonly uploadDir = path.join(process.cwd(), 'uploads', 'library');

  constructor(
    @InjectModel(LibraryItem.name)
    private libraryItemModel: Model<LibraryItemDocument>
  ) {
    // Ensure upload directory exists
    this.ensureUploadDirExists();
  }

  private async ensureUploadDirExists() {
    try {
      await fs.access(this.uploadDir);
    } catch {
      await fs.mkdir(this.uploadDir, { recursive: true });
    }
  }

  findByUserId(
    userId: string,
    filters: any,
    page: number
  ): Observable<{
    items: any[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const pageSize = 20;
    const skip = (page - 1) * pageSize;

    // Build query
    const query: any = { userId };

    if (filters.type && filters.type !== 'all') {
      query.type = filters.type;
    }

    if (filters.search) {
      query.$text = { $search: filters.search };
    }

    // Build sort
    let sort: any = { createdAt: -1 }; // Default: newest first

    if (filters.sortBy === 'oldest') {
      sort = { createdAt: 1 };
    } else if (filters.sortBy === 'title') {
      sort = { title: 1 };
    } else if (filters.sortBy === 'mostPlayed') {
      sort = { playCount: -1 };
    }

    // Execute query with pagination
    return from(
      Promise.all([
        this.libraryItemModel
          .find(query)
          .sort(sort)
          .skip(skip)
          .limit(pageSize)
          .exec(),
        this.libraryItemModel.countDocuments(query),
      ])
    ).pipe(
      map(([items, total]) => ({
        items: items.map((item) => this.mapToDto(item)),
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      })),
      catchError((error) => {
        throw error;
      })
    );
  }

  findById(id: string, userId: string): Observable<any> {
    return from(this.libraryItemModel.findById(id)).pipe(
      map((item) => {
        if (!item) {
          throw new NotFoundException('Library item not found');
        }

        // Ensure user owns this item
        if (item.userId.toString() !== userId) {
          throw new ForbiddenException('You do not have access to this item');
        }

        return this.mapToDto(item);
      }),
      catchError((error) => {
        throw error;
      })
    );
  }

  async resolveOwnedFile(
    id: string,
    userId: string
  ): Promise<ResolvedPrivateFile> {
    if (
      !Types.ObjectId.isValid(id) ||
      !Types.ObjectId.isValid(userId)
    ) {
      throw new NotFoundException(
        'Library item not found'
      );
    }

    const item = await this.libraryItemModel
      .findOne({
        _id: new Types.ObjectId(id),
        userId: new Types.ObjectId(userId),
      })
      .exec();

    if (!item) {
      throw new NotFoundException(
        'Library item not found'
      );
    }

    const resolvedStorage =
      this.resolveOwnedStoragePath(
        item.fileUrl,
        userId,
        true
      );

    if (!resolvedStorage) {
      throw new NotFoundException(
        'Library file not found'
      );
    }

    const {
      filePath,
      storageName,
    } = resolvedStorage;

    let stat;

    try {
      stat = await fs.stat(filePath);
    } catch {
      throw new NotFoundException(
        'Library file not found'
      );
    }

    if (!stat.isFile()) {
      throw new NotFoundException(
        'Library file not found'
      );
    }

    const extension =
      path.extname(storageName).toLowerCase();

    const contentTypes: Record<string, string> = {
      '.wav': 'audio/wav',
      '.mp3': 'audio/mpeg',
      '.flac': 'audio/flac',
      '.json': 'application/json',
    };

    return {
      filePath,
      filename: storageName,
      contentType:
        contentTypes[extension] ||
        'application/octet-stream',
      size: stat.size,
    };
  }

  delete(id: string, userId: string): Observable<void> {
    return this.findById(id, userId).pipe(
      switchMap((item) => {
        // Delete file from storage (S3 or local filesystem)
        return this.deleteOwnedFile(item.fileUrl, userId, true).pipe(
          switchMap(() => from(this.libraryItemModel.findByIdAndDelete(id))),
          map(() => undefined)
        );
      }),
      catchError((error) => {
        throw error;
      })
    );
  }

  incrementPlayCount(
    id: string,
    userId: string
  ): Observable<void> {
    if (
      !Types.ObjectId.isValid(id) ||
      !Types.ObjectId.isValid(userId)
    ) {
      throw new NotFoundException(
        'Library item not found'
      );
    }

    return from(
      this.libraryItemModel.findOneAndUpdate(
        {
          _id: new Types.ObjectId(id),
          userId: new Types.ObjectId(userId),
        },
        {
          $inc: { playCount: 1 },
        }
      )
    ).pipe(
      map((item) => {
        if (!item) {
          throw new NotFoundException(
            'Library item not found'
          );
        }

        return undefined;
      })
    );
  }

  incrementDownloadCount(
    id: string,
    userId: string
  ): Observable<void> {
    if (
      !Types.ObjectId.isValid(id) ||
      !Types.ObjectId.isValid(userId)
    ) {
      throw new NotFoundException(
        'Library item not found'
      );
    }

    return from(
      this.libraryItemModel.findOneAndUpdate(
        {
          _id: new Types.ObjectId(id),
          userId: new Types.ObjectId(userId),
        },
        {
          $inc: { downloadCount: 1 },
        }
      )
    ).pipe(
      map((item) => {
        if (!item) {
          throw new NotFoundException(
            'Library item not found'
          );
        }

        return undefined;
      })
    );
  }

  create(createLibraryItemDto: any, userId: string): Observable<any> {
    const libraryItem = new this.libraryItemModel({
      ...createLibraryItemDto,
      userId,
      playCount: 0,
      downloadCount: 0,
    });

    return from(libraryItem.save()).pipe(
      map((savedItem) => this.mapToDto(savedItem)),
      catchError((error) => {
        throw error;
      })
    );
  }

  update(
    id: string,
    updateLibraryItemDto: any,
    userId: string
  ): Observable<any> {
    // First check if item exists and belongs to user
    return this.findById(id, userId).pipe(
      switchMap(() =>
        from(
          this.libraryItemModel
            .findByIdAndUpdate(id, updateLibraryItemDto, { new: true })
            .exec()
        )
      ),
      map((updatedItem) => {
        if (!updatedItem) {
          throw new NotFoundException('Library item not found after update');
        }
        return this.mapToDto(updatedItem);
      }),
      catchError((error) => {
        throw error;
      })
    );
  }

  private validateUploadFile(
    file: LibraryUploadFile
  ): {
    fileType: 'wav' | 'mp3' | 'flac' | 'json';
    extension: string;
  } {
    if (!file) {
      throw new BadRequestException(
        'File is required.'
      );
    }

    if (
      !Number.isFinite(file.size) ||
      file.size <= 0
    ) {
      throw new BadRequestException(
        'Uploaded file must not be empty.'
      );
    }

    if (file.size > MAX_LIBRARY_UPLOAD_BYTES) {
      throw new BadRequestException(
        'Uploaded file exceeds the maximum allowed size.'
      );
    }

    const extension =
      path.extname(file.originalname).toLowerCase();

    const mimeType =
      file.mimetype.toLowerCase();

    const policies: Record<
      string,
      {
        fileType: 'wav' | 'mp3' | 'flac' | 'json';
        mimeTypes: readonly string[];
      }
    > = {
      '.wav': {
        fileType: 'wav',
        mimeTypes: [
          'audio/wav',
          'audio/wave',
          'audio/x-wav',
        ],
      },
      '.mp3': {
        fileType: 'mp3',
        mimeTypes: [
          'audio/mpeg',
          'audio/mp3',
        ],
      },
      '.flac': {
        fileType: 'flac',
        mimeTypes: [
          'audio/flac',
          'audio/x-flac',
        ],
      },
      '.json': {
        fileType: 'json',
        mimeTypes: [
          'application/json',
          'text/json',
        ],
      },
    };

    const policy = policies[extension];

    if (
      !policy ||
      !policy.mimeTypes.includes(mimeType)
    ) {
      throw new BadRequestException(
        'Unsupported file type or MIME/extension mismatch.'
      );
    }

    return {
      fileType: policy.fileType,
      extension,
    };
  }

  uploadFile(
    file: LibraryUploadFile,
    body: any,
    userId: string
  ): Observable<any> {
    const {
      fileType,
      extension: fileExtension,
    } = this.validateUploadFile(file);

    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException(
        'Invalid authenticated user identity.'
      );
    }

    // Generate a server-controlled storage filename.
    const uniqueFilename =
      `${Date.now()}-${Math.random()
        .toString(36)
        .substring(2)}${fileExtension}`;

    const uploadRoot =
      path.resolve(this.uploadDir);

    const userRoot =
      path.resolve(this.uploadDir, userId);

    if (
      !userRoot.startsWith(
        `${uploadRoot}${path.sep}`
      )
    ) {
      throw new BadRequestException(
        'Invalid upload storage path.'
      );
    }

    const filePath =
      path.resolve(userRoot, uniqueFilename);

    if (
      !filePath.startsWith(
        `${userRoot}${path.sep}`
      )
    ) {
      throw new BadRequestException(
        'Invalid upload file path.'
      );
    }

    const writeFile = (): Observable<void> => {
      if (file.buffer) {
        return from(
          fs.writeFile(
            filePath,
            file.buffer
          )
        );
      }

      if (file.path) {
        return from(
          fs.rename(
            file.path,
            filePath
          )
        );
      }

      throw new BadRequestException(
        'File buffer or path is required.'
      );
    };

    return from(
      fs.mkdir(
        userRoot,
        { recursive: true }
      )
    ).pipe(
      switchMap(() => writeFile()),
      switchMap(() => {
        const fileUrl =
          `/uploads/library/${userId}/${uniqueFilename}`;

        const createDto = {
          type: body.type,
          title: body.title,
          description: body.description,
          fileUrl,
          fileType,
          fileSize: file.size,
        };

        return this.create(
          createDto,
          userId
        );
      }),
      catchError((error) =>
        from(
          fs.unlink(filePath).catch(() => undefined)
        ).pipe(
          switchMap(() => {
            throw error;
          })
        )
      )
    );
  }

  private mapToDto(item: LibraryItemDocument) {
    return {
      id: item._id.toString(),
      userId: item.userId.toString(),
      songId: item.songId?.toString(),
      type: item.type,
      title: item.title,
      description: item.description,
      fileUrl: item.fileUrl,
      fileType: item.fileType,
      fileSize: item.fileSize,
      duration: item.duration,
      thumbnailUrl: item.thumbnailUrl,
      metadata: item.metadata,
      isPublic: item.isPublic,
      playCount: item.playCount,
      downloadCount: item.downloadCount,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }

  private resolveOwnedStoragePath(
    fileUrl: string,
    userId: string,
    allowLegacy = false
  ): {
    filePath: string;
    storageName: string;
  } | null {
    const uploadRoot =
      path.resolve(this.uploadDir);

    const ownedPrefix =
      `/uploads/library/${userId}/`;

    if (fileUrl.startsWith(ownedPrefix)) {
      const storageName =
        fileUrl.slice(ownedPrefix.length);

      if (
        !storageName ||
        path.basename(storageName) !== storageName
      ) {
        return null;
      }

      const userRoot =
        path.resolve(this.uploadDir, userId);

      if (
        !userRoot.startsWith(
          `${uploadRoot}${path.sep}`
        )
      ) {
        return null;
      }

      const filePath =
        path.resolve(userRoot, storageName);

      if (
        !filePath.startsWith(
          `${userRoot}${path.sep}`
        )
      ) {
        return null;
      }

      return {
        filePath,
        storageName,
      };
    }

    if (!allowLegacy) {
      return null;
    }

    const legacyPrefix =
      '/uploads/library/';

    if (!fileUrl.startsWith(legacyPrefix)) {
      return null;
    }

    const storageName =
      fileUrl.slice(legacyPrefix.length);

    if (
      !storageName ||
      path.basename(storageName) !== storageName
    ) {
      return null;
    }

    const filePath =
      path.resolve(uploadRoot, storageName);

    if (
      !filePath.startsWith(
        `${uploadRoot}${path.sep}`
      )
    ) {
      return null;
    }

    return {
      filePath,
      storageName,
    };
  }

  private deleteOwnedFile(
    fileUrl: string,
    userId: string,
    allowLegacy = false
  ): Observable<void> {
    const resolvedStorage =
      this.resolveOwnedStoragePath(
        fileUrl,
        userId,
        allowLegacy
      );

    if (!resolvedStorage) {
      return from(
        Promise.resolve(undefined)
      );
    }

    return from(
      fs.unlink(resolvedStorage.filePath)
    ).pipe(
      map(() => undefined),
      catchError((error: NodeJS.ErrnoException) => {
        if (error.code === 'ENOENT') {
          return from(
            Promise.resolve(undefined)
          );
        }

        throw error;
      })
    );
  }
}
