import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';

/**
 * Guard that validates the `Authorization: Bearer <api-key>` header.
 *
 * Apply to any controller or route that should be restricted to registered clients:
 *
 *   @UseGuards(ApiKeyGuard)
 *   @Controller('analyze')
 *   export class AnalyzerController { ... }
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException(
        'Missing Authorization header. Use: Authorization: Bearer <api-key>',
      );
    }

    const apiKey = authHeader.slice('Bearer '.length).trim();
    if (!apiKey) {
      throw new UnauthorizedException('API key must not be empty');
    }

    // Throws UnauthorizedException if the key is invalid or inactive
    await this.authService.validateOrThrow(apiKey);
    return true;
  }
}
