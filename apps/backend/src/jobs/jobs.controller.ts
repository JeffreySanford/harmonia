import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateJobDto, JobFiltersDto } from './dto/jobs.dto';
import { JobsService } from './jobs.service';

@Controller('jobs')
@ApiTags('jobs')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Get()
  findAll(@Request() req: any, @Query() filters: JobFiltersDto) {
    return this.jobs.findAll(req.user.userId, filters);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.jobs.findOne(id, req.user.userId);
  }

  @Post()
  create(@Body() dto: CreateJobDto, @Request() req: any) {
    return this.jobs.create(dto, req.user.userId);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string, @Request() req: any) {
    return this.jobs.cancel(id, req.user.userId);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Request() req: any) {
    await this.jobs.remove(id, req.user.userId);
  }
}
