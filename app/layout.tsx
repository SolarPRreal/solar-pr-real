import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Solar PR Real",
  description: "Dashboard solar con acceso por registro y login",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}