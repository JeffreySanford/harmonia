import {
  Prop,
  Schema as MongoSchema,
  SchemaFactory,
} from '@nestjs/mongoose';
import {
  Schema as MongooseSchema,
  Types,
} from 'mongoose';

export type RefreshSessionRevokeReason =
  | 'rotated'
  | 'logout'
  | 'reuse-detected'
  | 'rotation-write-failed';

@MongoSchema({
  timestamps: true,
  collection: 'refresh_sessions',
})
export class RefreshSession {
  @Prop({
    type:
      MongooseSchema.Types.ObjectId,
    required:
      true,
    index:
      true,
  })
  userId!: Types.ObjectId;

  @Prop({
    required:
      true,
    unique:
      true,
    index:
      true,
  })
  sessionId!: string;

  @Prop({
    required:
      true,
    index:
      true,
  })
  familyId!: string;

  @Prop({
    required:
      true,
  })
  tokenHash!: string;

  @Prop({
    required:
      true,
    index:
      true,
  })
  expiresAt!: Date;

  @Prop()
  revokedAt?: Date;

  @Prop()
  replacedBySessionId?: string;

  @Prop({
    enum: [
      'rotated',
      'logout',
      'reuse-detected',
      'rotation-write-failed',
    ],
  })
  revokeReason?:
    RefreshSessionRevokeReason;
}

export const RefreshSessionSchema =
  SchemaFactory.createForClass(
    RefreshSession
  );

RefreshSessionSchema.index(
  {
    expiresAt:
      1,
  },
  {
    expireAfterSeconds:
      0,
  }
);

RefreshSessionSchema.index({
  familyId:
    1,
  revokedAt:
    1,
});
