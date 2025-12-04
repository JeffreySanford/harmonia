import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  LibraryItem,
  LibraryItemDocument,
} from '../schemas/library-item.schema';

@Injectable()
export class LibraryService {
  constructor(
    @InjectModel(LibraryItem.name)
    private libraryItemModel: Model<LibraryItemDocument>
  ) {}

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
    // TODO: Implement file deletion
    // If S3: await s3.deleteObject(...)
    // If local: await fs.promises.unlink(...)
    console.log('Deleting file:', fileUrl);
  }
}
