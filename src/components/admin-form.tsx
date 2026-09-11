"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { EMPTY_FORM_STATE, type FormState } from "@/app/admin/form-state";

type Action = (prev: FormState, form: FormData) => Promise<FormState>;

/**
 * One operator action: a mandatory reason, a button, and the outcome in place.
 *
 * The reason box is not optional in the markup either — `required` catches the
 * empty case in the browser, and operations.ts refuses a short one regardless,
 * because the browser check is a convenience and the server check is the rule.
 */
export function AdminForm({
  action,
  hidden,
  label,
  verb,
  destructive,
  children,
}: {
  action: Action;
  hidden: Record<string, string>;
  label: string;
  verb: string;
  destructive?: boolean;
  children?: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, EMPTY_FORM_STATE);

  return (
    <form action={formAction} className="mt-4">
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}

      <label className="block text-[12.5px] text-fg-3">{label}</label>
      {children}
      <textarea
        name="reason"
        required
        minLength={8}
        rows={2}
        placeholder="Why — the member is shown this."
        className="mt-2 w-full resize-y rounded-soft bg-surf px-3 py-2 text-[13px] text-fg shadow-[inset_0_0_0_1px_var(--color-bd)] outline-none placeholder:text-fg-4 focus:shadow-[inset_0_0_0_1px_var(--color-bd-2)]"
      />

      <div className="mt-2.5 flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          variant={destructive ? "secondary" : "primary"}
          disabled={pending}
          // cn() is a plain join, not a tailwind-merge, so the variant's own
          // text colour would otherwise win on stylesheet order.
          className={
            destructive
              ? "text-amber! shadow-[inset_0_0_0_1px_rgba(232,198,139,.32)]!"
              : undefined
          }
        >
          {pending ? "Working…" : verb}
        </Button>
        {state.error ? <span className="text-[12.5px] text-amber">{state.error}</span> : null}
        {state.done ? <span className="text-[12.5px] text-ac-2">{state.done}</span> : null}
      </div>
    </form>
  );
}
