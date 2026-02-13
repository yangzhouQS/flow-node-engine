import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';

// Entities
import { GroupController } from './controllers/group.controller';
import { RoleController } from './controllers/role.controller';
import { UserController } from './controllers/user.controller';
import { Group } from './entities/group.entity';
import { Role } from './entities/role.entity';
import { UserGroup } from './entities/user-group.entity';
import { UserRole } from './entities/user-role.entity';
import { User } from './entities/user.entity';

// Services
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PermissionGuard } from './guards/permission.guard';
import { GroupService } from './services/group.service';
import { IdentityService } from './services/identity.service';
import { RoleService } from './services/role.service';
import { UserService } from './services/user.service';

// Controllers

// Guards and Strategies
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Role, Group, UserRole, UserGroup]),
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get('JWT_EXPIRES_IN', '7d'),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    IdentityService,
    UserService,
    RoleService,
    GroupService,
    JwtStrategy,
    JwtAuthGuard,
    PermissionGuard,
  ],
  controllers: [
    UserController,
    RoleController,
    GroupController,
  ],
  exports: [
    IdentityService,
    UserService,
    RoleService,
    GroupService,
    JwtAuthGuard,
    PermissionGuard,
  ],
})
export class IdentityModule {}
