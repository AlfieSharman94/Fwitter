import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import * as jwksRsa from 'jwks-rsa';

export type CognitoJwtPayload = {
  sub: string;
  email?: string;
  token_use?: 'id' | 'access';
  iss?: string;
  aud?: string;
  client_id?: string;
  exp?: number;
  iat?: number;
};

@Injectable()
export class CognitoJwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly config: ConfigService) {
    const region = config.get<string>('AWS_REGION');
    const userPoolId = config.get<string>('COGNITO_USER_POOL_ID');
    const clientId = config.get<string>('COGNITO_APP_CLIENT_ID');

    if (!region || !userPoolId || !clientId) {
      throw new Error(
        'Missing env vars: AWS_REGION, COGNITO_USER_POOL_ID, COGNITO_APP_CLIENT_ID',
      );
    }

    const issuer = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`;

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      issuer,
      algorithms: ['RS256'],
      ignoreExpiration: false,

      // Fetch Cognito public keys automatically
      secretOrKeyProvider: jwksRsa.passportJwtSecret({
        cache: true,
        cacheMaxEntries: 5,
        cacheMaxAge: 10 * 60 * 1000, // 10 mins
        rateLimit: true,
        jwksRequestsPerMinute: 10,
        jwksUri: `${issuer}/.well-known/jwks.json`,
      }),

      // ✅ Verify audience/client depending on token type
      audience: clientId,
    });
  }

  async validate(payload: any) {
    try {
      if (!payload?.sub) {
        throw new UnauthorizedException('missing_sub');
      }

      const tokenUse = payload?.token_use;
      if (tokenUse !== 'id' && tokenUse !== 'access') {
        throw new UnauthorizedException('invalid_token_use');
      }

      const clientId = process.env.COGNITO_APP_CLIENT_ID;
      const audOk = payload?.aud === clientId || payload?.client_id === clientId;
      if (!audOk) {
        throw new UnauthorizedException('invalid_audience');
      }

      return { sub: payload.sub, email: payload.email };
    } catch (e) {
      // IMPORTANT: always convert to 401 so we never respond 500
      throw new UnauthorizedException();
    }
  }
}
