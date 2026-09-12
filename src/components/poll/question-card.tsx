import { Card, CardHeader } from "@/components/ui/card";
import { QuestionForm } from "@/components/poll/question-form";
import { CallBoard } from "@/components/poll/call-board";
import { answerOf, tallyFor, todaysQuestion } from "@/lib/poll/board";
import { recordOf, yesterdayFor } from "@/lib/poll/calls";

/**
 * The one task here that is not a game — built with a game's rules.
 *
 * It has the shape the arcade has: one round a day, the same round for
 * everybody, a move that the server scores from rows rather than from anything
 * the browser says, and a board. What is different is where the truth comes
 * from. A game is checked by replaying it; this is checked against the crowd,
 * which nobody can fake either.
 *
 * The survey half stays honest because the two moves are in a fixed order: your
 * own answer is asked and stored before the game is mentioned, so the thing we
 * actually need — what people think — is never what people are playing for.
 */
export async function QuestionCard({ userId }: { userId: string }) {
  const { day, question } = todaysQuestion();

  // The tally is read only for someone who has already answered. Sending it to
  // a member who has not would put the results in the page source, one
  // view-source away from the thing this whole card depends on hiding.
  const answer = await answerOf(userId, day);
  const [tally, record, yesterday] = await Promise.all([
    answer ? tallyFor(day, question) : Promise.resolve(null),
    recordOf(userId),
    yesterdayFor(userId),
  ]);

  return (
    <Card>
      <CardHeader
        title="Today's question"
        aside={
          <span className="mn">
            {record.settled > 0 ? `${record.right}/${record.settled} called right` : day}
          </span>
        }
      />

      {/* Yesterday first: it is the round that ended, and the answer to the one
          question somebody left with. */}
      {yesterday?.called ? (
        <p
          className={
            yesterday.called.correct
              ? "-mt-2 mb-4 rounded-soft bg-[rgba(107,203,165,.08)] px-[14px] py-3 text-[12.5px] leading-[1.6] text-ac-2 shadow-[inset_0_0_0_1px_rgba(107,203,165,.2)]"
              : "-mt-2 mb-4 rounded-soft px-[14px] py-3 text-[12.5px] leading-[1.6] text-fg-3 shadow-[inset_0_0_0_1px_var(--color-bd)]"
          }
        >
          {yesterday.called.correct ? "You read it right. " : "You missed it. "}
          Yesterday {yesterday.won.length > 1 ? "it was a tie between " : "most people said "}
          <span className="text-fg">{yesterday.won.join(" and ")}</span> ({Math.round(yesterday.share * 100)}
          %). You called <span className="text-fg">{yesterday.called.label}</span>.
        </p>
      ) : null}

      <p className="-mt-2 max-w-[62ch] text-[13px] leading-[1.6] text-fg-3">
        One a day, the same one for everybody. Answer it, then call which answer the crowd will
        pick — that call is scored at midnight UTC, when the day closes. It pays nothing; nothing
        here does yet.
      </p>

      <p className="mt-5 max-w-[46ch] text-[19px] font-semibold leading-[1.3] tracking-[-0.025em]">
        {question.ask}
      </p>

      <QuestionForm
        question={question}
        answered={answer?.optionId ?? null}
        called={answer?.predicted ?? null}
        tally={tally}
      />

      <CallBoard userId={userId} />
    </Card>
  );
}
