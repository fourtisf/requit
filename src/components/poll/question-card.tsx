import { Card, CardHeader } from "@/components/ui/card";
import { QuestionForm } from "@/components/poll/question-form";
import { answerOf, answeredDays, tallyFor, todaysQuestion } from "@/lib/poll/board";

/**
 * The one task here that is not a game and not paperwork about yourself.
 *
 * It exists because "there is nothing to do yet" was the honest state of this
 * page and a bad one to leave alone — and because the thing Phase 1 sells is a
 * survey. This is the same shape, asked by us, paying nothing, with the two
 * halves an offer wall leaves out: what the answer is used for, and what
 * everybody else said.
 *
 * It is not a check-in. lib/readiness.ts refuses streaks and daily rewards on
 * the grounds that paying someone for opening a page is activity standing in
 * for a product, and that still holds. The difference is that an answer here
 * produces something that did not exist before: one row of the only audience
 * data we have, and one number on a result everybody can see.
 */
export async function QuestionCard({ userId }: { userId: string }) {
  const { day, question } = todaysQuestion();

  // The tally is read only for someone who has already answered. Sending it to
  // a member who has not would put the results in the page source, one view-
  // source away from the thing the whole mechanic depends on hiding.
  const answer = await answerOf(userId, day);
  const [tally, answered] = await Promise.all([
    answer ? tallyFor(day, question) : Promise.resolve(null),
    answeredDays(userId),
  ]);

  return (
    <Card>
      <CardHeader
        title="Today's question"
        aside={
          <span className="mn">
            {answered > 0 ? `${answered} answered` : day}
          </span>
        }
      />

      <p className="-mt-2 max-w-[62ch] text-[13px] leading-[1.6] text-fg-3">
        One a day, the same one for everybody, and it takes about a minute. It does not pay —
        nothing here does yet. What it changes is written under the result.
      </p>

      <p className="mt-5 max-w-[46ch] text-[19px] font-semibold leading-[1.3] tracking-[-0.025em]">
        {question.ask}
      </p>

      <QuestionForm question={question} answered={answer?.optionId ?? null} tally={tally} />
    </Card>
  );
}
