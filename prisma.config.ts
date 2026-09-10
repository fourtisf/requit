import path from "node:path";
import "dotenv/config"; // Prisma skips .env loading once a config file exists.
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
