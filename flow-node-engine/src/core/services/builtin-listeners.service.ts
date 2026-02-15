import { Injectable, Logger } from '@nestjs/common';
import {
  IExecutionListener,
  ITaskListener,
  ListenerContext,
  TaskListenerContext,
  ListenerResult,
  ExecutionListenerConfig,
  TaskListenerConfig,
  ListenerImplementationType,
  BuiltinListenerType,
  LogListenerConfig,
  VariableSetListenerConfig,
  ScriptListenerConfig,
} from '../interfaces/listener.interface';
import { IListenerFactory } from './listener-registry.service';

/**
 * 日志执行监听器
 */
@Injectable()
export class LogExecutionListener implements IExecutionListener {
  private readonly logger = new Logger(LogExecutionListener.name);
  private readonly config: LogListenerConfig;

  constructor(config: LogListenerConfig) {
    this.config = config;
  }

  notify(context: ListenerContext): ListenerResult {
    try {
      const logLevel = this.config.logLevel || 'info';
      const logVariables = this.config.logVariables ?? true;
      
      const logData: Record<string, any> = {
        event: context.event,
        processInstanceId: context.processInstanceId,
        executionId: context.executionId,
        activityId: context.activityId,
        activityName: context.activityName,
        timestamp: context.timestamp.toISOString(),
      };

      if (logVariables && context.variables) {
        logData.variables = context.variables;
      }

      const message = this.config.logFormat
        ? this.formatMessage(this.config.logFormat, context)
        : `Execution Listener: ${JSON.stringify(logData)}`;

      switch (logLevel) {
        case 'debug':
          this.logger.debug(message);
          break;
        case 'warn':
          this.logger.warn(message);
          break;
        case 'error':
          this.logger.error(message);
          break;
        default:
          this.logger.log(message);
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private formatMessage(format: string, context: ListenerContext): string {
    return format
      .replace('${event}', context.event)
      .replace('${processInstanceId}', context.processInstanceId)
      .replace('${executionId}', context.executionId || '')
      .replace('${activityId}', context.activityId || '')
      .replace('${activityName}', context.activityName || '')
      .replace('${timestamp}', context.timestamp.toISOString());
  }
}

/**
 * 日志任务监听器
 */
@Injectable()
export class LogTaskListener implements ITaskListener {
  private readonly logger = new Logger(LogTaskListener.name);
  private readonly config: LogListenerConfig;

  constructor(config: LogListenerConfig) {
    this.config = config;
  }

  notify(context: TaskListenerContext): ListenerResult {
    try {
      const logLevel = this.config.logLevel || 'info';
      
      const logData: Record<string, any> = {
        event: context.event,
        processInstanceId: context.processInstanceId,
        taskId: context.taskId,
        taskName: context.taskName,
        assignee: context.assignee,
        timestamp: context.timestamp.toISOString(),
      };

      const message = this.config.logFormat
        ? this.formatMessage(this.config.logFormat, context)
        : `Task Listener: ${JSON.stringify(logData)}`;

      switch (logLevel) {
        case 'debug':
          this.logger.debug(message);
          break;
        case 'warn':
          this.logger.warn(message);
          break;
        case 'error':
          this.logger.error(message);
          break;
        default:
          this.logger.log(message);
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private formatMessage(format: string, context: TaskListenerContext): string {
    return format
      .replace('${event}', context.event)
      .replace('${processInstanceId}', context.processInstanceId)
      .replace('${taskId}', context.taskId)
      .replace('${taskName}', context.taskName || '')
      .replace('${assignee}', context.assignee || '')
      .replace('${timestamp}', context.timestamp.toISOString());
  }
}

/**
 * 变量设置执行监听器
 */
@Injectable()
export class VariableSetExecutionListener implements IExecutionListener {
  private readonly config: VariableSetListenerConfig;

  constructor(config: VariableSetListenerConfig) {
    this.config = config;
  }

  notify(context: ListenerContext): ListenerResult {
    try {
      const variableName = this.config.variableName;
      let variableValue = this.config.variableValue;

      // 如果值是表达式，尝试解析
      if (typeof variableValue === 'string' && variableValue.startsWith('${') && variableValue.endsWith('}')) {
        const expression = variableValue.slice(2, -1);
        variableValue = this.evaluateExpression(expression, context.variables);
      }

      // 检查是否覆盖
      if (!this.config.overwrite && context.variables.hasOwnProperty(variableName)) {
        return { success: true }; // 不覆盖，静默返回成功
      }

      return {
        success: true,
        modifiedVariables: {
          [variableName]: variableValue,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private evaluateExpression(expression: string, variables: Record<string, any>): any {
    try {
      const func = new Function(...Object.keys(variables), `return ${expression}`);
      return func(...Object.values(variables));
    } catch {
      return expression;
    }
  }
}

/**
 * 变量设置任务监听器
 */
@Injectable()
export class VariableSetTaskListener implements ITaskListener {
  private readonly config: VariableSetListenerConfig;

  constructor(config: VariableSetListenerConfig) {
    this.config = config;
  }

  notify(context: TaskListenerContext): ListenerResult {
    try {
      const variableName = this.config.variableName;
      let variableValue = this.config.variableValue;

      if (typeof variableValue === 'string' && variableValue.startsWith('${') && variableValue.endsWith('}')) {
        const expression = variableValue.slice(2, -1);
        variableValue = this.evaluateExpression(expression, context.variables);
      }

      if (!this.config.overwrite && context.variables.hasOwnProperty(variableName)) {
        return { success: true };
      }

      return {
        success: true,
        modifiedVariables: {
          [variableName]: variableValue,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private evaluateExpression(expression: string, variables: Record<string, any>): any {
    try {
      const func = new Function(...Object.keys(variables), `return ${expression}`);
      return func(...Object.values(variables));
    } catch {
      return expression;
    }
  }
}

/**
 * 脚本执行监听器
 */
@Injectable()
export class ScriptExecutionListener implements IExecutionListener {
  private readonly logger = new Logger(ScriptExecutionListener.name);
  private readonly config: ScriptListenerConfig;

  constructor(config: ScriptListenerConfig) {
    this.config = config;
  }

  async notify(context: ListenerContext): Promise<ListenerResult> {
    try {
      const { script, scriptLanguage } = this.config;

      if (scriptLanguage === 'javascript') {
        const result = await this.executeJavaScript(script, context);
        return result;
      }

      return {
        success: false,
        error: `Unsupported script language: ${scriptLanguage}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async executeJavaScript(script: string, context: ListenerContext): Promise<ListenerResult> {
    try {
      const modifiedVariables: Record<string, any> = {};
      
      const sandbox = {
        ...context.variables,
        execution: {
          id: context.executionId,
          processInstanceId: context.processInstanceId,
          activityId: context.activityId,
          activityName: context.activityName,
          event: context.event,
          setVariable: (name: string, value: any) => {
            modifiedVariables[name] = value;
          },
          getVariable: (name: string) => context.variables[name],
        },
        console: {
          log: (...args: any[]) => this.logger.log(args.join(' ')),
          error: (...args: any[]) => this.logger.error(args.join(' ')),
          warn: (...args: any[]) => this.logger.warn(args.join(' ')),
        },
      };

      const func = new Function(...Object.keys(sandbox), script);
      await func(...Object.values(sandbox));

      return {
        success: true,
        modifiedVariables,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

/**
 * 脚本任务监听器
 */
@Injectable()
export class ScriptTaskListener implements ITaskListener {
  private readonly logger = new Logger(ScriptTaskListener.name);
  private readonly config: ScriptListenerConfig;

  constructor(config: ScriptListenerConfig) {
    this.config = config;
  }

  async notify(context: TaskListenerContext): Promise<ListenerResult> {
    try {
      const { script, scriptLanguage } = this.config;

      if (scriptLanguage === 'javascript') {
        const result = await this.executeJavaScript(script, context);
        return result;
      }

      return {
        success: false,
        error: `Unsupported script language: ${scriptLanguage}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async executeJavaScript(script: string, context: TaskListenerContext): Promise<ListenerResult> {
    try {
      const modifiedVariables: Record<string, any> = {};
      
      const sandbox = {
        ...context.variables,
        task: {
          id: context.taskId,
          name: context.taskName,
          assignee: context.assignee,
          processInstanceId: context.processInstanceId,
          event: context.event,
          setVariable: (name: string, value: any) => {
            modifiedVariables[name] = value;
          },
          getVariable: (name: string) => context.variables[name],
        },
        console: {
          log: (...args: any[]) => this.logger.log(args.join(' ')),
          error: (...args: any[]) => this.logger.error(args.join(' ')),
          warn: (...args: any[]) => this.logger.warn(args.join(' ')),
        },
      };

      const func = new Function(...Object.keys(sandbox), script);
      await func(...Object.values(sandbox));

      return {
        success: true,
        modifiedVariables,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

/**
 * 审计日志执行监听器
 */
@Injectable()
export class AuditLogExecutionListener implements IExecutionListener {
  private readonly logger = new Logger(AuditLogExecutionListener.name);
  private readonly config: ExecutionListenerConfig & {
    logVariableChanges?: boolean;
    logProcessStateChanges?: boolean;
    excludedVariables?: string[];
  };

  constructor(config: ExecutionListenerConfig) {
    this.config = config;
  }

  notify(context: ListenerContext): ListenerResult {
    try {
      const auditEntry = {
        timestamp: new Date().toISOString(),
        eventType: 'EXECUTION_LISTENER',
        event: context.event,
        processInstanceId: context.processInstanceId,
        executionId: context.executionId,
        activityId: context.activityId,
        activityName: context.activityName,
        processDefinitionId: context.processDefinitionId,
        processDefinitionKey: context.processDefinitionKey,
        variables: this.config.logVariableChanges 
          ? this.filterVariables(context.variables) 
          : undefined,
      };

      this.logger.log(JSON.stringify(auditEntry));

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private filterVariables(variables: Record<string, any>): Record<string, any> {
    if (!this.config.excludedVariables?.length) {
      return variables;
    }

    const filtered: Record<string, any> = {};
    for (const [key, value] of Object.entries(variables)) {
      if (!this.config.excludedVariables.includes(key)) {
        filtered[key] = value;
      }
    }
    return filtered;
  }
}

/**
 * 审计日志任务监听器
 */
@Injectable()
export class AuditLogTaskListener implements ITaskListener {
  private readonly logger = new Logger(AuditLogTaskListener.name);
  private readonly config: TaskListenerConfig & {
    logVariableChanges?: boolean;
    logTaskChanges?: boolean;
    excludedVariables?: string[];
  };

  constructor(config: TaskListenerConfig) {
    this.config = config;
  }

  notify(context: TaskListenerContext): ListenerResult {
    try {
      const auditEntry = {
        timestamp: new Date().toISOString(),
        eventType: 'TASK_LISTENER',
        event: context.event,
        processInstanceId: context.processInstanceId,
        taskId: context.taskId,
        taskName: context.taskName,
        assignee: context.assignee,
        candidates: context.candidates,
        candidateGroups: context.candidateGroups,
        variables: this.config.logVariableChanges 
          ? this.filterVariables(context.variables) 
          : undefined,
      };

      this.logger.log(JSON.stringify(auditEntry));

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private filterVariables(variables: Record<string, any>): Record<string, any> {
    if (!this.config.excludedVariables?.length) {
      return variables;
    }

    const filtered: Record<string, any> = {};
    for (const [key, value] of Object.entries(variables)) {
      if (!this.config.excludedVariables.includes(key)) {
        filtered[key] = value;
      }
    }
    return filtered;
  }
}

/**
 * 内置监听器工厂
 */
@Injectable()
export class BuiltinListenerFactory implements IListenerFactory {
  private readonly logger = new Logger(BuiltinListenerFactory.name);

  supports(implementationType: ListenerImplementationType, implementation: string): boolean {
    return implementationType === ListenerImplementationType.BUILTIN && 
           Object.values(BuiltinListenerType).includes(implementation as BuiltinListenerType);
  }

  createExecutionListener(config: ExecutionListenerConfig): IExecutionListener | null {
    const type = config.implementation as BuiltinListenerType;

    switch (type) {
      case BuiltinListenerType.LOG:
        return new LogExecutionListener(config as LogListenerConfig);
      
      case BuiltinListenerType.VARIABLE_SET:
        return new VariableSetExecutionListener(config as VariableSetListenerConfig);
      
      case BuiltinListenerType.SCRIPT:
        return new ScriptExecutionListener(config as ScriptListenerConfig);
      
      case BuiltinListenerType.AUDIT_LOG:
        return new AuditLogExecutionListener(config);
      
      default:
        this.logger.warn(`Unknown builtin execution listener type: ${type}`);
        return null;
    }
  }

  createTaskListener(config: TaskListenerConfig): ITaskListener | null {
    const type = config.implementation as BuiltinListenerType;

    switch (type) {
      case BuiltinListenerType.LOG:
        return new LogTaskListener(config as unknown as LogListenerConfig);
      
      case BuiltinListenerType.VARIABLE_SET:
        return new VariableSetTaskListener(config as unknown as VariableSetListenerConfig);
      
      case BuiltinListenerType.SCRIPT:
        return new ScriptTaskListener(config as unknown as ScriptListenerConfig);
      
      case BuiltinListenerType.AUDIT_LOG:
        return new AuditLogTaskListener(config);
      
      default:
        this.logger.warn(`Unknown builtin task listener type: ${type}`);
        return null;
    }
  }
}
