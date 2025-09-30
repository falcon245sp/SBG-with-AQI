import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.DATABASE_URL || 
  `postgresql://${process.env.GOOGLE_SQL_USERNAME}:${process.env.GOOGLE_SQL_PASSWORD}@${process.env.GOOGLE_SQL_HOST}:5432/${process.env.GOOGLE_SQL_DATABASE}?sslmode=require`;

if (!databaseUrl) {
  throw new Error("DATABASE_URL or Google Cloud SQL credentials required");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
});
