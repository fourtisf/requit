import { handlers } from "@/auth";

export const { GET, POST } = handlers;

// The postback endpoint (Phase 1) and this one both need the Node runtime — the
// adapter and nodemailer are not edge-compatible.
export const runtime = "nodejs";
