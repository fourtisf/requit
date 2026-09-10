import { prisma } from "@/lib/prisma";

export type StatementRow = {
  date: Date;
  kind: "reward" | "withdrawal";
  description: string;
  status: string;
  /** Positive for a reward, negative for a withdrawal. */
  amount: string;
  reference: string | null;
};

/**
 * A member's own auditable record.
 *
 * The site's argument to the public is "do not take our word for it, check the
 * chain". This is the same argument turned inward: a member can export what we
 * think they earned and check it against what they were paid, without asking us.
 *
 * Reversed rewards are included rather than dropped. A statement that quietly
 * omits a reversal is exactly the behaviour this product exists to be the
 * opposite of.
 */
export async function statement(userId: string, since?: Date): Promise<StatementRow[]> {
  const range = since ? { gte: since } : undefined;

  const [rewards, withdrawals] = await Promise.all([
    prisma.reward.findMany({
      where: { userId, createdAt: range },
      select: {
        createdAt: true,
        amount: true,
        status: true,
        network: true,
        tierLabel: true,
        networkTxnId: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.withdrawal.findMany({
      where: { userId, requestedAt: range },
      select: {
        requestedAt: true,
        amount: true,
        status: true,
        chain: true,
        txHash: true,
      },
      orderBy: { requestedAt: "desc" },
    }),
  ]);

  const rows: StatementRow[] = [
    ...rewards.map((reward) => ({
      date: reward.createdAt,
      kind: "reward" as const,
      description: reward.tierLabel
        ? `${reward.network} · ${reward.tierLabel}`
        : String(reward.network),
      status: reward.status,
      amount: reward.amount.toString(),
      reference: reward.networkTxnId,
    })),
    ...withdrawals.map((withdrawal) => ({
      date: withdrawal.requestedAt,
      kind: "withdrawal" as const,
      description: `Withdrawal · ${withdrawal.chain}`,
      status: withdrawal.status,
      amount: `-${withdrawal.amount.toString()}`,
      reference: withdrawal.txHash,
    })),
  ];

  return rows.sort((a, b) => b.date.getTime() - a.date.getTime());
}

/** RFC 4180. Excel and Sheets both open this without a dialog. */
export function toCsv(rows: StatementRow[]): string {
  const header = ["date", "type", "description", "status", "amount", "reference"];
  const lines = rows.map((row) =>
    [
      row.date.toISOString(),
      row.kind,
      row.description,
      row.status,
      row.amount,
      row.reference ?? "",
    ]
      .map(csvCell)
      .join(","),
  );

  return [header.join(","), ...lines].join("\r\n");
}

function csvCell(value: string): string {
  // A leading =, +, - or @ makes a spreadsheet treat the cell as a formula.
  // Network transaction ids and tier labels are third-party strings, so they get
  // the same treatment as anything else we did not write.
  const guarded = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}
