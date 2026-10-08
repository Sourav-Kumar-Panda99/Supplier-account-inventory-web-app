import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import { ThemeSync } from "@/components/ThemeToggle";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Supplier Account Inventory",
  description: "Internal supplier account inventory and credential access tool.",
};

/**
 * Applies a saved light/dark choice before the browser paints anything, so a
 * person who chose dark never sees a flash of the light page (and the other
 * way round). Runs while the HTML is being parsed, before React loads. With
 * no saved choice it does nothing and the CSS follows the device setting.
 * The key must match THEME_STORAGE_KEY in components/ThemeToggle.tsx.
 */
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: the script above may add data-theme to <html>
    // before React hydrates, which React would otherwise report as a mismatch.
    <html lang="en" className={`${inter.variable} ${geistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeSync />
        <a href="#main-content" className="skip-link sr-only">
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
