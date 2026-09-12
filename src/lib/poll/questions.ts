/**
 * The question bank.
 *
 * A survey is the archetypal task on every site in this category, so this is
 * the one thing that is not a game and is still recognisably *the work*: read a
 * question, answer it, done in under a minute. The difference from Phase 1 is
 * stated on the card — we are the ones asking, and nobody is paid for it.
 *
 * Every question here is one whose answer changes something we do. An offer
 * network's publisher review asks what our audience is: which countries, which
 * devices, whether they have done this before, what they will not do. Today the
 * only honest answer is "we do not know", and the questions below are how that
 * stops being true. A question nobody acts on is a form, not a task, and people
 * can tell the difference faster than you can write one.
 *
 * Two rules for adding one:
 *
 *   1. Ids are permanent. An answer stores the question id and the option id,
 *      so renaming either turns old rows into something that says it answered a
 *      question that no longer exists.
 *   2. No free text. It cannot be counted, cannot be shown back as a result,
 *      and is a place for someone to paste an address they should not paste.
 */

export type PollOption = { id: string; label: string };

export type PollQuestion = {
  id: string;
  /** The question itself. Kept to one line — this is read on a phone. */
  ask: string;
  /** What we do with the answer. Shown under the result, never hidden. */
  use: string;
  options: PollOption[];
};

export const QUESTIONS: PollQuestion[] = [
  {
    id: "device",
    ask: "What are you reading this on?",
    use: "Decides what we build for first. A task list that assumes a desktop is useless to a phone.",
    options: [
      { id: "phone", label: "A phone" },
      { id: "laptop", label: "A laptop or desktop" },
      { id: "tablet", label: "A tablet" },
    ],
  },
  {
    id: "done-before",
    ask: "Have you used a site like this before — offers, surveys, cashback?",
    use: "Networks ask whether an audience is new to this. It also decides how much our task pages have to explain.",
    options: [
      { id: "often", label: "Yes, regularly" },
      { id: "once", label: "Once or twice" },
      { id: "never", label: "Never" },
    ],
  },
  {
    id: "worst-part",
    ask: "What went wrong last time you tried one?",
    use: "The complaint we hear most becomes the thing we design against first.",
    options: [
      { id: "not-paid", label: "It did not pay" },
      { id: "hidden-cost", label: "It wanted money first" },
      { id: "too-long", label: "It took far longer than it said" },
      { id: "no-support", label: "Nobody answered when it broke" },
    ],
  },
  {
    id: "session-length",
    ask: "How long is a sitting for you, realistically?",
    use: "Tasks get sorted by how long they take. This says which ones go at the top.",
    options: [
      { id: "five", label: "Five minutes" },
      { id: "twenty", label: "About twenty" },
      { id: "hour", label: "An hour or more" },
    ],
  },
  {
    id: "payout-floor",
    ask: "What is the smallest payout worth withdrawing to you?",
    use: "Our minimum is $10 because the chain fee eats anything smaller. If most people say less, we look at cheaper rails.",
    options: [
      { id: "one", label: "$1" },
      { id: "five", label: "$5" },
      { id: "ten", label: "$10" },
      { id: "more", label: "More than $10" },
    ],
  },
  {
    id: "payout-rail",
    ask: "How would you rather be paid?",
    use: "We pay in USDC on Solana and ETH today. What people actually want decides what gets added next.",
    options: [
      { id: "usdc", label: "USDC" },
      { id: "eth", label: "ETH" },
      { id: "local", label: "My local bank or e-wallet" },
      { id: "unsure", label: "I do not know yet" },
    ],
  },
  {
    id: "wallet",
    ask: "Do you already have a crypto wallet?",
    use: "If most people do not, the wallet step has to teach rather than assume — and it is the step that stops a payout.",
    options: [
      { id: "yes", label: "Yes, I use one" },
      { id: "made-unused", label: "I made one but barely use it" },
      { id: "no", label: "No" },
    ],
  },
  {
    id: "task-kind",
    ask: "Which kind of task would you actually finish?",
    use: "We choose which networks to apply to by what our members will finish, not by what pays most on paper.",
    options: [
      { id: "survey", label: "Surveys" },
      { id: "app", label: "Installing and trying an app" },
      { id: "signup", label: "Signing up to a free service" },
      { id: "game", label: "Playing a game to a level" },
    ],
  },
  {
    id: "refuse",
    ask: "Which would you refuse outright?",
    use: "Anything most people refuse gets filtered off the list rather than shown and skipped.",
    options: [
      { id: "purchase", label: "Anything I have to pay for" },
      { id: "phone-number", label: "Anything wanting my phone number" },
      { id: "install", label: "Installing an app" },
      { id: "long", label: "Anything over an hour" },
    ],
  },
  {
    id: "trust",
    ask: "What would make you believe a site like this actually pays?",
    use: "Whatever wins gets built next. The proof page exists because of this question.",
    options: [
      { id: "proof", label: "Public payout records" },
      { id: "small-first", label: "Getting paid something small, fast" },
      { id: "people", label: "Someone I know being paid" },
      { id: "company", label: "A named company behind it" },
    ],
  },
  {
    id: "speed-vs-size",
    ask: "Same day for $2, or two weeks for $5?",
    use: "Tells us whether to chase faster networks or higher-paying ones. We cannot have both at once.",
    options: [
      { id: "fast", label: "Same day, $2" },
      { id: "big", label: "Two weeks, $5" },
    ],
  },
  {
    id: "language",
    ask: "Would you rather read this site in another language?",
    use: "Decides whether translation is worth doing before tasks go live, and which one.",
    options: [
      { id: "english", label: "English is fine" },
      { id: "indonesian", label: "Bahasa Indonesia" },
      { id: "other", label: "Another language" },
    ],
  },
  {
    id: "found-us",
    ask: "How did you get here?",
    use: "The only measurement we have of where members come from — we run no tracking pixels.",
    options: [
      { id: "search", label: "A search engine" },
      { id: "social", label: "X, Telegram or similar" },
      { id: "friend", label: "Someone sent me the link" },
      { id: "other", label: "Some other way" },
    ],
  },
  {
    id: "games",
    ask: "Have you played any of the games here?",
    use: "They cost us nothing to keep and a lot to add to. This decides whether more get built.",
    options: [
      { id: "many", label: "Several of them" },
      { id: "one", label: "One" },
      { id: "none", label: "Not yet" },
    ],
  },
  {
    id: "return",
    ask: "What would bring you back tomorrow, honestly?",
    use: "Answers the question every feature on this site is really competing for.",
    options: [
      { id: "money", label: "Tasks that pay" },
      { id: "board", label: "Beating the daily board" },
      { id: "news", label: "News that tasks are live" },
      { id: "nothing", label: "Nothing yet" },
    ],
  },
  {
    id: "hold",
    ask: "A payout is held for review for 24 hours. Acceptable?",
    use: "Fraud review is what keeps a payout pool from being drained. This says how much patience it can spend.",
    options: [
      { id: "fine", label: "Fine, if I am told" },
      { id: "annoying", label: "Annoying but I would wait" },
      { id: "no", label: "No — I would not come back" },
    ],
  },
];

/** Ids are stored on rows, so a duplicate would merge two questions' answers. */
export function questionById(id: string): PollQuestion | null {
  return QUESTIONS.find((question) => question.id === id) ?? null;
}

export function optionById(question: PollQuestion, id: string): PollOption | null {
  return question.options.find((option) => option.id === id) ?? null;
}
