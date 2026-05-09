import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { configuration } from './config/configuration';
import { LlmAnalyzerModule } from './llm-analyzer/llm-analyzer.module';
import { AnalyzerModule } from './analyzer/analyzer.module';
import { ProxyModule } from './proxy/proxy.module';
import { AuditModule } from './audit/audit.module';
import { AuditLog } from './audit/audit-log.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: '.env',
    }),
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: 'audit.db',
      entities: [AuditLog],
      synchronize: true,
    }),
    LlmAnalyzerModule,
    AnalyzerModule,
    ProxyModule,
    AuditModule,
  ],
})
export class AppModule {}
