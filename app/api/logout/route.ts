import { NextResponse } from "next/server";
import { SESSION_COOKIE, isSameOrigin } from "@/app/lib/security";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ ok: false }, { status: 403 });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
  return response;
}
