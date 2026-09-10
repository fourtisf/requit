import type { ReactNode } from "react";

/**
 * A labelled checkbox. A real <input type="checkbox"> rather than a styled div,
 * so it works with the keyboard, with a screen reader, and with JavaScript off —
 * the settings form posts as a plain form.
 */
export function ToggleRow({
  name,
  label,
  description,
  defaultChecked,
}: {
  name: string;
  label: string;
  description: ReactNode;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 border-b border-bd py-4 last:border-b-0">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="mt-0.5 size-4 shrink-0 accent-ac"
      />
      <span>
        <span className="block text-[13.5px] font-medium text-fg">{label}</span>
        <span className="mt-1 block text-[12.5px] leading-[1.55] text-fg-3">{description}</span>
      </span>
    </label>
  );
}
