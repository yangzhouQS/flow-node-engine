import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  VersionColumn,
} from 'typeorm';

/**
 * DMN决策状态枚举
 */
export enum DmnDecisionStatus {
  /** 草稿 */
  DRAFT = 'draft',
  /** 已发布 */
  PUBLISHED = 'published',
  /** 已挂起 */
  SUSPENDED = 'suspended',
  /** 已归档 */
  ARCHIVED = 'archived',
}

/**
 * Hit Policy枚举（与Flowable HitPolicy对应）
 * DMN 1.1/1.2/1.3标准定义的Hit Policy
 */
export enum HitPolicy {
  /** 唯一命中 - 只允许一条规则匹配 */
  UNIQUE = 'UNIQUE',
  /** 第一命中 - 返回第一条匹配的规则 */
  FIRST = 'FIRST',
  /** 优先命中 - 按优先级返回最高优先级的匹配规则 */
  PRIORITY = 'PRIORITY',
  /** 任意命中 - 允许多条规则匹配，返回任意一条 */
  ANY = 'ANY',
  /** 收集命中 - 收集所有匹配规则的结果 */
  COLLECT = 'COLLECT',
  /** 规则顺序命中 - 按规则顺序返回所有匹配结果 */
  RULE_ORDER = 'RULE ORDER',
  /** 输出顺序命中 - 按输出值顺序返回所有匹配结果 */
  OUTPUT_ORDER = 'OUTPUT ORDER',
  /** 无序命中 - 返回所有匹配结果，无特定顺序 */
  UNORDERED = 'UNORDERED',
}

/**
 * 聚合类型枚举（用于COLLECT hit policy）
 */
export enum AggregationType {
  /** 无聚合 */
  NONE = 'NONE',
  /** 求和 */
  SUM = 'SUM',
  /** 计数 */
  COUNT = 'COUNT',
  /** 最小值 */
  MIN = 'MIN',
  /** 最大值 */
  MAX = 'MAX',
}

/**
 * DMN决策实体
 * 用于存储决策表定义
 */
@Entity('ACT_DMN_DECISION')
@Index('IDX_DMN_DECISION_KEY', ['decisionKey'])
@Index('IDX_DMN_DECISION_KEY_VER', ['decisionKey', 'version'])
@Index('IDX_DMN_DECISION_TENANT', ['tenantId'])
export class DmnDecisionEntity {
  /** 决策ID */
  @PrimaryColumn({ name: 'ID_', type: 'varchar', length: 64 })
  id: string;

  /** 决策Key（唯一标识） */
  @Column({ name: 'KEY_', type: 'varchar', length: 255 })
  decisionKey: string;

  /** 决策名称 */
  @Column({ name: 'NAME_', type: 'varchar', length: 255, nullable: true })
  name: string;

  /** 版本号 */
  @VersionColumn({ name: 'VERSION_' })
  version: number;

  /** 决策状态 */
  @Column({ name: 'STATUS_', type: 'varchar', length: 20, default: DmnDecisionStatus.DRAFT })
  status: DmnDecisionStatus;

  /** 决策表定义（JSON格式） */
  @Column({ name: 'DECISION_TABLE_', type: 'text' })
  decisionTable: string;

  /** Hit Policy */
  @Column({ name: 'HIT_POLICY_', type: 'varchar', length: 20, default: HitPolicy.UNIQUE })
  hitPolicy: HitPolicy;

  /** 聚合类型 */
  @Column({ name: 'AGGREGATION_', type: 'varchar', length: 20, nullable: true })
  aggregation: AggregationType;

  /** 输入定义（JSON格式） */
  @Column({ name: 'INPUTS_', type: 'text', nullable: true })
  inputs: string;

  /** 输出定义（JSON格式） */
  @Column({ name: 'OUTPUTS_', type: 'text', nullable: true })
  outputs: string;

  /** 规则定义（JSON格式） */
  @Column({ name: 'RULES_', type: 'text', nullable: true })
  rules: string;

  /** 部署ID */
  @Column({ name: 'DEPLOYMENT_ID_', type: 'varchar', length: 64, nullable: true })
  deploymentId: string;

  /** 资源名称 */
  @Column({ name: 'RESOURCE_NAME_', type: 'varchar', length: 255, nullable: true })
  resourceName: string;

  /** 描述 */
  @Column({ name: 'DESCRIPTION_', type: 'varchar', length: 500, nullable: true })
  description: string;

  /** 分类 */
  @Column({ name: 'CATEGORY_', type: 'varchar', length: 100, nullable: true })
  category: string;

  /** 决策需求图ID（DRD） */
  @Column({ name: 'DRD_ID_', type: 'varchar', length: 64, nullable: true })
  drdId: string;

  /** 决策服务ID */
  @Column({ name: 'DECISION_SERVICE_ID_', type: 'varchar', length: 64, nullable: true })
  decisionServiceId: string;

  /** 租户ID */
  @Column({ name: 'TENANT_ID_', type: 'varchar', length: 255, nullable: true })
  tenantId: string;

  /** 创建者 */
  @Column({ name: 'CREATE_USER_', type: 'varchar', length: 64, nullable: true })
  createUser: string;

  /** 创建时间 */
  @CreateDateColumn({ name: 'CREATE_TIME_', type: 'datetime' })
  createTime: Date;

  /** 更新时间 */
  @UpdateDateColumn({ name: 'UPDATE_TIME_', type: 'datetime', nullable: true })
  updateTime: Date;

  /** 发布时间 */
  @Column({ name: 'PUBLISH_TIME_', type: 'datetime', nullable: true })
  publishTime: Date;

  /** 规则数量 */
  @Column({ name: 'RULE_COUNT_', type: 'int', default: 0 })
  ruleCount: number;

  /** 扩展属性（JSON格式） */
  @Column({ name: 'EXTRA_', type: 'text', nullable: true })
  extra: string;
}
