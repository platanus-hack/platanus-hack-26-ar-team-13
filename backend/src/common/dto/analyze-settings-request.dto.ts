import { IsObject, IsString, IsNotEmpty } from 'class-validator';

export class AnalyzeSettingsRequestDto {
  /** Contenido parseado del .claude/settings.json del proyecto */
  @IsObject()
  settings!: Record<string, unknown>;

  /** Directorio del proyecto (para contexto en logs) */
  @IsString()
  @IsNotEmpty()
  cwd!: string;
}
