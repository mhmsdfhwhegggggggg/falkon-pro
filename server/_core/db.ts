import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { ENV } from "./env";
import * as schema from "../../drizzle/schema";
import { Secrets } from "./secrets";

const url = Secrets.getDatabaseUrl() || ENV.databaseUrl;

function createThrowingDb(message: string) {
  return new Proxy({}, {
    get() {
      throw new Error(message);
    },
    apply() {
      throw new Error(message);
    },
  }) as any;
}

export const db = url
  ? drizzle(postgres(url), { schema })
  : createThrowingDb("Database not configured. Please open the Setup tab and save Database URL.");
