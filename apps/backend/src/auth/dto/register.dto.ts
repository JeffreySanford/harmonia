import { IsEmail, IsString, MinLength, MaxLength, Matches } from 'class-validator';

/**
 * Register DTO
 * 
 * Data Transfer Object for user registration.
 * 
 * **Validation Rules**:
 * - Email: Valid email format (lowercase, trimmed)
 * - Username: 3-20 characters, alphanumeric + underscores only
 * - Password: Minimum 8 characters
 * 
 * **Example**:
 * ```json
 * {
 *   "email": "user@example.com",
 *   "username": "johndoe",
 *   "password": "securepassword123"
 * }
 * ```
 */
export class RegisterDto {
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @IsString()
  @MinLength(3, { message: 'Username must be at least 3 characters long' })
  @MaxLength(20, { message: 'Username must be less than 20 characters' })
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'Username can only contain letters, numbers, and underscores'
  })
  username: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password: string;
}
