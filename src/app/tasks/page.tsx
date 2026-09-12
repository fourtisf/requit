import Link from "next/link";
import type { Route } from "next";
import { requireUser } from "@/lib/session";
import { AppNav } from "@/components/app-nav";
import { Card, CardHeader } from "@/components/ui/card";
import { Chip, ChipRow } from "@/components/ui/chip";
import { UNKNOWN_COUNTRY } from "@/lib/country";
import {
  MIN_SAMPLES,
  offersFor,
  parseSort,
  splitLight,
  type OfferSort,
  type OfferView,
  type TierView,
} from "@/lib/offers";
import { BRAND } from "@/lib/brand";
import { NotifyMe } from "@/components/notify-me";
import { isWaiting, waitingIn } from "@/lib/interest";
import { TaskKindsGrid } from "@/components/task-kinds-grid";
import { ReadinessCard } from "@/components/readiness-card";
import { QuestionCard } from "@/components/poll/question-card";
import { HANDOFF_DETAIL, type HandoffFailure } from "@/lib/networks/handoff";

export const metadata = { title: "Tasks" };
export const dynamic = "force-dynamic";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; all?: string; unavailable?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const sort = parseSort(params.sort);
  const showEverything = params.all === "1";
  const unavailable = params.unavailable;
  const unavailableDetail =
    unavailable && unavailable in HANDOFF_DETAIL
      ? HANDOFF_DETAIL[unavailable as HandoffFailure]
      : null;

  const all = await offersFor({ countryCode: user.countryCode, sort });
  const { light, heavy } = splitLight(all);
  const offers = showEverything ? all : light;

  // Listed and startable are different numbers, and the page had only the
  // first. An offer whose network has not confirmed how it credits us cannot be
  // opened by anybody — see lib/networks/handoff.ts — so a header that counts it
  // as "available" is telling a member something the buttons then contradict.
  const startable = all.filter((offer) => offer.canStart).length;
  const stuck = all.length > 0 && startable === 0;

  // Keyed on the whole catalogue, not the filtered view. "Nothing live in your
  // country" and "everything live in your country is heavy" are different
  // facts, and offering to notify someone about the first when the second is
  // true would be a promise we have already kept.
  const empty = all.length === 0 && user.countryCode !== UNKNOWN_COUNTRY;
  const [alreadyWaiting, waiting] = empty
    ? await Promise.all([isWaiting(user.id, user.countryCode), waitingIn(user.countryCode)])
    : [false, 0];

  return (
    <main className="shell py-10">
      <AppNav current="/tasks" />

      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="text-[27px] font-semibold tracking-[-0.042em]">Tasks</h1>
        {startable > 0 ? (
          <span className="mn text-[12.5px] text-fg-4">
            {startable} available in {user.countryCode}
          </span>
        ) : all.length > 0 ? (
          <span className="mn text-[12.5px] text-fg-4">
            {all.length} listed · none can be started yet
          </span>
        ) : null}
      </div>

      <p className="mt-2.5 max-w-[64ch] text-[13.5px] leading-[1.6] text-fg-2">
        Everything you need to decide is here before you start: the reward, the share of people who
        reach each tier, and any purchase required.
      </p>

      {/* Sent back here by the start route. Saying which task and why beats a
          silent bounce, which reads as a broken button. */}
      {unavailableDetail ? (
        <p className="mt-4 rounded-card px-[18px] py-3 text-[12.5px] leading-[1.6] text-amber surface-inset">
          {unavailableDetail} Nothing was started, and nothing was counted against you.
        </p>
      ) : null}

      {/* One statement at the top beats discovering it button by button. The
          per-card explanation stays: somebody who lands mid-page needs it too. */}
      {stuck ? (
        <p className="mt-4 max-w-[72ch] rounded-card px-[18px] py-3 text-[12.5px] leading-[1.6] text-amber surface-inset">
          None of these can be started yet. They are in the feed for {user.countryCode}, but no
          network has confirmed how a click carries your account — so a task opened now would be
          work done that nobody could credit to you. The buttons stay shut until that link is
          proven, and we would rather shut them than let you find out afterwards.
        </p>
      ) : null}

      {offers.length > 1 ? <SortTabs current={sort} all={showEverything} /> : null}

      {/* Never a silent filter. Hiding inventory from someone trying to earn
          money is defensible right until they find out it happened, so the
          count and the way back are on screen whenever anything is held back. */}
      {!showEverything && heavy.length > 0 ? (
        <p className="mt-3 text-[12.5px] leading-[1.6] text-fg-3">
          {heavy.length} {heavy.length === 1 ? "task is" : "tasks are"} hidden — long grinds few
          people finish, and ones that need a purchase first.{" "}
          <Link
            href={sort === "reward" ? "/tasks?sort=reward&all=1" : "/tasks?all=1"}
            className="text-ac-2 underline underline-offset-4"
          >
            Show them anyway
          </Link>
        </p>
      ) : null}

      {showEverything ? (
        <p className="mt-3 text-[12.5px] leading-[1.6] text-fg-3">
          Showing everything, including tasks few people finish and tasks that need a purchase.{" "}
          <Link
            href={sort === "reward" ? "/tasks?sort=reward" : "/tasks"}
            className="text-ac-2 underline underline-offset-4"
          >
            Back to light tasks
          </Link>
        </p>
      ) : null}

      {user.countryCode === UNKNOWN_COUNTRY ? (
        <Card className="mt-7 max-w-[62ch]">
          <CardHeader title="We do not know your country" />
          <p className="text-[13.5px] leading-[1.65] text-fg-2">
            Offers are matched by country, and we could not determine yours when you signed up.
            Set it in settings and this page fills in.
          </p>
        </Card>
      ) : all.length === 0 ? (
        <Card className="mt-7 max-w-[62ch]">
          <CardHeader title="Nothing live yet" />
          <p className="text-[13.5px] leading-[1.65] text-fg-2">
            {BRAND.name} has no approved offer inventory for {user.countryCode} right now. This is
            not a filter you can widen — when a network approves us and sends offers for your
            country, they appear here.
          </p>
          <NotifyMe
            countryCode={user.countryCode}
            alreadyWaiting={alreadyWaiting}
            waiting={waiting}
          />
        </Card>
      ) : offers.length === 0 ? (
        <Card className="mt-7 max-w-[62ch]">
          <CardHeader title="Nothing light right now" />
          <p className="text-[13.5px] leading-[1.65] text-fg-2">
            There {all.length === 1 ? "is one task" : `are ${all.length} tasks`} live in{" "}
            {user.countryCode}, but every one of them is either a long grind that few people finish
            or needs a purchase before it pays. Nothing is being kept from you — they are one click
            away.
          </p>
          <Link
            href={sort === "reward" ? "/tasks?sort=reward&all=1" : "/tasks?all=1"}
            className="mt-4 inline-block text-[13.5px] text-ac-2 underline underline-offset-4"
          >
            Show them anyway
          </Link>
        </Card>
      ) : (
        <div className="mt-7 grid gap-3 lg:grid-cols-2">
          {offers.map((offer) => (
            <OfferCard key={offer.id} offer={offer} />
          ))}
        </div>
      )}

      {/* Shown whenever the list is empty — including the unknown-country case,
          where someone is one settings change away from a full page and has even
          less idea what they are waiting for. An empty list that also explains
          nothing is the version of this page people leave and do not return to. */}
      {/* The page called Tasks, with no tasks on it, is where somebody is asking
          "so what can I do". Answering with a description of future work and
          nothing to act on is how a member decides there is nothing here. */}
      {/* The question goes first: it is the only thing on this page that is a
          task rather than a preparation for one, and it is different tomorrow.
          It disappears when real inventory arrives — paid work outranks our own
          survey — and it stays on the dashboard, where it also lives. */}
      {startable === 0 ? (
        <div className="mt-8 flex max-w-[68ch] flex-col gap-3">
          <QuestionCard userId={user.id} />
          <ReadinessCard userId={user.id} />
        </div>
      ) : null}

      {all.length === 0 ? (
        <section className="mt-10">
          <h2 className="text-[17px] font-semibold tracking-[-0.03em]">
            What a task will ask you to do
          </h2>
          <p className="mt-2 max-w-[64ch] text-[13.5px] leading-[1.6] text-fg-2">
            Six kinds, set by the advertiser. Which ones reach you depends on your country and your
            device. The reward and the odds of reaching each tier are on the task itself — they are
            the one thing we will not describe in advance, because they change week to week.
          </p>
          <div className="mt-5">
            <TaskKindsGrid compact />
          </div>
        </section>
      ) : null}
    </main>
  );
}

/**
 * The order of the list is a claim about the offers in it, so the page says
 * which claim it is making instead of quietly reordering itself.
 */
function SortTabs({ current, all }: { current: OfferSort; all: boolean }) {
  const tabs: { value: OfferSort; label: string; href: Route }[] = [
    { value: "ease", label: "Easiest first", href: all ? "/tasks?all=1" : "/tasks" },
    {
      value: "reward",
      label: "Highest paying",
      href: all ? "/tasks?sort=reward&all=1" : "/tasks?sort=reward",
    },
  ];

  return (
    <div className="mt-5 flex flex-wrap items-center gap-1.5">
      {tabs.map((tab) => (
        <Link
          key={tab.value}
          href={tab.href}
          aria-current={tab.value === current ? "page" : undefined}
          className={
            tab.value === current
              ? "rounded-full bg-surf-2 px-[13px] py-[6px] text-[12.5px] font-medium text-fg shadow-[inset_0_0_0_1px_var(--color-bd-2)]"
              : "rounded-full px-[13px] py-[6px] text-[12.5px] text-fg-3 transition-colors hover:bg-surf-2 hover:text-fg"
          }
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}

/**
 * Stated as a fact about people, not as a grade. "Easy" is a promise about how
 * someone will find it; "most people finish it" is a measurement, and the
 * measurement is the part we can stand behind.
 */
const EASE_LABEL = {
  easy: "most people finish it",
  moderate: "some people finish it",
  hard: "few people finish it",
} as const;

function OfferCard({ offer }: { offer: OfferView }) {
  return (
    <Card>
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <h2 className="text-[17px] font-semibold tracking-[-0.025em]">{offer.name}</h2>
          {offer.description ? (
            <p className="mt-1.5 text-[13px] font-light leading-[1.6] text-fg-2">
              {offer.description}
            </p>
          ) : null}
        </div>
        <p className="mn text-[19px] font-semibold tracking-[-0.03em] text-ac-2">
          ${offer.userPays}
        </p>
      </div>

      <ChipRow>
        <Chip>{offer.category.toLowerCase()}</Chip>
        {offer.ease ? (
          <Chip tone={offer.ease === "easy" ? "accent" : offer.ease === "hard" ? "amber" : "neutral"}>
            {EASE_LABEL[offer.ease]}
          </Chip>
        ) : null}
        {offer.devices.map((device) => (
          <Chip key={device}>{device}</Chip>
        ))}
        {offer.deadlineDays ? <Chip>{offer.deadlineDays}-day deadline</Chip> : null}
        {offer.requiresPurchase ? (
          <Chip tone="amber">
            purchase required{offer.purchaseAmount ? ` · $${offer.purchaseAmount}` : ""}
          </Chip>
        ) : null}
      </ChipRow>

      {offer.tiers.length > 0 ? (
        <ol className="mt-4">
          {offer.tiers.map((tier) => (
            <Tier key={tier.id} tier={tier} />
          ))}
        </ol>
      ) : null}

      {/*
        A plain link, not the client router: it leaves the site. The start is
        counted server-side on the way out, because that count is the
        denominator of every completion rate shown above.

        Unavailable is rendered as unavailable. The click would bounce straight
        back, and a button that does nothing teaches people the site is broken.
      */}
      {offer.canStart ? (
        <>
          <a
            href={`/api/offers/${offer.id}/start`}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-5 py-[11px] text-[13.5px] font-semibold text-bg shadow-[0_0_0_1px_rgba(255,255,255,.9)] transition-transform hover:-translate-y-px"
          >
            Open this task
          </a>

          <p className="mt-3 text-[11.5px] leading-[1.5] text-fg-4">
            Open it from this button. Installing or signing up another way leaves the network with
            no way to credit you, and nobody can recover it afterwards.
          </p>
        </>
      ) : (
        <>
          <span className="mt-4 inline-flex items-center gap-2 rounded-full px-5 py-[11px] text-[13.5px] font-semibold text-fg-4 shadow-[inset_0_0_0_1px_var(--color-bd-2)]">
            Not open yet
          </span>

          <p className="mt-3 max-w-[52ch] text-[11.5px] leading-[1.5] text-fg-4">
            We cannot yet send you to this one in a way the network would credit back to you.
            Starting it now would mean doing the work for nothing, so the button stays shut until
            that link is proven.
          </p>
        </>
      )}
    </Card>
  );
}

function Tier({ tier }: { tier: TierView }) {
  const rate = tier.completionRate;

  return (
    <li
      className={
        tier.unreachable
          ? "mt-1.5 flex items-center gap-2.5 rounded-[9px] bg-surf px-[13px] py-2.5 text-[12.5px] opacity-[.42] shadow-[inset_0_0_0_1px_var(--color-bd)] first:mt-0"
          : "mt-1.5 flex items-center gap-2.5 rounded-[9px] bg-surf px-[13px] py-2.5 text-[12.5px] shadow-[inset_0_0_0_1px_var(--color-bd)] first:mt-0"
      }
    >
      <span className="flex-1 text-fg-3">{tier.label}</span>
      <span className="mn w-[86px] text-right text-[11.5px] text-fg-4">
        {rate === null
          ? `${tier.starts}/${MIN_SAMPLES} data`
          : `${Math.round(rate * 100)}% reach it`}
      </span>
      <span
        className={
          tier.unreachable
            ? "mn w-[62px] text-right font-semibold text-fg-3 line-through"
            : "mn w-[62px] text-right font-semibold"
        }
      >
        ${tier.userPays}
      </span>
    </li>
  );
}
