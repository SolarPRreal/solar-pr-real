import { NextResponse } from "next/server";
import { callWebhook, isValidEmail, normalizeEmail } from "@/app/lib/security";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const email = normalizeEmail(url.searchParams.get("email"));
  const token = String(url.searchParams.get("token") || "").trim().slice(0, 200);
  const destination = new URL("/", url.origin);

  if (!isValidEmail(email) || !/^[A-Za-z0-9_-]{32,200}$/.test(token)) {
    destination.searchParams.set("confirmed", "0");
    return NextResponse.redirect(destination);
  }

  try {
    const { response, data } = await callWebhook({ action: "confirmEmail", email, token });
    destination.searchParams.set("confirmed", response.ok && data.ok === true ? "1" : "0");
  } catch {
    destination.searchParams.set("confirmed", "0");
  }

  return NextResponse.redirect(destination);
}
