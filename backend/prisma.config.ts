
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  engine: "classic",
  datasource: {
    // La CLI usa la conexión directa de Neon; en desarrollo alcanza DATABASE_URL.
    url: process.env.DIRECT_URL || env("DATABASE_URL"),
  },
});
