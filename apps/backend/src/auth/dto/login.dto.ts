import { IsString } from 'class-validator';

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
  emailOrUsername: string;

  @IsString({ message: 'Please provide password' })
  password: string;
}
