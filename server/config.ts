export interface AppConfig {
  databaseName: string;
  mongoUri?: string;
  port: number;
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

  return {
    databaseName: environment.MONGODB_DB_NAME ?? "play_spark_dev",
    mongoUri: environment.MONGODB_URI,
    port,
    sessionSecret,
  };
}
