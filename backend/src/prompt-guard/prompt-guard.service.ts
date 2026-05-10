import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface PromptGuardResult {
  injectionScore: number;
  jailbreakScore: number;
  combinedRiskScore: number;
  label: 'INJECTION' | 'LEGIT';
  rawScores: Record<string, number>;
}

const HF_API_URL =
  'https://router.huggingface.co/hf-inference/models/protectai/deberta-v3-base-prompt-injection-v2';

@Injectable()
export class PromptGuardService {
  private readonly logger = new Logger(PromptGuardService.name);
  private readonly token: string;

  constructor(private readonly configService: ConfigService) {
    this.token = this.configService.get<string>('HUGGINGFACE_API_TOKEN') ?? '';
    if (!this.token) {
      this.logger.warn(
        'HUGGINGFACE_API_TOKEN is not set — Layer 2 PromptGuard classification will not be available',
      );
    }
  }

  async classify(text: string): Promise<PromptGuardResult> {
    const res = await fetch(HF_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputs: text }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`PromptGuard API error ${res.status}: ${body}`);
    }

    const json: unknown = await res.json();

    if (
      !Array.isArray(json) ||
      !Array.isArray((json as unknown[][])[0])
    ) {
      throw new Error(
        `Unexpected PromptGuard response shape: ${JSON.stringify(json)}`,
      );
    }

    const labels = (json as Array<Array<{ label: string; score: number }>>)[0];

    const rawScores: Record<string, number> = {};
    for (const entry of labels) {
      rawScores[entry.label] = entry.score;
    }

    const injectionScore = Math.round((rawScores['INJECTION'] ?? 0) * 100);
    const jailbreakScore = 0;
    const combinedRiskScore = injectionScore;

    const top = labels.reduce((a, b) => (a.score > b.score ? a : b));
    const label = top.label as 'INJECTION' | 'LEGIT';

    return { injectionScore, jailbreakScore, combinedRiskScore, label, rawScores };
  }
}
