import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/app/lib/security";

export async function GET(request: Request) {
  const cookie = request.headers.get("cookie") || "";
  const token = cookie.split(";").map(v => v.trim()).find(v => v.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
  const session = verifySessionToken(token);
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({ ok: true, user: { email: session.email, name: session.name, surname: session.surname } });
}
