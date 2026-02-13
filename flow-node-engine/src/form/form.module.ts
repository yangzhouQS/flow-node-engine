import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { FormController } from './controllers/form.controller';
import { Form } from './entities/form.entity';
import { FormService } from './services/form.service';
import { FormValidationService } from './services/form-validation.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Form]),
  ],
  controllers: [FormController],
  providers: [FormService, FormValidationService],
  exports: [FormService, FormValidationService],
})
export class FormModule {}
