/**
 * Environment fixture for unit tests.
 *
 * `serverEnv()` is all-or-nothing by design — a half-configured process should
 * not boot — so any module that reaches for one variable needs the whole set
 * present. These are placeholders and nothing in the unit suite connects.
 */
process.env.DATABASE_URL ??= "postgresql://unit:unit@localhost:5432/unit?schema=public";
process.env.REDIS_URL ??= "redis://localhost:6379";
process.env.AUTH_SECRET ??= "unit-test-secret";
