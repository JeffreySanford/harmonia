import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { promises as fs } from 'fs';
import * as path from 'path';
import { Observable, from } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';
import {
  LibraryItem,
  LibraryItemDocument,
} from '../schemas/library-item.schema';

interface UploadedFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  buffer?: Buffer;
  path?: string;
  size: number;
  filename?: string;
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

  delete(id: string, userId: string): Observable<void> {
    return this.findById(id, userId).pipe(
      switchMap((item) => {
        // Delete file from storage (S3 or local filesystem)
        return from(this.deleteFile(item.fileUrl)).pipe(
          switchMap(() => from(this.libraryItemModel.findByIdAndDelete(id))),
          map(() => undefined)
        );
      }),
      catchError((error) => {
        throw error;
      })
    );
  }

  incrementPlayCount(id: string): Observable<void> {
    return from(
      this.libraryItemModel.findByIdAndUpdate(id, {
        $inc: { playCount: 1 },
      })
    ).pipe(
      map(() => undefined),
      catchError((error) => {
        throw error;
      })
    );
  }

  incrementDownloadCount(id: string): Observable<void> {
    return from(
      this.libraryItemModel.findByIdAndUpdate(id, {
        $inc: { downloadCount: 1 },
      })
    ).pipe(
      map(() => undefined),
      catchError((error) => {
        throw error;
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

  uploadFile(file: UploadedFile, body: any, userId: string): Observable<any> {
    // Ensure the file object is valid
    if (!file) {
      throw new Error('File is required');
    }

    // Generate unique filename to prevent conflicts
    const fileExtension = path.extname(file.originalname);
    const uniqueFilename = `${Date.now()}-${Math.random()
      .toString(36)
      .substring(2)}${fileExtension}`;
    const filePath = path.join(this.uploadDir, uniqueFilename);

    // Write file to disk - handle both buffer and file path
    let fileWriteObservable: Observable<void>;
    if (file.buffer) {
      // File is in memory
      fileWriteObservable = from(fs.writeFile(filePath, file.buffer));
    } else if (file.path) {
      // File is already on disk, move it
      fileWriteObservable = from(fs.rename(file.path, filePath));
    } else {
      throw new Error('File buffer or path is required');
    }

    return fileWriteObservable.pipe(
      switchMap(() => {
        // Generate file URL (relative to server root)
        const fileUrl = `/uploads/library/${uniqueFilename}`;

        // Determine file type based on MIME type
        const mimeToFileType: { [key: string]: string } = {
          'audio/wav': 'wav',
          'audio/wave': 'wav',
          'audio/mpeg': 'mp3',
          'audio/mp3': 'mp3',
          'audio/flac': 'flac',
          'audio/x-flac': 'flac',
          'application/json': 'json',
          'text/json': 'json',
          'application/octet-stream': 'mp3', // For testing with text files
        };

        const fileType = mimeToFileType[file.mimetype] || 'mp3'; // Default to mp3 for unknown audio types

        const createDto = {
          type: body.type,
          title: body.title,
          description: body.description,
          fileUrl,
          fileType,
          fileSize: file.size,
        };

        return this.create(createDto, userId);
      }),
      catchError((error) => {
        throw error;
      })
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

  private deleteFile(fileUrl: string): Observable<void> {
    // Extract filename from URL
    const filename = path.basename(fileUrl);
    const filePath = path.join(this.uploadDir, filename);

    return from(fs.access(filePath)).pipe(
      switchMap(() => from(fs.unlink(filePath))),
      map(() => undefined),
      catchError((error) => {
        // Log error but don't throw - file might not exist or deletion might fail
        console.error('Error deleting file:', fileUrl, error);
        return from(Promise.resolve(undefined)); // Still complete successfully
      })
    );
  }
}
