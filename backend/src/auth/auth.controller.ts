import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { IsString, IsEmail, IsOptional, MinLength } from 'class-validator';
import { AuthService, RegisterResult, ValidateResult } from './auth.service';

class RegisterDto {
  @IsString()
  @MinLength(2)
  clientName!: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}

class ValidateDto {
  @IsString()
  apiKey!: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Register a new client and receive an API key.
   *
   * POST /auth/register
   * Body: { "clientName": "acme-corp", "email": "dev@acme.com" }
   * Returns: { "apiKey": "sk-hackant-...", "clientName": "...", "message": "..." }
   */
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto): Promise<RegisterResult> {
    return this.authService.register(dto.clientName, dto.email);
  }

  /**
   * Validate an API key.
   *
   * POST /auth/validate
   * Body: { "apiKey": "sk-hackant-..." }
   * Returns: { "valid": true, "clientName": "..." }
   */
  @Post('validate')
  @HttpCode(HttpStatus.OK)
  async validate(@Body() dto: ValidateDto): Promise<ValidateResult> {
    return this.authService.validate(dto.apiKey);
  }
}
