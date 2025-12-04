import { IsString, IsNotEmpty } from 'class-validator';

/**
 * Login DTO
 * 
 * Data Transfer Object for user login.
 * 
 * **Fields**:
 * - `emailOrUsername` - Can be either email or username
 * - `password` - Plain text password (will be compared with hash)
 * 
 * **Example**:
 * ```json
 * {
 *   "emailOrUsername": "johndoe",
 *   "password": "securepassword123"
 * }
 * ```
 * 
 * Or:
 * ```json
 * {
 *   "emailOrUsername": "user@example.com",
 *   "password": "securepassword123"
 * }
 * ```
 */
export class LoginDto {
  @IsString({ message: 'Please provide email or username' })
  @IsNotEmpty({ message: 'Email or username cannot be empty' })
  emailOrUsername: string;

  @IsString({ message: 'Please provide password' })
  @IsNotEmpty({ message: 'Password cannot be empty' })
  password: string;
}
