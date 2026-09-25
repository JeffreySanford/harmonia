import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ModelInstallationDocument = ModelInstallation & Document;

export type ModelInstallationStatus =
  | 'missing'
  | 'verified'
  | 'degraded'
  | 'corrupt'
  | 'unavailable'
  | 'failed';

export type ModelInstallationSourceKind =
  | 'huggingface'
  | 'http-zip';

@Schema({
  timestamps: true,
  collection: 'model_installations',
  versionKey: false,
})
export class ModelInstallation {
  @Prop({
    required: true,
    trim: true,
  })
  artifactId!: string;

  @Prop({
    required: true,
    trim: true,
  })
  providerId!: string;

  @Prop({
    type: [String],
    required: true,
    default: [],
  })
  modelIds!: string[];

  @Prop({
    type: [String],
    required: true,
    default: [],
  })
  runtimeModelIds!: string[];

  @Prop({
    required: true,
    enum: ['huggingface', 'http-zip'],
  })
  sourceKind!: ModelInstallationSourceKind;

  @Prop({
    required: true,
    trim: true,
  })
  sourceRef!: string;

  @Prop({
    type: String,
    default: null,
  })
  sourceRevision!: string | null;

  @Prop({
    required: true,
    trim: true,
  })
  localPath!: string;

  @Prop({
    required: true,
    enum: [
      'missing',
      'verified',
      'degraded',
      'corrupt',
      'unavailable',
      'failed',
    ],
  })
  status!: ModelInstallationStatus;

  @Prop({
    type: Number,
    min: 0,
    default: 0,
  })
  fileCount!: number;

  @Prop({
    type: Number,
    min: 0,
    default: 0,
  })
  bytes!: number;

  @Prop({
    required: true,
    trim: true,
  })
  verificationStrategy!: string;

  @Prop({
    type: Date,
    default: null,
  })
  verifiedAt!: Date | null;

  @Prop({
    type: Date,
    default: null,
  })
  installedAt!: Date | null;

  @Prop({
    type: Date,
    default: null,
  })
  lastUsedAt!: Date | null;

  @Prop({
    required: true,
    default: false,
  })
  licenseAcceptanceRequired!: boolean;

  @Prop({
    required: true,
    default: false,
  })
  gated!: boolean;

  @Prop({
    type: String,
    default: null,
  })
  lastError!: string | null;

  @Prop()
  createdAt!: Date;

  @Prop()
  updatedAt!: Date;
}

export const ModelInstallationSchema =
  SchemaFactory.createForClass(ModelInstallation);

ModelInstallationSchema.index(
  { artifactId: 1 },
  { unique: true }
);
ModelInstallationSchema.index({
  providerId: 1,
  status: 1,
});
ModelInstallationSchema.index({
  status: 1,
  verifiedAt: -1,
});
ModelInstallationSchema.index({
  modelIds: 1,
});
