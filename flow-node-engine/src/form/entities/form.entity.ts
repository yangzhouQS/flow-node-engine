import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('forms')
export class Form {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'form_key' })
  formKey: string;

  @Column({ name: 'name' })
  name: string;

  @Column({ name: 'description', nullable: true })
  description: string;

  @Column({ name: 'version', default: 1 })
  version: number;

  @Column({ name: 'form_definition', type: 'json' })
  formDefinition: Record<string, any>;

  @Column({ name: 'deployment_id', nullable: true })
  deploymentId: string;

  @Column({ name: 'tenant_id', nullable: true })
  tenantId: string;

  @Column({ name: 'resource_name', nullable: true })
  resourceName: string;

  @Column({ name: 'is_system', default: false })
  isSystem: boolean;

  @Column({ name: 'create_time', type: 'timestamp' })
  createTime: Date;

  @UpdateDateColumn({ name: 'update_time' })
  updateTime: Date;
}
