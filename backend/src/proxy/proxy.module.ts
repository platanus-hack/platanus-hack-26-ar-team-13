import { Module } from '@nestjs/common';
import { AnalyzerModule } from '../analyzer/analyzer.module';
import { AuditModule } from '../audit/audit.module';
import { ProxyController } from './proxy.controller';
import { ProxyService } from './proxy.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AnalyzerModule, AuditModule, AuthModule],
  controllers: [ProxyController],
  providers: [ProxyService],
})
export class ProxyModule {}
