import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://flourishing-kleicha-abc250.netlify.app"),
  title: "SmartPrint Station — Self-Service Print & Scan",
  description: "Self-service print and scan kiosk. Upload documents, configure print settings, pay, and print — all from your phone.",
  keywords: ["print", "scan", "kiosk", "self-service", "PDF"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans light" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
