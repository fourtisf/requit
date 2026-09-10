import { describe, expect, it } from "vitest";
import { toCsv, type StatementRow } from "@/lib/statement";

function row(overrides: Partial<StatementRow> = {}): StatementRow {
  return {
    date: new Date("2026-09-10T12:00:00.000Z"),
    kind: "reward",
    description: "TOROX",
    status: "AVAILABLE",
    amount: "12.5000",
    reference: "txn-1",
    ...overrides,
  };
}

describe("toCsv", () => {
  it("writes a header and one line per row, CRLF terminated", () => {
    const csv = toCsv([row()]);
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe("date,type,description,status,amount,reference");
    expect(lines[1]).toBe("2026-09-10T12:00:00.000Z,reward,TOROX,AVAILABLE,12.5000,txn-1");
  });

  it("quotes and escapes a field containing a comma or a quote", () => {
    const csv = toCsv([row({ description: 'Level 5, "boss" stage' })]);
    expect(csv).toContain('"Level 5, ""boss"" stage"');
  });

  it("neutralises a field that a spreadsheet would run as a formula", () => {
    // Tier labels and network transaction ids are third-party strings. A cell
    // beginning = + - or @ is executed on open, which is how a CSV export turns
    // into code execution on the member's machine.
    const csv = toCsv([row({ description: "=1+1" })]);
    expect(csv).not.toMatch(/,=1\+1,/);
    expect(csv).toContain("'=1+1");
  });

  it("keeps a negative amount readable rather than treating it as a formula", () => {
    const csv = toCsv([row({ kind: "withdrawal", amount: "-25.0000" })]);
    expect(csv).toContain("'-25.0000");
  });

  it("emits only the header when there is nothing to report", () => {
    expect(toCsv([])).toBe("date,type,description,status,amount,reference");
  });
});
