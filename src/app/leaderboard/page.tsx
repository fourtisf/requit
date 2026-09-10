import { requireUser } from "@/lib/session";
import { AppNav } from "@/components/app-nav";
import { Card, CardHeader } from "@/components/ui/card";
import { TableScroll, Th, Td } from "@/components/ui/table";
import { currentWeek, leaderboard } from "@/lib/leaderboard";

export const metadata = { title: "Leaderboard" };
export const revalidate = 60;

export default async function LeaderboardPage() {
  await requireUser();

  const week = currentWeek();
  const rows = await leaderboard(week, 50);

  return (
    <main className="shell py-10">
      <AppNav current="/leaderboard" />

      <h1 className="text-[27px] font-semibold tracking-[-0.042em]">Leaderboard</h1>
      <p className="mt-2.5 max-w-[62ch] text-[13.5px] leading-[1.6] text-fg-2">
        Confirmed rewards this week, {week.start.toISOString().slice(0, 10)} to{" "}
        {week.end.toISOString().slice(0, 10)} UTC. Only confirmed work counts — anything still
        pending can reverse, and a board that reordered itself on a chargeback would be worthless.
      </p>

      <Card className="mt-7 max-w-[820px]">
        <CardHeader title="Top 50" aside={rows.length > 0 ? `${rows.length} ranked` : undefined} />

        {rows.length === 0 ? (
          <p className="max-w-[58ch] text-[13.5px] leading-[1.65] text-fg-2">
            No confirmed rewards this week, so there is nothing to rank. This fills in once tasks
            are live — it is computed from real completions, never seeded.
          </p>
        ) : (
          <TableScroll>
            <thead>
              <tr>
                <Th>#</Th>
                <Th>Member</Th>
                <Th>Country</Th>
                <Th>Tasks</Th>
                <Th>Earned</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.rank}>
                  <Td className="mn text-fg-4">{row.rank}</Td>
                  <Td className={row.handle ? "mn text-fg" : "text-fg-4"}>
                    {row.handle ?? "anonymous"}
                  </Td>
                  <Td className="mn">{row.countryCode}</Td>
                  <Td className="mn">{row.completions}</Td>
                  <Td className="mn font-semibold text-fg">${row.earned}</Td>
                </tr>
              ))}
            </tbody>
          </TableScroll>
        )}
      </Card>
    </main>
  );
}
