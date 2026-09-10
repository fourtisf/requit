import { requireUser } from "@/lib/session";
import { AppNav } from "@/components/app-nav";
import { Card, CardHeader } from "@/components/ui/card";
import { TableScroll, Th, Td } from "@/components/ui/table";
import { statement } from "@/lib/statement";

export const metadata = { title: "History" };

const STATUS_TONE: Record<string, string> = {
  AVAILABLE: "text-ac-2",
  SETTLED: "text-ac-2",
  REVERSED: "text-amber",
  FAILED: "text-amber",
  WITHHELD: "text-amber",
};

export default async function HistoryPage() {
  const user = await requireUser();
  const rows = await statement(user.id);

  return (
    <main className="shell py-10">
      <AppNav current="/history" />

      <div className="flex flex-wrap items-end gap-4">
        <div>
          <h1 className="text-[27px] font-semibold tracking-[-0.042em]">History</h1>
          <p className="mt-2.5 max-w-[62ch] text-[13.5px] leading-[1.6] text-fg-2">
            Everything that moved, including reversals. We publish our numbers so you can check
            them; this is the same thing pointed at your own account.
          </p>
        </div>
        {/* A plain anchor, not next/link: this is a route handler that returns a
            file, and routing it through the client router would fetch it rather
            than download it. */}
        {rows.length > 0 ? (
          <a
            href="/api/statement"
            className="ml-auto inline-flex items-center gap-2 rounded-full bg-surf-2 px-5 py-[11px] text-[13.5px] font-medium text-fg shadow-[inset_0_0_0_1px_var(--color-bd-2)] transition-colors hover:bg-surf-3"
          >
            Download CSV
          </a>
        ) : null}
      </div>

      <Card className="mt-7">
        <CardHeader title="Statement" aside={rows.length > 0 ? `${rows.length} entries` : undefined} />

        {rows.length === 0 ? (
          <p className="max-w-[58ch] text-[13.5px] leading-[1.65] text-fg-2">
            Nothing yet. Completed tasks and withdrawals both land here, and neither is ever
            removed — a statement that quietly drops a reversal is not a statement.
          </p>
        ) : (
          <TableScroll>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Description</Th>
                <Th>Status</Th>
                <Th>Reference</Th>
                <Th>Amount</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.kind}-${row.reference ?? row.date.toISOString()}`}>
                  <Td className="mn">{row.date.toISOString().slice(0, 10)}</Td>
                  <Td className="text-fg">{row.description}</Td>
                  <Td className={STATUS_TONE[row.status] ?? "text-fg-3"}>
                    {row.status.toLowerCase().replace(/_/g, " ")}
                  </Td>
                  <Td className="mn text-[11.5px] text-fg-4">{row.reference ?? "—"}</Td>
                  <Td className="mn font-semibold text-fg">${row.amount}</Td>
                </tr>
              ))}
            </tbody>
          </TableScroll>
        )}
      </Card>
    </main>
  );
}
