import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProfileService } from './profile.service';
import { UpdateProfileDto, ChangePasswordDto } from './dto/profile.dto';

@Controller('user/profile')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  getProfile(@Request() req: any) {
    return this.profileService.getProfile(req.user.userId);
  }

  @Put()
  updateProfile(
    @Body() updateProfileDto: UpdateProfileDto,
    @Request() req: any
  ) {
    return this.profileService.updateProfile(req.user.userId, updateProfileDto);
  }

  @Post('change-password')
  changePassword(
    @Body() changePasswordDto: ChangePasswordDto,
    @Request() req: any
  ) {
    return this.profileService.changePassword(
      req.user.userId,
      changePasswordDto
    );
  }

  @Delete()
  deleteProfile(@Request() req: any) {
    return this.profileService.deleteProfile(req.user.userId);
  }
}
