import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LibraryService } from './library.service';
import {
  CreateLibraryItemDto,
  UpdateLibraryItemDto,
  LibraryFiltersDto,
} from './dto/library.dto';

@Controller('library')
@UseGuards(JwtAuthGuard)
export class LibraryController {
  constructor(private readonly libraryService: LibraryService) {}

  @Get()
  async findAll(@Request() req: any, @Query() filters: LibraryFiltersDto) {
    const page = filters.page || 1;
    return this.libraryService.findByUserId(req.user.userId, filters, page);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req: any) {
    return this.libraryService.findById(id, req.user.userId);
  }

  @Post()
  async create(
    @Body() createLibraryItemDto: CreateLibraryItemDto,
    @Request() req: any
  ) {
    return this.libraryService.create(createLibraryItemDto, req.user.userId);
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: any,
    @Body() body: { title: string; description?: string; type: string },
    @Request() req: any
  ) {
    return this.libraryService.uploadFile(file, body, req.user.userId);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateLibraryItemDto: UpdateLibraryItemDto,
    @Request() req: any
  ) {
    return this.libraryService.update(
      id,
      updateLibraryItemDto,
      req.user.userId
    );
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Request() req: any) {
    await this.libraryService.delete(id, req.user.userId);
    return { message: 'Library item deleted successfully' };
  }

  @Post(':id/play')
  async incrementPlayCount(@Param('id') id: string) {
    await this.libraryService.incrementPlayCount(id);
    return { message: 'Play count incremented' };
  }

  @Post(':id/download')
  async incrementDownloadCount(@Param('id') id: string) {
    await this.libraryService.incrementDownloadCount(id);
    return { message: 'Download count incremented' };
  }
}
