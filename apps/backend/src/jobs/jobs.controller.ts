import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Request,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { createReadStream } from 'node:fs';
import { AuthenticatedRequestUser } from '../auth/auth-token.config';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateJobDto, JobFiltersDto } from './dto/jobs.dto';
import { JobsService } from './jobs.service';

interface AuthenticatedRequest {
  user: AuthenticatedRequestUser;
}

@Controller('jobs')
@ApiTags('jobs')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Get()
  findAll(
    @Request() req: AuthenticatedRequest,
    @Query() filters: JobFiltersDto
  ) {
    return this.jobs.findAll(
      req.user.userId,
      filters
    );
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest
  ) {
    return this.jobs.findOne(
      id,
      req.user.userId
    );
  }

  @Get(':id/artifact')
  async getArtifact(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest
  ): Promise<StreamableFile> {
    const artifact =
      await this.jobs.resolveOwnedArtifact(
        id,
        req.user.userId
      );

    return new StreamableFile(
      createReadStream(artifact.filePath),
      {
        type: artifact.contentType,
        disposition:
          `attachment; filename="${artifact.filename}"`,
        length: artifact.size,
      }
    );
  }

  @Post()
  create(
    @Body() dto: CreateJobDto,
    @Request() req: AuthenticatedRequest
  ) {
    return this.jobs.create(
      dto,
      req.user.userId
    );
  }

  @Post(':id/cancel')
  cancel(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest
  ) {
    return this.jobs.cancel(
      id,
      req.user.userId
    );
  }

  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest
  ) {
    await this.jobs.remove(
      id,
      req.user.userId
    );
  }
}
