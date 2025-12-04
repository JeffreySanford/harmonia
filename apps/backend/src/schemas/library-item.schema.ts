import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type LibraryItemDocument = LibraryItem & Document;

@Schema({ timestamps: true })
export class LibraryItem {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Song', index: true })
  songId?: Types.ObjectId;  // Optional: Link to original song metadata

  @Prop({ required: true, enum: ['song', 'music', 'audio', 'style'] })
  type: 'song' | 'music' | 'audio' | 'style';

  @Prop({ required: true })
  title: string;

  @Prop()
  description?: string;

  @Prop({ required: true })
  fileUrl: string;  // S3 URL or local file path

  @Prop({ enum: ['wav', 'mp3', 'flac', 'json'] })
  fileType: string;

  @Prop()
  fileSize?: number;  // In bytes

  @Prop()
  duration?: number;  // Audio duration in seconds

  @Prop()
  thumbnailUrl?: string;  // Waveform image or album art

  @Prop({ type: Object })
  metadata: {
    genre?: string;
    mood?: string;
    bpm?: number;
    key?: string;
    instruments?: string[];
    model?: string;  // AI model used
    generationTime?: number;  // Time to generate (seconds)
  };

  @Prop({ default: false })
  isPublic: boolean;  // Future: Share with others

  @Prop({ default: 0 })
  playCount: number;

  @Prop({ default: 0 })
  downloadCount: number;

  // Timestamps added by @Schema({ timestamps: true })
  createdAt: Date;
  updatedAt: Date;
}

export const LibraryItemSchema = SchemaFactory.createForClass(LibraryItem);

// Compound index for efficient queries
LibraryItemSchema.index({ userId: 1, createdAt: -1 });
LibraryItemSchema.index({ userId: 1, type: 1 });
LibraryItemSchema.index({ userId: 1, title: 'text' });  // Text search