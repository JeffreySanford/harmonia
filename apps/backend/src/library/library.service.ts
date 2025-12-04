import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { promises as fs } from 'fs';
import * as path from 'path';
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

  async findByUserId(userId: string, filters: any, page: number) {
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
    const [items, total] = await Promise.all([
      this.libraryItemModel
        .find(query)
        .sort(sort)
        .skip(skip)
        .limit(pageSize)
        .exec(),
      this.libraryItemModel.countDocuments(query),
    ]);

    return {
      items: items.map((item) => this.mapToDto(item)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findById(id: string, userId: string) {
    const item = await this.libraryItemModel.findById(id);

    if (!item) {
      throw new NotFoundException('Library item not found');
    }

    // Ensure user owns this item
    if (item.userId.toString() !== userId) {
      throw new ForbiddenException('You do not have access to this item');
    }

    return this.mapToDto(item);
  }

  async delete(id: string, userId: string) {
    const item = await this.findById(id, userId);

    // Delete file from storage (S3 or local filesystem)
    await this.deleteFile(item.fileUrl);

    // Delete from database
    await this.libraryItemModel.findByIdAndDelete(id);
  }

  async incrementPlayCount(id: string) {
    await this.libraryItemModel.findByIdAndUpdate(id, {
      $inc: { playCount: 1 },
    });
  }

  async incrementDownloadCount(id: string) {
    await this.libraryItemModel.findByIdAndUpdate(id, {
      $inc: { downloadCount: 1 },
    });
  }

  async create(createLibraryItemDto: any, userId: string) {
    const libraryItem = new this.libraryItemModel({
      ...createLibraryItemDto,
      userId,
      playCount: 0,
      downloadCount: 0,
    });

    const savedItem = await libraryItem.save();
    return this.mapToDto(savedItem);
  }

  async update(id: string, updateLibraryItemDto: any, userId: string) {
    // First check if item exists and belongs to user
    await this.findById(id, userId);

    const updatedItem = await this.libraryItemModel
      .findByIdAndUpdate(id, updateLibraryItemDto, { new: true })
      .exec();

    if (!updatedItem) {
      throw new NotFoundException('Library item not found after update');
    }
    return this.mapToDto(updatedItem);
  }

  async uploadFile(file: UploadedFile, body: any, userId: string) {
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
    if (file.buffer) {
      // File is in memory
      await fs.writeFile(filePath, file.buffer);
    } else if (file.path) {
      // File is already on disk, move it
      await fs.rename(file.path, filePath);
    } else {
      throw new Error('File buffer or path is required');
    }

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

  private async deleteFile(fileUrl: string) {
    try {
      // Extract filename from URL
      const filename = path.basename(fileUrl);
      const filePath = path.join(this.uploadDir, filename);

      // Check if file exists before attempting to delete
      await fs.access(filePath);
      await fs.unlink(filePath);
    } catch (error) {
      // Log error but don't throw - file might not exist or deletion might fail
      console.error('Error deleting file:', fileUrl, error);
    }
  }
}
