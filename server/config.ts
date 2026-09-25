export interface AppConfig {
  databaseName: string;
  mongoUri?: string;
  passwordResetBaseUrl: string;
  port: number;
  resendApiKey?: string;
  resendFromEmail?: string;
  sessionSecret: string;
}

const minimumSessionSecretLength = 32;

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
  const sessionSecret = environment.SESSION_SECRET;

  if (!sessionSecret || sessionSecret.length < minimumSessionSecretLength) {
    throw new Error(
      `SESSION_SECRET must be configured and contain at least ${minimumSessionSecretLength} characters.`,
    );
  }

  const port = Number.parseInt(environment.PORT ?? "3000", 10);

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("PORT must be a valid TCP port number.");
  }

  const passwordResetBaseUrl = environment.APP_BASE_URL ?? `http://localhost:${port}`;
  try {
    const url = new URL(passwordResetBaseUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error();
  } catch {
    throw new Error("APP_BASE_URL must be a valid HTTP or HTTPS URL.");
  }

  const resendApiKey = environment.RESEND_API_KEY?.trim() || undefined;
  const resendFromEmail = environment.RESEND_FROM_EMAIL?.trim() || undefined;
  if (Boolean(resendApiKey) !== Boolean(resendFromEmail)) {
    throw new Error("RESEND_API_KEY and RESEND_FROM_EMAIL must be configured together.");
  }

  return {
    databaseName: environment.MONGODB_DB_NAME ?? "play_spark_dev",
    mongoUri: environment.MONGODB_URI,
    passwordResetBaseUrl: passwordResetBaseUrl.replace(/\/$/u, ""),
    port,
    resendApiKey,
    resendFromEmail,
    sessionSecret,
  };
}
