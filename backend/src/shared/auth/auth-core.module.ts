import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { APP_CONFIG, type AppConfig } from '../config/app-config.js';
import { AccessTokenService } from './access-token.service.js';

/** JWT signing/verification shared by the auth module and the global guard. */
@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({
        secret: config.auth.jwtSecret,
        signOptions: { algorithm: 'HS256' },
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
  ],
  providers: [AccessTokenService],
  exports: [AccessTokenService],
})
export class AuthCoreModule {}
