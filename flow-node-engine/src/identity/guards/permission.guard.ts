import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { UserService } from '../services/user.service';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private userService: UserService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 获取装饰器中定义的所需权限
    const requiredPermissions = this.reflector.get<string[]>(
      'permissions',
      context.getHandler(),
    );

    // 如果没有定义所需权限，则允许访问
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    // 获取请求中的用户信息
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // 如果用户不存在，则拒绝访问
    if (!user?.id) {
      throw new ForbiddenException('用户未登录');
    }

    // 查询用户的角色和组
    const userRoles = await this.userService.getUserRoles(user.id);
    const userGroups = await this.userService.getUserGroups(user.id);

    // 检查用户是否有所需权限
    const hasPermission = this.checkPermissions(
      userRoles,
      userGroups,
      requiredPermissions,
    );

    if (!hasPermission) {
      throw new ForbiddenException('权限不足');
    }

    return true;
  }

  /**
   * 检查用户是否有所需权限
   * @param userRoles 用户角色列表
   * @param userGroups 用户组列表
   * @param requiredPermissions 所需权限列表
   * @returns 是否有权限
   */
  private checkPermissions(
    userRoles: any[],
    userGroups: any[],
    requiredPermissions: string[],
  ): boolean {
    // 将用户的角色和组转换为权限列表
    const userPermissions = this.extractPermissions(userRoles, userGroups);

    // 检查是否拥有所有所需权限
    return requiredPermissions.every((permission) =>
      userPermissions.includes(permission),
    );
  }

  /**
   * 从角色和组中提取权限
   * @param userRoles 用户角色列表
   * @param userGroups 用户组列表
   * @returns 权限列表
   */
  private extractPermissions(
    userRoles: any[],
    userGroups: any[],
  ): string[] {
    const permissions: string[] = [];

    // 从角色中提取权限
    for (const role of userRoles) {
      if (role.permissions && Array.isArray(role.permissions)) {
        permissions.push(...role.permissions);
      }
    }

    // 从组中提取权限
    for (const group of userGroups) {
      if (group.permissions && Array.isArray(group.permissions)) {
        permissions.push(...group.permissions);
      }
    }

    // 去重
    return [...new Set(permissions)];
  }
}
