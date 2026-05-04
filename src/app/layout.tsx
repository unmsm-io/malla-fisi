import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/ThemeProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = "https://malla-fisi.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Malla FISI — Constructor Curricular UNMSM",
    template: "%s · Malla FISI",
  },
  description:
    "Constructor de malla curricular FISI con drag-and-drop, validacion de prerrequisitos, auto-organize y diagnostico inteligente. Exporta a Excel y PDF.",
  applicationName: "Malla FISI",
  keywords: [
    "FISI",
    "UNMSM",
    "malla curricular",
    "ingenieria de software",
    "ciencia de datos",
    "inteligencia artificial",
    "prerrequisitos",
    "constructor curricular",
  ],
  authors: [{ name: "FISI UNMSM" }],
  icons: {
    icon: [
      { url: "/icon.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon-16x16.png", type: "image/png", sizes: "16x16" },
      { url: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
    shortcut: ["/favicon.ico"],
  },
  openGraph: {
    type: "website",
    locale: "es_PE",
    url: SITE_URL,
    siteName: "Malla FISI",
    title: "Malla FISI — Constructor Curricular UNMSM",
    description:
      "Drag-and-drop, validacion de prereqs, auto-organize, diagnostico inteligente. Exporta a Excel/PDF.",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Malla FISI - Constructor Curricular UNMSM",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Malla FISI — Constructor Curricular UNMSM",
    description:
      "Drag-and-drop, validacion de prereqs, auto-organize. Exporta a Excel/PDF.",
    images: ["/og-twitter.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full overflow-hidden`}
    >
      <body className="h-full overflow-hidden bg-background text-foreground antialiased">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          {children}
          <Toaster
            richColors
            position="top-center"
            theme="system"
            toastOptions={{
              style: {
                fontSize: "13px",
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
