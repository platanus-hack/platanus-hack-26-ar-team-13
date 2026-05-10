export enum Verdict {
  /** Tool use is permitted without intervention. */
  ALLOW = 'allow',
  /** Tool use is permitted but user should be warned about moderate risk. */
  WARN = 'warn',
  /** Tool use is blocked due to high security risk. */
  BLOCK = 'block',
}
