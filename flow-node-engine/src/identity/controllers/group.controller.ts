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
import { GroupService } from '../services/group.service';

@ApiTags('组管理')
@Controller('api/v1/groups')
@UseGuards(JwtAuthGuard)
export class GroupController {
  constructor(private readonly groupService: GroupService) {}

  @Post()
  @ApiOperation({ summary: '创建组' })
  @ApiResponse({ status: 200, description: '创建成功' })
  async create(@Body() dto: any) {
    const group = await this.groupService.create(dto);
    return {
      code: 200,
      message: '创建成功',
      data: group,
      timestamp: Date.now(),
    };
  }

  @Get()
  @ApiOperation({ summary: '查询组列表' })
  @ApiResponse({ status: 200, description: '查询成功' })
  async findAll(@Query() query: any) {
    const result = await this.groupService.findAll(query);
    return {
      code: 200,
      message: '查询成功',
      data: result,
      timestamp: Date.now(),
    };
  }

  @Get(':id')
  @ApiOperation({ summary: '查询组详情' })
  @ApiResponse({ status: 200, description: '查询成功' })
  async findById(@Param('id') id: string) {
    const group = await this.groupService.findById(id);
    return {
      code: 200,
      message: '查询成功',
      data: group,
      timestamp: Date.now(),
    };
  }

  @Get('name/:name')
  @ApiOperation({ summary: '根据名称查询组' })
  @ApiResponse({ status: 200, description: '查询成功' })
  async findByName(@Param('name') name: string) {
    const group = await this.groupService.findByName(name);
    return {
      code: 200,
      message: '查询成功',
      data: group,
      timestamp: Date.now(),
    };
  }

  @Get('code/:code')
  @ApiOperation({ summary: '根据代码查询组' })
  @ApiResponse({ status: 200, description: '查询成功' })
  async findByCode(@Param('code') code: string) {
    const group = await this.groupService.findByCode(code);
    return {
      code: 200,
      message: '查询成功',
      data: group,
      timestamp: Date.now(),
    };
  }

  @Get(':id/children')
  @ApiOperation({ summary: '查询子组' })
  @ApiResponse({ status: 200, description: '查询成功' })
  async findChildren(@Param('id') id: string) {
    const children = await this.groupService.findChildren(id);
    return {
      code: 200,
      message: '查询成功',
      data: children,
      timestamp: Date.now(),
    };
  }

  @Get('tree')
  @ApiOperation({ summary: '查询组树' })
  @ApiResponse({ status: 200, description: '查询成功' })
  async findTree(@Query('parentId') parentId: string) {
    const tree = await this.groupService.findTree(parentId);
    return {
      code: 200,
      message: '查询成功',
      data: tree,
      timestamp: Date.now(),
    };
  }

  @Put(':id')
  @ApiOperation({ summary: '更新组' })
  @ApiResponse({ status: 200, description: '更新成功' })
  async update(@Param('id') id: string, @Body() dto: any) {
    const group = await this.groupService.update(id, dto);
    return {
      code: 200,
      message: '更新成功',
      data: group,
      timestamp: Date.now(),
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除组' })
  @ApiResponse({ status: 200, description: '删除成功' })
  async delete(@Param('id') id: string) {
    await this.groupService.delete(id);
    return {
      code: 200,
      message: '删除成功',
      data: null,
      timestamp: Date.now(),
    };
  }

  @Delete()
  @ApiOperation({ summary: '批量删除组' })
  @ApiResponse({ status: 200, description: '删除成功' })
  async deleteMany(@Body() body: { ids: string[] }) {
    await this.groupService.deleteMany(body.ids);
    return {
      code: 200,
      message: '删除成功',
      data: null,
      timestamp: Date.now(),
    };
  }

  @Get(':id/users')
  @ApiOperation({ summary: '查询组下的所有用户' })
  @ApiResponse({ status: 200, description: '查询成功' })
  async getGroupUsers(@Param('id') id: string) {
    const users = await this.groupService.getGroupUsers(id);
    return {
      code: 200,
      message: '查询成功',
      data: users,
      timestamp: Date.now(),
    };
  }

  @Get(':id/user-ids')
  @ApiOperation({ summary: '查询组下的所有用户 ID' })
  @ApiResponse({ status: 200, description: '查询成功' })
  async getGroupUserIds(@Param('id') id: string) {
    const userIds = await this.groupService.getGroupUserIds(id);
    return {
      code: 200,
      message: '查询成功',
      data: userIds,
      timestamp: Date.now(),
    };
  }

  @Get('count')
  @ApiOperation({ summary: '统计组数量' })
  @ApiResponse({ status: 200, description: '统计成功' })
  async count(@Query() query: any) {
    const count = await this.groupService.count(query);
    return {
      code: 200,
      message: '统计成功',
      data: { count },
      timestamp: Date.now(),
    };
  }
}
