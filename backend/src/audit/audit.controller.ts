import { Controller, Get, Query } from '@nestjs/common';
import { AuditService, CompanyStat } from './audit.service';
import { AuditLog } from './audit-log.entity';
import { IsOptional, IsString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

class AuditQueryDto {
  @IsOptional()
  @IsString()
  company?: string;

  @IsOptional()
  @IsString()
  verdict?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit: number = 50;
}

@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  findAll(
    @Query() query: AuditQueryDto,
  ): Promise<{ data: AuditLog[]; total: number }> {
    return this.auditService.findAll(query);
  }

  @Get('stats')
  getStats(): Promise<CompanyStat[]> {
    return this.auditService.getStats();
  }
}
