import { NextResponse } from "next/server";
import {
  clearLifeAuthCookies,
  getLifeIdentity,
  readLifeAccessToken,
  readLifeRefreshToken,
  refreshLifeSession,
  setLifeAuthCookies,
} from "@/lib/server/life-auth";

export async function GET(request: Request) {
  const accessToken = readLifeAccessToken(request);
  if (accessToken) {
    try {
      const identity = await getLifeIdentity(accessToken);
      if (identity) return NextResponse.json({ ok: true, authenticated: true, identity });
    } catch {
      // Fall through to refresh-token flow.
    }
  }

  const refreshToken = readLifeRefreshToken(request);
  if (!refreshToken) return NextResponse.json({ ok: true, authenticated: false, identity: null });

  try {
    const session = await refreshLifeSession(refreshToken);
    const identity = await getLifeIdentity(session.access_token);
    const response = NextResponse.json({ ok: true, authenticated: Boolean(identity), identity });
    setLifeAuthCookies(response, session);
    return response;
  } catch {
    const response = NextResponse.json({ ok: true, authenticated: false, identity: null });
    clearLifeAuthCookies(response);
    return response;
  }
}
