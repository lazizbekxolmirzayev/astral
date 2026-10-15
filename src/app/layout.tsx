import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Suspense } from "react";
import { defaultLocale } from "@/i18n/config";
import defaultMessages from "@/messages/uz.json";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter-family",
  subsets: ["latin", "cyrillic"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-family",
  subsets: ["latin"],
});

// Read from the default-locale catalog at build time: metadata that touches
// the locale cookie blocks prerendering under `cacheComponents`. `LocaleSync`
// rewrites the title in the browser once the real locale is known.
export const metadata: Metadata = {
  title: defaultMessages.app.title,
  description: defaultMessages.app.tagline,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang={defaultLocale}
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="h-full flex flex-col bg-background text-foreground">
        <Suspense>{children}</Suspense>
      </body>
    </html>
  );
}
