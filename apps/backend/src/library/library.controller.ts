import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Request,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { createReadStream } from 'node:fs';
import { map } from 'rxjs/operators';
import { AuthenticatedRequestUser } from '../auth/auth-token.config';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  LibraryFiltersDto,
  UpdateLibraryItemDto,
} from './dto/library.dto';
import { LibraryService } from './library.service';

interface AuthenticatedRequest {
  user: AuthenticatedRequestUser;
}

@Controller('library')
@UseGuards(JwtAuthGuard)
export class LibraryController {
  constructor(private readonly libraryService: LibraryService) {}

  @Get()
  findAll(
    @Request() req: AuthenticatedRequest,
    @Query() filters: LibraryFiltersDto
  ) {
    const page = filters.page || 1;
    return this.libraryService.findByUserId(
      req.user.userId,
      filters,
      page
    );
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest
  ) {
    return this.libraryService.findById(
      id,
      req.user.userId
    );
  }

  @Get(':id/file')
  async getFile(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest
  ): Promise<StreamableFile> {
    const file =
      await this.libraryService.resolveOwnedFile(
        id,
        req.user.userId
      );

    return new StreamableFile(
      createReadStream(file.filePath),
      {
        type: file.contentType,
        disposition:
          `attachment; filename="${file.filename}"`,
        length: file.size,
      }
    );
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body()
    body: {
      title: string;
      description?: string;
      type: string;
    },
    @Request() req: AuthenticatedRequest
  ) {
    return this.libraryService.uploadFile(
      file,
      body,
      req.user.userId
    );
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() updateLibraryItemDto: UpdateLibraryItemDto,
    @Request() req: AuthenticatedRequest
  ) {
    return this.libraryService.update(
      id,
      updateLibraryItemDto,
      req.user.userId
    );
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest
  ) {
    return this.libraryService
      .delete(id, req.user.userId)
      .pipe(
        map(() => ({
          message:
            'Library item deleted successfully',
        }))
      );
  }

  @Post(':id/play')
  incrementPlayCount(
    @Param('id') id: string
  ) {
    return this.libraryService
      .incrementPlayCount(id)
      .pipe(
        map(() => ({
          message: 'Play count incremented',
        }))
      );
  }

  @Post(':id/download')
  incrementDownloadCount(
    @Param('id') id: string
  ) {
    return this.libraryService
      .incrementDownloadCount(id)
      .pipe(
        map(() => ({
          message: 'Download count incremented',
        }))
      );
  }
}
