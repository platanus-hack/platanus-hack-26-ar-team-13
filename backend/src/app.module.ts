import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { configuration } from './config/configuration';
import { LlmAnalyzerModule } from './llm-analyzer/llm-analyzer.module';
import { AnalyzerModule } from './analyzer/analyzer.module';
import { ProxyModule } from './proxy/proxy.module';
import { AuditModule } from './audit/audit.module';
import { AuditLog } from './audit/audit-log.entity';
import { InstallModule } from './install/install.module';
import { AuthModule } from './auth/auth.module';
import { ApiClient } from './auth/api-client.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: '.env',
    }),
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: process.env.DB_PATH ?? 'audit.db',
      entities: [AuditLog, ApiClient],
      synchronize: true,
    }),
    LlmAnalyzerModule,
    AnalyzerModule,
    ProxyModule,
    AuditModule,
    InstallModule,
    AuthModule,
  ],
})
export class AppModule {}
