/**
 * The shape every admin action returns.
 *
 * Kept out of actions.ts because a "use server" module may only export async
 * functions — a constant there becomes a build error, not a runtime one, which
 * is the better direction but only if it is not shipped.
 */
export type FormState = { error: string | null; done: string | null };

export const EMPTY_FORM_STATE: FormState = { error: null, done: null };
