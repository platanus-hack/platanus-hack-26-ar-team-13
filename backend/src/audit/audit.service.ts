import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './audit-log.entity';

interface AuditEntry {
  company: string;
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
      company: entry.company,
      tool_name: entry.tool_name,
      command: entry.command,
      verdict: entry.verdict,
      risk_score: entry.risk_score,
    });
  }
}
