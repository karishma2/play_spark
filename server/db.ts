import { MongoClient } from "mongodb";

export interface MongoClientProvider {
  getClient(): Promise<MongoClient>;
}

export function createMongoClientProvider(mongoUri?: string): MongoClientProvider {
  let clientPromise: Promise<MongoClient> | undefined;

  return {
    async getClient(): Promise<MongoClient> {
      if (!mongoUri) {
        throw new Error("MONGODB_URI is not configured");
      }

      if (!clientPromise) {
        const client = new MongoClient(mongoUri, {
          maxPoolSize: 10,
          minPoolSize: 0,
          maxIdleTimeMS: 30_000,
          serverSelectionTimeoutMS: 8_000,
        });

        clientPromise = client.connect().catch((error: unknown) => {
          clientPromise = undefined;
          throw error;
        });
      }

      return clientPromise;
    },
  };
}
