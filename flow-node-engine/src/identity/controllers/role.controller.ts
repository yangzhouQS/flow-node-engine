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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RoleService } from '../services/role.service';

@ApiTags('角色管理')
@Controller('api/v1/roles')
@UseGuards(JwtAuthGuard)
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Post()
  @ApiOperation({ summary: '创建角色' })
  @ApiResponse({ status: 200, description: '创建成功' })
  async create(@Body() dto: any) {
    const role = await this.roleService.create(dto);
    return {
      code: 200,
      message: '创建成功',
      data: role,
      timestamp: Date.now(),
    };
  }

  @Get()
  @ApiOperation({ summary: '查询角色列表' })
  @ApiResponse({ status: 200, description: '查询成功' })
  async findAll(@Query() query: any) {
    const result = await this.roleService.findAll(query);
    return {
      code: 200,
      message: '查询成功',
      data: result,
      timestamp: Date.now(),
    };
  }

  @Get(':id')
  @ApiOperation({ summary: '查询角色详情' })
  @ApiResponse({ status: 200, description: '查询成功' })
  async findById(@Param('id') id: string) {
    const role = await this.roleService.findById(id);
    return {
      code: 200,
      message: '查询成功',
      data: role,
      timestamp: Date.now(),
    };
  }

  @Get('name/:name')
  @ApiOperation({ summary: '根据名称查询角色' })
  @ApiResponse({ status: 200, description: '查询成功' })
  async findByName(@Param('name') name: string) {
    const role = await this.roleService.findByName(name);
    return {
      code: 200,
      message: '查询成功',
      data: role,
      timestamp: Date.now(),
    };
  }

  @Get('code/:code')
  @ApiOperation({ summary: '根据代码查询角色' })
  @ApiResponse({ status: 200, description: '查询成功' })
  async findByCode(@Param('code') code: string) {
    const role = await this.roleService.findByCode(code);
    return {
      code: 200,
      message: '查询成功',
      data: role,
      timestamp: Date.now(),
    };
  }

  @Put(':id')
  @ApiOperation({ summary: '更新角色' })
  @ApiResponse({ status: 200, description: '更新成功' })
  async update(@Param('id') id: string, @Body() dto: any) {
    const role = await this.roleService.update(id, dto);
    return {
      code: 200,
      message: '更新成功',
      data: role,
      timestamp: Date.now(),
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除角色' })
  @ApiResponse({ status: 200, description: '删除成功' })
  async delete(@Param('id') id: string) {
    await this.roleService.delete(id);
    return {
      code: 200,
      message: '删除成功',
      data: null,
      timestamp: Date.now(),
    };
  }

  @Delete()
  @ApiOperation({ summary: '批量删除角色' })
  @ApiResponse({ status: 200, description: '删除成功' })
  async deleteMany(@Body() body: { ids: string[] }) {
    await this.roleService.deleteMany(body.ids);
    return {
      code: 200,
      message: '删除成功',
      data: null,
      timestamp: Date.now(),
    };
  }

  @Get(':id/users')
  @ApiOperation({ summary: '查询角色下的所有用户' })
  @ApiResponse({ status: 200, description: '查询成功' })
  async getRoleUsers(@Param('id') id: string) {
    const users = await this.roleService.getRoleUsers(id);
    return {
      code: 200,
      message: '查询成功',
      data: users,
      timestamp: Date.now(),
    };
  }

  @Get(':id/user-ids')
  @ApiOperation({ summary: '查询角色下的所有用户 ID' })
  @ApiResponse({ status: 200, description: '查询成功' })
  async getRoleUserIds(@Param('id') id: string) {
    const userIds = await this.roleService.getRoleUserIds(id);
    return {
      code: 200,
      message: '查询成功',
      data: userIds,
      timestamp: Date.now(),
    };
  }

  @Get('count')
  @ApiOperation({ summary: '统计角色数量' })
  @ApiResponse({ status: 200, description: '统计成功' })
  async count(@Query() query: any) {
    const count = await this.roleService.count(query);
    return {
      code: 200,
      message: '统计成功',
      data: { count },
      timestamp: Date.now(),
    };
  }
}
