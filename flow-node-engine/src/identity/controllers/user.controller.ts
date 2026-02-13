import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { UserService } from '../services/user.service';

@ApiTags('用户管理')
@Controller('api/v1/users')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @ApiOperation({ summary: '创建用户' })
  @ApiResponse({ status: 200, description: '创建成功' })
  async create(@Body() dto: any) {
    const user = await this.userService.create(dto);
    return {
      code: 200,
      message: '创建成功',
      data: user,
      timestamp: Date.now(),
    };
  }

  @Get()
  @ApiOperation({ summary: '查询用户列表' })
  @ApiResponse({ status: 200, description: '查询成功' })
  async findAll(@Query() query: any) {
    const result = await this.userService.findAll(query);
    return {
      code: 200,
      message: '查询成功',
      data: result,
      timestamp: Date.now(),
    };
  }

  @Get(':id')
  @ApiOperation({ summary: '查询用户详情' })
  @ApiResponse({ status: 200, description: '查询成功' })
  async findById(@Param('id') id: string) {
    const user = await this.userService.findById(id);
    return {
      code: 200,
      message: '查询成功',
      data: user,
      timestamp: Date.now(),
    };
  }

  @Get('username/:username')
  @ApiOperation({ summary: '根据用户名查询用户' })
  @ApiResponse({ status: 200, description: '查询成功' })
  async findByUsername(@Param('username') username: string) {
    const user = await this.userService.findByUsername(username);
    return {
      code: 200,
      message: '查询成功',
      data: user,
      timestamp: Date.now(),
    };
  }

  @Put(':id')
  @ApiOperation({ summary: '更新用户' })
  @ApiResponse({ status: 200, description: '更新成功' })
  async update(@Param('id') id: string, @Body() dto: any) {
    const user = await this.userService.update(id, dto);
    return {
      code: 200,
      message: '更新成功',
      data: user,
      timestamp: Date.now(),
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除用户' })
  @ApiResponse({ status: 200, description: '删除成功' })
  async delete(@Param('id') id: string) {
    await this.userService.delete(id);
    return {
      code: 200,
      message: '删除成功',
      data: null,
      timestamp: Date.now(),
    };
  }

  @Delete()
  @ApiOperation({ summary: '批量删除用户' })
  @ApiResponse({ status: 200, description: '删除成功' })
  async deleteMany(@Body() body: { ids: string[] }) {
    await this.userService.deleteMany(body.ids);
    return {
      code: 200,
      message: '删除成功',
      data: null,
      timestamp: Date.now(),
    };
  }

  @Put(':id/activate')
  @ApiOperation({ summary: '激活用户' })
  @ApiResponse({ status: 200, description: '激活成功' })
  async activate(@Param('id') id: string) {
    await this.userService.activate(id);
    return {
      code: 200,
      message: '激活成功',
      data: null,
      timestamp: Date.now(),
    };
  }

  @Put(':id/deactivate')
  @ApiOperation({ summary: '停用用户' })
  @ApiResponse({ status: 200, description: '停用成功' })
  async deactivate(@Param('id') id: string) {
    await this.userService.deactivate(id);
    return {
      code: 200,
      message: '停用成功',
      data: null,
      timestamp: Date.now(),
    };
  }

  @Post(':id/change-password')
  @ApiOperation({ summary: '修改密码' })
  @ApiResponse({ status: 200, description: '修改成功' })
  async changePassword(
    @Param('id') id: string,
    @Body() body: { oldPassword: string; newPassword: string },
  ) {
    await this.userService.changePassword(id, body.oldPassword, body.newPassword);
    return {
      code: 200,
      message: '修改成功',
      data: null,
      timestamp: Date.now(),
    };
  }

  @Post(':id/reset-password')
  @ApiOperation({ summary: '重置密码' })
  @ApiResponse({ status: 200, description: '重置成功' })
  async resetPassword(
    @Param('id') id: string,
    @Body() body: { newPassword: string },
  ) {
    await this.userService.resetPassword(id, body.newPassword);
    return {
      code: 200,
      message: '重置成功',
      data: null,
      timestamp: Date.now(),
    };
  }

  @Get(':id/roles')
  @ApiOperation({ summary: '查询用户的角色' })
  @ApiResponse({ status: 200, description: '查询成功' })
  async getUserRoles(@Param('id') id: string) {
    const roles = await this.userService.getUserRoles(id);
    return {
      code: 200,
      message: '查询成功',
      data: roles,
      timestamp: Date.now(),
    };
  }

  @Get(':id/groups')
  @ApiOperation({ summary: '查询用户的组' })
  @ApiResponse({ status: 200, description: '查询成功' })
  async getUserGroups(@Param('id') id: string) {
    const groups = await this.userService.getUserGroups(id);
    return {
      code: 200,
      message: '查询成功',
      data: groups,
      timestamp: Date.now(),
    };
  }

  @Get(':id/group-ids')
  @ApiOperation({ summary: '查询用户所属的组 ID' })
  @ApiResponse({ status: 200, description: '查询成功' })
  async getUserGroupIds(@Param('id') id: string) {
    const groupIds = await this.userService.getUserGroupIds(id);
    return {
      code: 200,
      message: '查询成功',
      data: groupIds,
      timestamp: Date.now(),
    };
  }

  @Get('count')
  @ApiOperation({ summary: '统计用户数量' })
  @ApiResponse({ status: 200, description: '统计成功' })
  async count(@Query() query: any) {
    const count = await this.userService.count(query);
    return {
      code: 200,
      message: '统计成功',
      data: { count },
      timestamp: Date.now(),
    };
  }
}
