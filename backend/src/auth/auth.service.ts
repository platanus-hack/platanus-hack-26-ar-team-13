import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { ApiClient } from './api-client.entity';

export interface RegisterResult {
  apiKey: string;
  clientName: string;
  message: string;
}

export interface ValidateResult {
  valid: boolean;
  clientName?: string;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(ApiClient)
    private readonly repo: Repository<ApiClient>,
  ) {}

  async register(clientName: string, email?: string): Promise<RegisterResult> {
    const apiKey = `sk-hackant-${randomBytes(24).toString('hex')}`;

    const client = this.repo.create({
      apiKey,
      clientName,
      email: email ?? null,
      active: true,
    });

    await this.repo.save(client);

    return {
      apiKey,
      clientName,
      message: `API key created for "${clientName}". Store it securely — it will not be shown again.`,
    };
  }

  async validate(apiKey: string): Promise<ValidateResult> {
    const client = await this.repo.findOne({ where: { apiKey, active: true } });
    if (!client) {
      return { valid: false };
    }
    return { valid: true, clientName: client.clientName };
  }

  async validateOrThrow(apiKey: string): Promise<ApiClient> {
    const client = await this.repo.findOne({ where: { apiKey, active: true } });
    if (!client) {
      throw new UnauthorizedException('Invalid or inactive API key');
    }
    return client;
  }
}
