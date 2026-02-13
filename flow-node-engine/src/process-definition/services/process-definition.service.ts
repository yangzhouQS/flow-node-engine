import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { BusinessException } from '../../common/exceptions/business.exception';
import { BpmnParserService } from '../../core/services/bpmn-parser.service';
import { DeployProcessDto } from '../dto/deploy-process.dto';
import { Deployment } from '../entities/deployment.entity';
import { ProcessDefinition } from '../entities/process-definition.entity';

/**
 * 流程定义服务
 */
@Injectable()
export class ProcessDefinitionService {
  private readonly logger = new Logger(ProcessDefinitionService.name);

  constructor(
    @InjectRepository(ProcessDefinition)
    private readonly processDefinitionRepository: Repository<ProcessDefinition>,
    @InjectRepository(Deployment)
    private readonly deploymentRepository: Repository<Deployment>,
    private readonly bpmnParser: BpmnParserService,
  ) {}

  /**
   * 部署流程定义
   * @param dto 部署 DTO
   * @returns 流程定义
   */
  async deploy(dto: DeployProcessDto): Promise<ProcessDefinition> {
    this.logger.log(`Deploying process definition: ${dto.key}`);

    // 解析 BPMN XML
    const parseResult = await this.bpmnParser.parse(dto.bpmnXml);
    if (!parseResult.isValid) {
      throw new BusinessException(
        `BPMN XML 验证失败: ${parseResult.errors.join(', ')}`,
        400,
      );
    }

    // 检查是否有警告
    if (parseResult.warnings.length > 0) {
      this.logger.warn(
        `BPMN XML 验证警告: ${parseResult.warnings.join(', ')}`,
      );
    }

    // 查询最新版本
    const latestDefinition = await this.processDefinitionRepository.findOne({
      where: { key: dto.key },
      order: { version: 'DESC' },
    });

    const nextVersion = latestDefinition ? latestDefinition.version + 1 : 1;

    // 创建部署记录
    const deployment = this.deploymentRepository.create({
      name: dto.name,
      category: dto.category,
      deployTime: new Date(),
      isLatestVersion: true,
    });

    // 将之前的部署标记为非最新版本
    if (latestDefinition) {
      await this.deploymentRepository.update(
        { id: latestDefinition.deploymentId },
        { isLatestVersion: false },
      );
    }

    const savedDeployment = await this.deploymentRepository.save(deployment);

    // 生成流程图
    let diagramSvg: string | undefined;
    if (dto.generateDiagram) {
      try {
        diagramSvg = await this.bpmnParser.generateDiagram(dto.bpmnXml);
      } catch (error) {
        this.logger.error('Failed to generate diagram', error.stack);
      }
    }

    // 创建流程定义
    const processDefinition = this.processDefinitionRepository.create({
      key: dto.key,
      version: nextVersion,
      name: dto.name,
      category: dto.category,
      description: dto.description,
      deploymentId: savedDeployment.id,
      resourceName: `${dto.key}.bpmn20.xml`,
      bpmnXml: dto.bpmnXml,
      diagramSvg,
      isSuspended: false,
    });

    return this.processDefinitionRepository.save(processDefinition);
  }

  /**
   * 查询流程定义列表
   * @param key 流程键（可选）
   * @param category 流程分类（可选）
   * @returns 流程定义列表
   */
  async findAll(key?: string, category?: string): Promise<ProcessDefinition[]> {
    const queryBuilder = this.processDefinitionRepository
      .createQueryBuilder('pd')
      .leftJoinAndSelect('pd.deployment', 'deployment');

    if (key) {
      queryBuilder.andWhere('pd.key = :key', { key });
    }

    if (category) {
      queryBuilder.andWhere('pd.category = :category', { category });
    }

    return queryBuilder.orderBy('pd.version', 'DESC').getMany();
  }

  /**
   * 查询流程定义详情
   * @param id 流程定义 ID
   * @returns 流程定义
   */
  async findById(id: string): Promise<ProcessDefinition | null> {
    return this.processDefinitionRepository.findOne({
      where: { id },
      relations: ['deployment'],
    });
  }

  /**
   * 根据流程键查询最新版本
   * @param key 流程键
   * @returns 流程定义
   */
  async findByKey(key: string): Promise<ProcessDefinition | null> {
    return this.processDefinitionRepository.findOne({
      where: { key },
      order: { version: 'DESC' },
      relations: ['deployment'],
    });
  }

  /**
   * 根据流程键和版本查询
   * @param key 流程键
   * @param version 版本号
   * @returns 流程定义
   */
  async findByKeyAndVersion(
    key: string,
    version: number,
  ): Promise<ProcessDefinition | null> {
    return this.processDefinitionRepository.findOne({
      where: { key, version },
      relations: ['deployment'],
    });
  }

  /**
   * 激活流程定义
   * @param id 流程定义 ID
   */
  async activate(id: string): Promise<void> {
    const processDefinition = await this.findById(id);
    if (!processDefinition) {
      throw new BusinessException('流程定义不存在', 404);
    }

    processDefinition.isSuspended = false;
    await this.processDefinitionRepository.save(processDefinition);

    this.logger.log(`Activated process definition: ${id}`);
  }

  /**
   * 挂起流程定义
   * @param id 流程定义 ID
   */
  async suspend(id: string): Promise<void> {
    const processDefinition = await this.findById(id);
    if (!processDefinition) {
      throw new BusinessException('流程定义不存在', 404);
    }

    processDefinition.isSuspended = true;
    await this.processDefinitionRepository.save(processDefinition);

    this.logger.log(`Suspended process definition: ${id}`);
  }

  /**
   * 删除流程定义
   * @param id 流程定义 ID
   */
  async delete(id: string): Promise<void> {
    const processDefinition = await this.findById(id);
    if (!processDefinition) {
      throw new BusinessException('流程定义不存在', 404);
    }

    await this.processDefinitionRepository.delete(id);
    await this.deploymentRepository.delete(processDefinition.deploymentId);

    this.logger.log(`Deleted process definition: ${id}`);
  }

  /**
   * 获取流程图
   * @param id 流程定义 ID
   * @returns 流程图 SVG
   */
  async getDiagram(id: string): Promise<string | null> {
    const processDefinition = await this.findById(id);
    if (!processDefinition) {
      throw new BusinessException('流程定义不存在', 404);
    }

    return processDefinition.diagramSvg || null;
  }

  /**
   * 获取 BPMN XML
   * @param id 流程定义 ID
   * @returns BPMN XML
   */
  async getBpmnXml(id: string): Promise<string> {
    const processDefinition = await this.findById(id);
    if (!processDefinition) {
      throw new BusinessException('流程定义不存在', 404);
    }

    return processDefinition.bpmnXml;
  }
}
