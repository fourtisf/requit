import { testDatabaseUrl } from "./db-global-setup";

/**
 * Runs before each integration test file is imported, so that the Prisma client
 * constructed at module scope in `@/lib/prisma` picks up the test database
 * rather than the developer's own.
 */
process.env.DATABASE_URL = testDatabaseUrl();
process.env.REDIS_URL ??= "redis://localhost:6379";
process.env.AUTH_SECRET ??= "integration-test-secret";
