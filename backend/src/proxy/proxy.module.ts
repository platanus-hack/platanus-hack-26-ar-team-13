import { Module } from '@nestjs/common';
import { AnalyzerModule } from '../analyzer/analyzer.module';
import { AuditModule } from '../audit/audit.module';
import { ProxyController } from './proxy.controller';
import { ProxyService } from './proxy.service';

@Module({
  imports: [AnalyzerModule, AuditModule],
  controllers: [ProxyController],
  providers: [ProxyService],
})
export class ProxyModule {}
