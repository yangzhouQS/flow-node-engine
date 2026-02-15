/**
 * 流程图生成模块
 */

import { Module, Global } from '@nestjs/common';
import { ProcessDiagramGeneratorService } from './services/process-diagram-generator.service';

@Global()
@Module({
  providers: [ProcessDiagramGeneratorService],
  exports: [ProcessDiagramGeneratorService],
})
export class DiagramModule {}
