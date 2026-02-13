import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { BatchController } from './controllers/batch.controller';
import { BatchPartEntity } from './entities/batch-part.entity';
import { BatchEntity } from './entities/batch.entity';
import { BatchService } from './services/batch.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([BatchEntity, BatchPartEntity]),
  ],
  controllers: [BatchController],
  providers: [BatchService],
  exports: [BatchService],
})
export class BatchModule {}
