"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { normaliseCountry, UNKNOWN_COUNTRY } from "@/lib/country";

/**
 * Settings are written from the session's user id, never from a field in the
 * form. A form value naming the user would let anyone edit anyone.
 */
export async function saveSettings(formData: FormData): Promise<void> {
  const user = await requireUser();

  // An unchecked checkbox submits nothing at all, so absence is the "off" value.
  const publicPayouts = formData.get("publicPayouts") === "on";
  const notifyRewards = formData.get("notifyRewards") === "on";
  const notifyWithdrawals = formData.get("notifyWithdrawals") === "on";
  const notifyDisputes = formData.get("notifyDisputes") === "on";

  const submittedCountry = normaliseCountry(String(formData.get("countryCode") ?? ""));

  await prisma.user.update({
    where: { id: user.id },
    data: {
      publicPayouts,
      notifyRewards,
      notifyWithdrawals,
      notifyDisputes,
      // Country is normally read from the edge header at signup. It is editable
      // only while it is unknown — a proxy stripped the header, say. Once we
      // know it, letting a member retype it turns offer eligibility into a
      // self-declared field, which is trivially gamed.
      ...(user.countryCode === UNKNOWN_COUNTRY && submittedCountry !== UNKNOWN_COUNTRY
        ? { countryCode: submittedCountry }
        : {}),
    },
  });

  revalidatePath("/settings");
  revalidatePath("/dashboard");
}
