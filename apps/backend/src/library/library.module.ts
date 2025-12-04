import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LibraryController } from './library.controller';
import { LibraryService } from './library.service';
import { LibraryItem, LibraryItemSchema } from '../schemas/library-item.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: LibraryItem.name, schema: LibraryItemSchema },
    ]),
  ],
  controllers: [LibraryController],
  providers: [LibraryService],
  exports: [LibraryService],
})
export class LibraryModule {}
