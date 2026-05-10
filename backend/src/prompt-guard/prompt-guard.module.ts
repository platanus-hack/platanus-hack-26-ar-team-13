import { Module } from '@nestjs/common';
import { PromptGuardService } from './prompt-guard.service';

@Module({
  providers: [PromptGuardService],
  exports: [PromptGuardService],
})
export class PromptGuardModule {}
