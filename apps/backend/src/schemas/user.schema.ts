import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import * as bcrypt from 'bcrypt';

/**
 * Interface for User document with instance methods
 */
export interface UserDocument extends Document {
  email: string;
  username: string;
  password: string;
  role: string;
  firstName?: string;
  lastName?: string;
  bio?: string;
  avatarUrl?: string;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

/**
 * User Schema
 *
 * MongoDB schema for user authentication and profile data.
 *
 * **Fields**:
 * - `email` - Unique email address (required)
 * - `username` - Unique username (required)
 * - `password` - Hashed password (bcrypt, required)
 * - `role` - User role: 'user', 'admin', 'guest' (default: 'user')
 * - `createdAt` - Account creation timestamp
 * - `updatedAt` - Last update timestamp
 *
 * **Security**:
 * - Passwords are automatically hashed before saving using bcrypt (10 rounds)
 * - Pre-save hook ensures password is hashed on creation and updates
 * - Password comparison method for authentication
 *
 * **Indexes**:
 * - Unique index on email
 * - Unique index on username
 *
 * @see {@link file://./../../docs/AUTHENTICATION_SYSTEM.md} for complete auth architecture
 */
@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true, unique: true, trim: true })
  username: string;

  @Prop({ required: true })
  password: string;

  @Prop({
    default: 'user',
    enum: ['user', 'admin', 'guest'],
    type: String,
  })
  role: string;

  // Profile fields
  @Prop()
  firstName?: string;

  @Prop()
  lastName?: string;

  @Prop()
  bio?: string;

  @Prop()
  avatarUrl?: string;

  @Prop({ default: false })
  isPublic: boolean;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

/**
 * Pre-save hook to automatically hash password
 * Runs before document is saved to MongoDB
 * Only hashes if password field has been modified
 */
UserSchema.pre('save', async function (next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

/**
 * Instance method to compare passwords
 * Attached to schema for use in authentication
 */
UserSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};
