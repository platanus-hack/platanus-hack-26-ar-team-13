import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { configuration } from './config/configuration';
import { LlmAnalyzerModule } from './llm-analyzer/llm-analyzer.module';
import { AnalyzerModule } from './analyzer/analyzer.module';
import { ProxyModule } from './proxy/proxy.module';
import { InstallModule } from './install/install.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: '.env',
    }),
    LlmAnalyzerModule,
    AnalyzerModule,
    ProxyModule,
    InstallModule,
  ],
})
export class AppModule {}
