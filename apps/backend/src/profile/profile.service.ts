import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { Observable, from } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';
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

  getProfile(userId: string): Observable<ProfileResponseDto> {
    return from(this.userModel.findById(userId).select('-password')).pipe(
      map((user) => {
        if (!user) {
          throw new NotFoundException('User not found');
        }
        return this.mapToProfileResponse(user);
      }),
      catchError((error) => {
        throw error;
      })
    );
  }

  updateProfile(
    userId: string,
    updateProfileDto: UpdateProfileDto
  ): Observable<ProfileResponseDto> {
    // Check for username uniqueness if being updated
    let uniquenessCheck$: Observable<any>;
    if (updateProfileDto.username) {
      uniquenessCheck$ = from(
        this.userModel.findOne({
          username: updateProfileDto.username,
          _id: { $ne: userId },
        })
      ).pipe(
        map((existingUser) => {
          if (existingUser) {
            throw new BadRequestException('Username already taken');
          }
          return null;
        })
      );
    } else {
      uniquenessCheck$ = from(Promise.resolve(null));
    }

    return uniquenessCheck$.pipe(
      switchMap(() => {
        // Check for email uniqueness if being updated
        if (updateProfileDto.email) {
          return from(
            this.userModel.findOne({
              email: updateProfileDto.email,
              _id: { $ne: userId },
            })
          ).pipe(
            map((existingUser) => {
              if (existingUser) {
                throw new BadRequestException('Email already taken');
              }
              return null;
            })
          );
        }
        return from(Promise.resolve(null));
      }),
      switchMap(() =>
        from(
          this.userModel
            .findByIdAndUpdate(userId, updateProfileDto, { new: true })
            .select('-password')
        )
      ),
      map((updatedUser) => {
        if (!updatedUser) {
          throw new NotFoundException('User not found');
        }
        return this.mapToProfileResponse(updatedUser);
      }),
      catchError((error) => {
        throw error;
      })
    );
  }

  changePassword(
    userId: string,
    changePasswordDto: ChangePasswordDto
  ): Observable<{ message: string }> {
    return from(this.userModel.findById(userId)).pipe(
      switchMap((user) => {
        if (!user) {
          throw new NotFoundException('User not found');
        }

        // Verify current password
        return from(
          bcrypt.compare(changePasswordDto.currentPassword, user.password)
        ).pipe(
          map((isCurrentPasswordValid) => {
            if (!isCurrentPasswordValid) {
              throw new BadRequestException('Current password is incorrect');
            }
            return user;
          })
        );
      }),
      switchMap((user) => {
        // Hash new password
        const saltRounds = 10;
        return from(
          bcrypt.hash(changePasswordDto.newPassword, saltRounds)
        ).pipe(map((hashedNewPassword) => ({ user, hashedNewPassword })));
      }),
      switchMap(({ user, hashedNewPassword }) => {
        // Update password
        return from(
          this.userModel.findByIdAndUpdate(user._id, {
            password: hashedNewPassword,
          })
        ).pipe(
          map(() => ({ message: 'Password changed successfully' }))
        );
      }),
      catchError((error) => {
        throw error;
      })
    );
  }

  deleteProfile(userId: string): Observable<{ message: string }> {
    return from(this.userModel.findById(userId)).pipe(
      switchMap((user) => {
        if (!user) {
          throw new NotFoundException('User not found');
        }

        // TODO: Delete all user's library items and associated files
        // await this.libraryService.deleteAllByUserId(userId);

        return from(this.userModel.findByIdAndDelete(userId)).pipe(
          map(() => ({ message: 'Profile deleted successfully' }))
        );
      }),
      catchError((error) => {
        throw error;
      })
    );
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
