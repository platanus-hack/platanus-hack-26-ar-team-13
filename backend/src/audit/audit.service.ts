import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './audit-log.entity';

interface AuditEntry {
  api_key: string;
  tool_name: string;
  command: string | null;
  verdict: string;
  risk_score: number;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly repo: Repository<AuditLog>,
  ) {}

  async save(entry: AuditEntry): Promise<void> {
    await this.repo.save({
      api_key_prefix: entry.api_key.slice(0, 20),
      tool_name: entry.tool_name,
      command: entry.command,
      verdict: entry.verdict,
      risk_score: entry.risk_score,
    });
  }
}
