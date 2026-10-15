/**
 * Personal login link: the PM sends it (WhatsApp) instead of relying on
 * Supabase's email / SMS sending, which is rate limited or not configured.
 * The link signs that person in once; the session then stays.
 */
import type { Profile } from "../db/types";
import { he } from "../i18n/he";
import { normalizePhone } from "../phone";
import { assertPM } from "./access";
import { AccessError } from "./auth-types";
import { ServiceError, type Ctx } from "./tasks";

/** The few Supabase Auth admin calls the link needs (injected, so tests run without Supabase). */
export interface LinkAuth {
  userEmail(authUserId: string): Promise<string | null>;
  setUserEmail(authUserId: string, email: string): Promise<void>;
  /** creates the auth user when missing; sends nothing. `otp` is the same sign-in as a 6-digit code. */
  magicLink(email: string): Promise<{ userId: string; hashedToken: string; otp: string }>;
}

export async function createLoginLink(ctx: Ctx, auth: LinkAuth, profileId: string): Promise<{ token: string; code: string; profile: Profile }> {
  assertPM(ctx.s);
  const member = await ctx.store.first("project_members", { where: { project_id: ctx.s.project.id, profile_id: profileId } });
  const profile = member ? await ctx.store.byId("profiles", profileId) : null;
  if (!profile) throw new AccessError(he.errors.notFound, 404);
  return issue(ctx, auth, profile);
}

/**
 * A code for oneself, from a browser where one is already signed in: the
 * home-screen app on an iPhone keeps its own sign-in, and a code can be typed
 * there (a link cannot be opened inside it).
 */
export async function createOwnCode(ctx: Ctx, auth: LinkAuth): Promise<{ code: string; phone: string | null }> {
  const profile = await ctx.store.byId("profiles", ctx.s.profile.id);
  if (!profile) throw new AccessError(he.errors.notFound, 404);
  const r = await issue(ctx, auth, profile);
  return { code: r.code, phone: profile.phone };
}

async function issue(ctx: Ctx, auth: LinkAuth, profile: Profile): Promise<{ token: string; code: string; profile: Profile }> {

  let email = profile.auth_user_id ? await auth.userEmail(profile.auth_user_id) : null;
  if (!email) {
    // the email only identifies the person — nothing is sent to it
    if (!profile.email) throw new ServiceError(he.settings.linkNeedsEmail);
    email = profile.email;
    if (profile.auth_user_id) await auth.setUserEmail(profile.auth_user_id, email);
  }
  const { userId, hashedToken, otp } = await auth.magicLink(email);

  if (profile.auth_user_id !== userId) {
    // e.g. the person tried to sign up before the PM added him: an empty profile holds the account
    const other = await ctx.store.first("profiles", { where: { auth_user_id: userId } });
    if (other && other.id !== profile.id) {
      const busy = await ctx.store.first("project_members", { where: { profile_id: other.id } });
      if (busy) throw new ServiceError(he.settings.linkTaken);
      await ctx.store.update("profiles", { id: other.id }, { auth_user_id: null });
    }
    await ctx.store.update("profiles", { id: profile.id }, { auth_user_id: userId });
  }
  return { token: hashedToken, code: otp, profile };
}

/** Who a phone number signs in as: the project member with that number who has an account. */
export async function accountForPhone(ctx: Pick<Ctx, "store">, auth: Pick<LinkAuth, "userEmail">, phone: string): Promise<string | null> {
  const want = normalizePhone(phone);
  if (!want) return null;
  const profiles = (await ctx.store.select("profiles")).filter((p) => p.auth_user_id && p.phone && normalizePhone(p.phone) === want);
  for (const p of profiles) {
    const email = await auth.userEmail(p.auth_user_id!);
    if (email) return email;
  }
  return null;
}
