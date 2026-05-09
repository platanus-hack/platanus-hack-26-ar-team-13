export interface AppConfiguration {
  nodeEnv: string;
  port: number;
  logLevel: string;
  anthropic: {
    apiKey: string;
    baseUrl: string;
    model: string;
  };
  features: {
    enableRuleEngine: boolean;
    enableLlmAnalyzer: boolean;
    enableDetailedLogging: boolean;
  };
  thresholds: {
    /** Score at or above this value yields WARN; at or above 70 yields BLOCK. */
    riskScoreWarn: number;
  };
}

export function configuration(): AppConfiguration {
  return {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    port: parseInt(process.env.PORT ?? '3000', 10),
    logLevel: process.env.LOG_LEVEL ?? 'debug',
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY ?? '',
      baseUrl: process.env.ANTHROPIC_BASE_URL ?? 'https://api.anthropic.com',
      model: process.env.LLM_MODEL ?? 'claude-sonnet-4-6',
    },
    features: {
      enableRuleEngine: process.env.ENABLE_RULE_ENGINE !== 'false',
      enableLlmAnalyzer: process.env.ENABLE_LLM_ANALYZER !== 'false',
      enableDetailedLogging: process.env.ENABLE_DETAILED_LOGGING === 'true',
    },
    thresholds: {
      riskScoreWarn: parseInt(process.env.RISK_SCORE_THRESHOLD ?? '30', 10),
    },
  };
}
