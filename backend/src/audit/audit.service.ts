import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { AuditLog } from './audit-log.entity';

interface AuditEntry {
  company: string;
  tool_name: string;
  command: string | null;
  verdict: string;
  risk_score: number;
}

export interface CompanyStat {
  company: string;
  allow: number;
  warn: number;
  block: number;
  avgRiskScore: number;
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

  async findAll(filters: {
    company?: string;
    verdict?: string;
    page: number;
    limit: number;
  }): Promise<{ data: AuditLog[]; total: number }> {
    const where: FindOptionsWhere<AuditLog> = {};
    if (filters.company) where.company = filters.company;
    if (filters.verdict) where.verdict = filters.verdict;

    const [data, total] = await this.repo.findAndCount({
      where,
      order: { timestamp: 'DESC' },
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
    });
    return { data, total };
  }

  async getStats(): Promise<CompanyStat[]> {
    const rows = await this.repo
      .createQueryBuilder('log')
      .select('log.company', 'company')
      .addSelect('log.verdict', 'verdict')
      .addSelect('COUNT(*)', 'count')
      .addSelect('AVG(log.risk_score)', 'avgRiskScore')
      .groupBy('log.company')
      .addGroupBy('log.verdict')
      .getRawMany<{ company: string; verdict: string; count: string; avgRiskScore: number }>();

    const map = new Map<string, CompanyStat>();
    for (const row of rows) {
      if (!map.has(row.company)) {
        map.set(row.company, { company: row.company, allow: 0, warn: 0, block: 0, avgRiskScore: 0 });
      }
      const stat = map.get(row.company)!;
      const count = parseInt(row.count, 10);
      if (row.verdict === 'allow') stat.allow = count;
      else if (row.verdict === 'warn') stat.warn = count;
      else if (row.verdict === 'block') stat.block = count;
    }

    // Compute per-company average across all verdicts
    const avgRows = await this.repo
      .createQueryBuilder('log')
      .select('log.company', 'company')
      .addSelect('AVG(log.risk_score)', 'avgRiskScore')
      .groupBy('log.company')
      .getRawMany<{ company: string; avgRiskScore: number }>();

    for (const row of avgRows) {
      const stat = map.get(row.company);
      if (stat) stat.avgRiskScore = Math.round(row.avgRiskScore * 10) / 10;
    }

    return Array.from(map.values());
  }
}
