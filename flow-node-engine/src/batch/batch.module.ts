import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BatchEntity } from './entities/batch.entity';
import { BatchPartEntity } from './entities/batch-part.entity';
import { BatchService } from './services/batch.service';
import { BatchController } from './controllers/batch.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([BatchEntity, BatchPartEntity]),
  ],
  controllers: [BatchController],
  providers: [BatchService],
  exports: [BatchService],
})
export class BatchModule {}
