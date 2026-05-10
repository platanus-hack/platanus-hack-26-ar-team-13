import { Module } from '@nestjs/common';
import { AnalyzerModule } from '../analyzer/analyzer.module';
import { ProxyController } from './proxy.controller';
import { ProxyService } from './proxy.service';

@Module({
  imports: [AnalyzerModule],
  controllers: [ProxyController],
  providers: [ProxyService],
})
export class ProxyModule {}
