import { auth } from "@/auth";
import { statement, toCsv } from "@/lib/statement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The member's own statement as CSV.
 *
 * Uses `auth()` rather than `requireUser()`: this is an API route, so an
 * unauthenticated caller gets a 401, not a redirect to a sign-in page it cannot
 * render. A suspended member can still download their own record — suspension
 * pauses earning and withdrawal, it does not withhold their history from them.
 */
export async function GET(): Promise<Response> {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const rows = await statement(session.user.id);
  const filename = `statement-${session.user.handle}-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(toCsv(rows), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
