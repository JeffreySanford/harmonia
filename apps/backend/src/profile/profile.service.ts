import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from '../schemas/user.schema';
import {
  UpdateProfileDto,
  ChangePasswordDto,
  ProfileResponseDto,
} from './dto/profile.dto';

@Injectable()
export class ProfileService {
  constructor(
    @InjectModel(User.name)
    private userModel: Model<UserDocument>
  ) {}

  async getProfile(userId: string): Promise<ProfileResponseDto> {
    const user = await this.userModel.findById(userId).select('-password');

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.mapToProfileResponse(user);
  }

  async updateProfile(
    userId: string,
    updateProfileDto: UpdateProfileDto
  ): Promise<ProfileResponseDto> {
    // Check for username/email uniqueness if they're being updated
    if (updateProfileDto.username) {
      const existingUser = await this.userModel.findOne({
        username: updateProfileDto.username,
        _id: { $ne: userId },
      });
      if (existingUser) {
        throw new BadRequestException('Username already taken');
      }
    }

    if (updateProfileDto.email) {
      const existingUser = await this.userModel.findOne({
        email: updateProfileDto.email,
        _id: { $ne: userId },
      });
      if (existingUser) {
        throw new BadRequestException('Email already taken');
      }
    }

    const updatedUser = await this.userModel
      .findByIdAndUpdate(userId, updateProfileDto, { new: true })
      .select('-password');

    if (!updatedUser) {
      throw new NotFoundException('User not found');
    }

    return this.mapToProfileResponse(updatedUser);
  }

  async changePassword(
    userId: string,
    changePasswordDto: ChangePasswordDto
  ): Promise<{ message: string }> {
    const user = await this.userModel.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(
      changePasswordDto.currentPassword,
      user.password
    );

    if (!isCurrentPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    // Hash new password
    const saltRounds = 10;
    const hashedNewPassword = await bcrypt.hash(
      changePasswordDto.newPassword,
      saltRounds
    );

    // Update password
    await this.userModel.findByIdAndUpdate(userId, {
      password: hashedNewPassword,
    });

    return { message: 'Password changed successfully' };
  }

  async deleteProfile(userId: string): Promise<{ message: string }> {
    const user = await this.userModel.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // TODO: Delete all user's library items and associated files
    // await this.libraryService.deleteAllByUserId(userId);

    await this.userModel.findByIdAndDelete(userId);

    return { message: 'Profile deleted successfully' };
  }

  private mapToProfileResponse(user: UserDocument): ProfileResponseDto {
    return {
      id: user._id.toString(),
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
      isPublic: user.isPublic || false,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
