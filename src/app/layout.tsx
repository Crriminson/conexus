import "./globals.css";

import { Providers } from "@/components/providers";

export const metadata = {
  title: "Conexus - IPO Documentation",
  description: "AI-powered SME IPO documentation platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
