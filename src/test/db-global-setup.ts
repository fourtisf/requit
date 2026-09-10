import { execFileSync } from "node:child_process";

/**
 * Brings the test database up to the current migrations, once per run.
 *
 * Uses `migrate deploy` rather than `db push` on purpose: this is also a check
 * that the committed migrations actually apply from empty, which is the thing
 * that breaks a production deploy.
 */
export default function setup(): void {
  const url = testDatabaseUrl();

  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: url },
    stdio: "inherit",
  });
}

export function testDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;

  if (!url) {
    throw new Error(
      "TEST_DATABASE_URL is not set. Integration tests need their own database — " +
        "they truncate every table. Never point this at a database you care about.",
    );
  }

  return url;
}
