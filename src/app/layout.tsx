import type { Metadata, Viewport } from "next";
import { Newsreader, Schibsted_Grotesk } from "next/font/google";
import { UpdateOnOpen } from "@/components/update-on-open";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

const sans = Schibsted_Grotesk({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-sans", display: "swap" });
const serif = Newsreader({ subsets: ["latin"], weight: ["400", "500"], style: ["normal"], variable: "--font-serif", display: "swap" });

export const metadata: Metadata = {
  title: "Untangle",
  description: "Turns a messy list into a realistic day.",
  icons: { apple: "/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "Untangle", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Literals: the browser chrome cannot read CSS variables. They match --ground in both themes of design/tokens.css.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f3f7" },
    { media: "(prefers-color-scheme: dark)", color: "#0e0c1d" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <UpdateOnOpen />
        {children}
      </body>
    </html>
  );
}
