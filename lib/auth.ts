import { cache } from "react";
import { getServerSession } from "next-auth";
import { cookies } from "next/headers";
import { createAuthOptions, getAuthConfiguration } from "./authConfig";

export const authOptions = createAuthOptions();

export type CurrentUser = { id: string; name: string; email?: string | null; image?: string | null };

/** 한 요청 안에서는 한 번만 확인합니다 (레이아웃·계정 메뉴·화면이 함께 불러도 세션 복호화는 한 번). */
export const getCurrentUser = cache(async function getCurrentUser(): Promise<CurrentUser | null> {
  // Stay request-rendered even if build-time auth configuration is incomplete.
  // Otherwise an account menu could freeze its logged-out state in static HTML.
  await cookies();
  if (!getAuthConfiguration().ready) return null;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  return { id: session.user.id, name: session.user.name || "예배팀원", email: session.user.email, image: session.user.image };
});
