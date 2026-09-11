import { describe, expect, it } from "vitest";
import { setEnvKey } from "@/lib/env-file";

describe("setEnvKey", () => {
  it("replaces the value and nothing else", () => {
    const before = 'DATABASE_URL="postgres://x"\nEMAIL_SERVER=""\nAUTH_SECRET="abc"\n';
    expect(setEnvKey(before, "EMAIL_SERVER", "smtps://u:p@h:465")).toBe(
      'DATABASE_URL="postgres://x"\nEMAIL_SERVER="smtps://u:p@h:465"\nAUTH_SECRET="abc"\n',
    );
  });

  it("appends when the key is absent", () => {
    expect(setEnvKey('A="1"\n', "EMAIL_SERVER", "x")).toBe('A="1"\n\nEMAIL_SERVER="x"');
  });

  it("leaves a commented-out line commented out", () => {
    // Replacing it would silently re-enable a setting someone turned off, and
    // would also leave the real line untouched further down.
    const before = '# EMAIL_SERVER="old"\nEMAIL_SERVER="current"\n';
    expect(setEnvKey(before, "EMAIL_SERVER", "new")).toBe(
      '# EMAIL_SERVER="old"\nEMAIL_SERVER="new"\n',
    );
  });

  it("is not fooled by a key that merely starts the same", () => {
    const before = 'EMAIL_SERVER_BACKUP="keep"\nEMAIL_SERVER="replace"\n';
    expect(setEnvKey(before, "EMAIL_SERVER", "new")).toBe(
      'EMAIL_SERVER_BACKUP="keep"\nEMAIL_SERVER="new"\n',
    );
  });

  it("replaces every occurrence, so a stale duplicate cannot win", () => {
    // dotenv takes the last one. Leaving an old duplicate behind would mean the
    // file looks right and the app reads something else.
    const before = 'EMAIL_SERVER="one"\nX="y"\nEMAIL_SERVER="two"\n';
    expect(setEnvKey(before, "EMAIL_SERVER", "new")).toBe(
      'EMAIL_SERVER="new"\nX="y"\nEMAIL_SERVER="new"\n',
    );
  });

  it("keeps a trailing comment off the replaced line, not merged into it", () => {
    const before = 'EMAIL_SERVER=""   # set by npm run smtp\n';
    expect(setEnvKey(before, "EMAIL_SERVER", "new")).toBe('EMAIL_SERVER="new"\n');
  });

  it("handles a file with no trailing newline", () => {
    expect(setEnvKey('A="1"', "A", "2")).toBe('A="2"');
  });
});
