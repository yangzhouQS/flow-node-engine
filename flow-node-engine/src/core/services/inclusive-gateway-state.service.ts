import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

import { InclusiveGatewayStateEntity } from '../entities/inclusive-gateway-state.entity';

/**
 * 包容网关状态服务
 * 管理包容网关的分叉和汇聚状态
 */
@Injectable()
export class InclusiveGatewayStateService {
  private readonly logger = new Logger(InclusiveGatewayStateService.name);

  constructor(
    @InjectRepository(InclusiveGatewayStateEntity)
    private readonly stateRepository: Repository<InclusiveGatewayStateEntity>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * 创建分叉网关状态
   * @param processInstanceId 流程实例ID
   * @param gatewayId 网关ID
   * @param branchTargets 分支目标ID列表
   * @param executionId 执行ID
   * @param processDefinitionId 流程定义ID
   * @param tenantId 租户ID
   * @returns 创建的状态实体
   */
  async createForkState(
    processInstanceId: string,
    gatewayId: string,
    branchTargets: string[],
    executionId?: string,
    processDefinitionId?: string,
    tenantId?: string,
  ): Promise<InclusiveGatewayStateEntity> {
    const state = this.stateRepository.create({
      id_: uuidv4(),
      proc_inst_id_: processInstanceId,
      execution_id_: executionId,
      gateway_id_: gatewayId,
      gateway_type_: 'fork',
      active_branches_: branchTargets.length,
      completed_branches_: 0,
      branch_targets_: JSON.stringify(branchTargets),
      is_active_: true,
      proc_def_id_: processDefinitionId,
      tenant_id_: tenantId,
      create_time_: new Date(),
      update_time_: new Date(),
    });

    const savedState = await this.stateRepository.save(state);
    this.logger.debug(
      `Created fork state for gateway ${gatewayId} with ${branchTargets.length} branches`,
    );

    return savedState;
  }

  /**
   * 创建汇聚网关状态
   * @param processInstanceId 流程实例ID
   * @param gatewayId 网关ID
   * @param activeBranches 需要等待的分支数量
   * @param executionId 执行ID
   * @param processDefinitionId 流程定义ID
   * @param tenantId 租户ID
   * @returns 创建的状态实体
   */
  async createJoinState(
    processInstanceId: string,
    gatewayId: string,
    activeBranches: number,
    executionId?: string,
    processDefinitionId?: string,
    tenantId?: string,
  ): Promise<InclusiveGatewayStateEntity> {
    const state = this.stateRepository.create({
      id_: uuidv4(),
      proc_inst_id_: processInstanceId,
      execution_id_: executionId,
      gateway_id_: gatewayId,
      gateway_type_: 'join',
      active_branches_: activeBranches,
      completed_branches_: 0,
      branch_targets_: null,
      is_active_: true,
      proc_def_id_: processDefinitionId,
      tenant_id_: tenantId,
      create_time_: new Date(),
      update_time_: new Date(),
    });

    const savedState = await this.stateRepository.save(state);
    this.logger.debug(
      `Created join state for gateway ${gatewayId} waiting for ${activeBranches} branches`,
    );

    return savedState;
  }

  /**
   * 获取网关状态
   * @param processInstanceId 流程实例ID
   * @param gatewayId 网关ID
   * @returns 状态实体
   */
  async getState(
    processInstanceId: string,
    gatewayId: string,
  ): Promise<InclusiveGatewayStateEntity | null> {
    return this.stateRepository.findOne({
      where: {
        proc_inst_id_: processInstanceId,
        gateway_id_: gatewayId,
        is_active_: true,
      },
    });
  }

  /**
   * 获取汇聚网关状态
   * @param processInstanceId 流程实例ID
   * @param gatewayId 网关ID
   * @returns 汇聚状态实体
   */
  async getJoinState(
    processInstanceId: string,
    gatewayId: string,
  ): Promise<InclusiveGatewayStateEntity | null> {
    return this.stateRepository.findOne({
      where: {
        proc_inst_id_: processInstanceId,
        gateway_id_: gatewayId,
        gateway_type_: 'join',
        is_active_: true,
      },
    });
  }

  /**
   * 增加已完成分支数
   * 用于汇聚网关，当一个分支到达汇聚点时调用
   * @param processInstanceId 流程实例ID
   * @param gatewayId 网关ID
   * @returns 更新后的状态，如果所有分支都已完成则返回true
   */
  async incrementCompletedBranches(
    processInstanceId: string,
    gatewayId: string,
  ): Promise<{ state: InclusiveGatewayStateEntity; allCompleted: boolean }> {
    const state = await this.getJoinState(processInstanceId, gatewayId);

    if (!state) {
      throw new Error(
        `No active join state found for gateway ${gatewayId} in process ${processInstanceId}`,
      );
    }

    state.completed_branches_ += 1;
    state.update_time_ = new Date();

    const updatedState = await this.stateRepository.save(state);

    const allCompleted = updatedState.completed_branches_ >= updatedState.active_branches_;

    this.logger.debug(
      `Join gateway ${gatewayId}: ${updatedState.completed_branches_}/${updatedState.active_branches_} branches completed`,
    );

    return { state: updatedState, allCompleted };
  }

  /**
   * 检查汇聚是否完成
   * @param processInstanceId 流程实例ID
   * @param gatewayId 网关ID
   * @returns 是否所有分支都已完成
   */
  async isJoinComplete(processInstanceId: string, gatewayId: string): Promise<boolean> {
    const state = await this.getJoinState(processInstanceId, gatewayId);

    if (!state) {
      return false;
    }

    return state.completed_branches_ >= state.active_branches_;
  }

  /**
   * 获取分支目标列表
   * @param state 网关状态
   * @returns 分支目标ID数组
   */
  getBranchTargets(state: InclusiveGatewayStateEntity): string[] {
    if (!state.branch_targets_) {
      return [];
    }
    try {
      return JSON.parse(state.branch_targets_);
    } catch {
      return [];
    }
  }

  /**
   * 完成网关状态（标记为非激活）
   * @param processInstanceId 流程实例ID
   * @param gatewayId 网关ID
   */
  async completeState(processInstanceId: string, gatewayId: string): Promise<void> {
    await this.stateRepository.update(
      {
        proc_inst_id_: processInstanceId,
        gateway_id_: gatewayId,
        is_active_: true,
      },
      {
        is_active_: false,
        update_time_: new Date(),
      },
    );

    this.logger.debug(`Completed gateway state for ${gatewayId}`);
  }

  /**
   * 删除流程实例的所有网关状态
   * @param processInstanceId 流程实例ID
   */
  async deleteByProcessInstance(processInstanceId: string): Promise<void> {
    await this.stateRepository.delete({
      proc_inst_id_: processInstanceId,
    });

    this.logger.debug(
      `Deleted all gateway states for process instance ${processInstanceId}`,
    );
  }

  /**
   * 获取流程实例的所有激活网关状态
   * @param processInstanceId 流程实例ID
   * @returns 激活的网关状态列表
   */
  async getActiveStates(
    processInstanceId: string,
  ): Promise<InclusiveGatewayStateEntity[]> {
    return this.stateRepository.find({
      where: {
        proc_inst_id_: processInstanceId,
        is_active_: true,
      },
    });
  }

  /**
   * 根据执行ID获取网关状态
   * @param executionId 执行ID
   * @returns 网关状态
   */
  async getStateByExecution(
    executionId: string,
  ): Promise<InclusiveGatewayStateEntity | null> {
    return this.stateRepository.findOne({
      where: {
        execution_id_: executionId,
        is_active_: true,
      },
    });
  }

  /**
   * 更新网关状态的执行ID
   * @param stateId 状态ID
   * @param executionId 新的执行ID
   */
  async updateExecutionId(stateId: string, executionId: string): Promise<void> {
    await this.stateRepository.update(
      { id_: stateId },
      {
        execution_id_: executionId,
        update_time_: new Date(),
      },
    );
  }
}
