export const DEFAULT_SIMULATION_RATE_LIMIT = 30;
export const DEFAULT_COURTROOM_RATE_LIMIT = 10;
export const DEFAULT_RATE_LIMIT_WINDOW_SECONDS = 600;

export type DemoEnvironment = Readonly<{
  DEMO_MODE?: string;
  SIMULATION_RATE_LIMIT?: string;
  COURTROOM_RATE_LIMIT?: string;
  RATE_LIMIT_WINDOW_SECONDS?: string;
  VERCEL?: string;
  [key: string]: string | undefined;
}>;

export type DemoConfiguration = Readonly<{
  demoMode: boolean;
  simulationRateLimit: number;
  courtroomRateLimit: number;
  windowSeconds: number;
}>;

export function parseDemoMode(value: string | undefined) {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "false") return false;
  if (normalized === "true" || !normalized) return true;

  // An invalid deployment value fails toward the safer, visibly constrained mode.
  return true;
}

function parseBoundedInteger(value: string | undefined, fallback: number, maximum: number) {
  if (!value || !/^\d+$/.test(value.trim())) return fallback;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= maximum ? parsed : fallback;
}

export function parseDemoConfiguration(environment: DemoEnvironment = {}): DemoConfiguration {
  return {
    demoMode: parseDemoMode(environment.DEMO_MODE),
    simulationRateLimit: parseBoundedInteger(
      environment.SIMULATION_RATE_LIMIT,
      DEFAULT_SIMULATION_RATE_LIMIT,
      1_000,
    ),
    courtroomRateLimit: parseBoundedInteger(
      environment.COURTROOM_RATE_LIMIT,
      DEFAULT_COURTROOM_RATE_LIMIT,
      1_000,
    ),
    windowSeconds: parseBoundedInteger(
      environment.RATE_LIMIT_WINDOW_SECONDS,
      DEFAULT_RATE_LIMIT_WINDOW_SECONDS,
      86_400,
    ),
  };
}
