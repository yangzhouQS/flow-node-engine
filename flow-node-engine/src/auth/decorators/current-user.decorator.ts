import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * 当前用户接口
 */
export interface CurrentUserData {
  id: string;
  username: string;
  email?: string;
  roles?: string[];
  groups?: string[];
  tenantId?: string;
  [key: string]: any;
}

/**
 * 从请求中提取当前用户的装饰器
 * 
 * @example
 * @Get('profile')
 * getProfile(@CurrentUser() user: CurrentUserData) {
 *   return user;
 * }
 * 
 * @example
 * @Get('tasks')
 * getTasks(@CurrentUser('id') userId: string) {
 *   return this.taskService.findByUserId(userId);
 * }
 */
export const CurrentUser = createParamDecorator(
  (data: keyof CurrentUserData | undefined, ctx: ExecutionContext): CurrentUserData | any => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as CurrentUserData | undefined;

    if (!user) {
      return null;
    }

    // 如果指定了属性名，返回该属性
    if (data) {
      return user[data];
    }

    // 否则返回整个用户对象
    return user;
  },
);

/**
 * 获取当前用户ID的快捷装饰器
 */
export const CurrentUserId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string | null => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as CurrentUserData | undefined;
    return user?.id || null;
  },
);

/**
 * 获取当前用户名的快捷装饰器
 */
export const CurrentUsername = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string | null => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as CurrentUserData | undefined;
    return user?.username || null;
  },
);
