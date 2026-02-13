import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { JwtStrategy } from '../strategies/jwt.strategy';

/**
 * JWT 认证守卫
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly jwtStrategy: JwtStrategy) {
    super();
  }
}
