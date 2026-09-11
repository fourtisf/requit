import { requireUser } from "@/lib/session";
import { AppNav } from "@/components/app-nav";
import { Card, CardHeader } from "@/components/ui/card";
import { Chip, ChipRow } from "@/components/ui/chip";
import { UNKNOWN_COUNTRY } from "@/lib/country";
import {
  MIN_SAMPLES,
  offersFor,
  type OfferView,
  type TierView,
} from "@/lib/offers";
import { BRAND } from "@/lib/brand";
import { NotifyMe } from "@/components/notify-me";
import { isWaiting, waitingIn } from "@/lib/interest";
import { TaskKindsGrid } from "@/components/task-kinds-grid";

export const metadata = { title: "Tasks" };
export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const user = await requireUser();
  const offers = await offersFor({ countryCode: user.countryCode });

  // Only read when the page is about to be empty — the whole point of the
  // block below is that it has somewhere to send people.
  const empty = offers.length === 0 && user.countryCode !== UNKNOWN_COUNTRY;
  const [alreadyWaiting, waiting] = empty
    ? await Promise.all([
        isWaiting(user.id, user.countryCode),
        waitingIn(user.countryCode),
      ])
    : [false, 0];

  return (
    <main className="shell py-10">
      <AppNav current="/tasks" />

      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="text-[27px] font-semibold tracking-[-0.042em]">Tasks</h1>
        {offers.length > 0 ? (
          <span className="mn text-[12.5px] text-fg-4">
            {offers.length} available in {user.countryCode}
          </span>
        ) : null}
      </div>

      <p className="mt-2.5 max-w-[64ch] text-[13.5px] leading-[1.6] text-fg-2">
        Everything you need to decide is here before you start: the reward, the
        share of people who reach each tier, and any purchase required.
      </p>

      {user.countryCode === UNKNOWN_COUNTRY ? (
        <Card className="mt-7 max-w-[62ch]">
          <CardHeader title="We do not know your country" />
          <p className="text-[13.5px] leading-[1.65] text-fg-2">
            Offers are matched by country, and we could not determine yours when
            you signed up. Set it in settings and this page fills in.
          </p>
        </Card>
      ) : offers.length === 0 ? (
        <Card className="mt-7 max-w-[62ch]">
          <CardHeader title="Nothing live yet" />
          <p className="text-[13.5px] leading-[1.65] text-fg-2">
            {BRAND.name} has no approved offer inventory for {user.countryCode}{" "}
            right now. This is not a filter you can widen — when a network
            approves us and sends offers for your country, they appear here.
          </p>
          <NotifyMe
            countryCode={user.countryCode}
            alreadyWaiting={alreadyWaiting}
            waiting={waiting}
          />
        </Card>
      ) : (
        <div className="mt-7 grid gap-3 lg:grid-cols-2">
          {offers.map((offer) => (
            <OfferCard key={offer.id} offer={offer} />
          ))}
        </div>
      )}

      {/* Shown whenever the list is empty — including the unknown-country case,
          where someone is one settings change away from a full page and has
          even less idea what they are waiting for. An empty list that also
          explains nothing is the version of this page people leave and do not
          come back to. */}
      {offers.length === 0 ? (
        <section className="mt-10">
          <h2 className="text-[17px] font-semibold tracking-[-0.03em]">
            What a task will ask you to do
          </h2>
          <p className="mt-2 max-w-[64ch] text-[13.5px] leading-[1.6] text-fg-2">
            Six kinds, set by the advertiser. Which ones reach you depends on
            your country and your device. The reward and the odds of reaching
            each tier are on the task itself — they are the one thing we will
            not describe in advance, because they change week to week.
          </p>
          <div className="mt-5">
            <TaskKindsGrid compact />
          </div>
        </section>
      ) : null}
    </main>
  );
}

function OfferCard({ offer }: { offer: OfferView }) {
  return (
    <Card>
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <h2 className="text-[17px] font-semibold tracking-[-0.025em]">
            {offer.name}
          </h2>
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
        {offer.devices.map((device) => (
          <Chip key={device}>{device}</Chip>
        ))}
        {offer.deadlineDays ? (
          <Chip>{offer.deadlineDays}-day deadline</Chip>
        ) : null}
        {offer.requiresPurchase ? (
          <Chip tone="amber">
            purchase required
            {offer.purchaseAmount ? ` · $${offer.purchaseAmount}` : ""}
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
      */}
      <a
        href={`/api/offers/${offer.id}/start`}
        className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-5 py-[11px] text-[13.5px] font-semibold text-bg shadow-[0_0_0_1px_rgba(255,255,255,.9)] transition-transform hover:-translate-y-px"
      >
        Open this task
      </a>

      <p className="mt-3 text-[11.5px] leading-[1.5] text-fg-4">
        Open it from this button. Installing or signing up another way leaves
        the network with no way to credit you, and nobody can recover it
        afterwards.
      </p>
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
