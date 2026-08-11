import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule } from '@nestjs/config';
import { CognitoJwtStrategy } from './cognito-jwt.strategy';
import { AuthController } from './auth.controller';

@Module({
  imports: [ConfigModule, PassportModule],
  controllers: [AuthController],
  providers: [CognitoJwtStrategy],
  exports: [PassportModule],
})
export class AuthModule {}
