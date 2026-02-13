import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { IdentityLinkController } from './controllers/identity-link.controller';
import { HistoricIdentityLinkEntity } from './entities/historic-identity-link.entity';
import { IdentityLinkEntity } from './entities/identity-link.entity';
import { IdentityLinkService } from './services/identity-link.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      IdentityLinkEntity,
      HistoricIdentityLinkEntity,
    ]),
  ],
  controllers: [IdentityLinkController],
  providers: [IdentityLinkService],
  exports: [IdentityLinkService],
})
export class IdentityLinkModule {}
