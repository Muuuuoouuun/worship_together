import { getServerSession } from "next-auth";
import { cookies } from "next/headers";
import { cache } from "react";
import { createAuthOptions, getAuthConfiguration } from "./authConfig";

export const authOptions = createAuthOptions();

export type CurrentUser = { id: string; name: string; email?: string | null; image?: string | null };

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  // Stay request-rendered even if build-time auth configuration is incomplete.
  // Otherwise an account menu could freeze its logged-out state in static HTML.
  await cookies();
  if (!getAuthConfiguration().ready) return null;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  return { id: session.user.id, name: session.user.name || "예배팀원", email: session.user.email, image: session.user.image };
});
