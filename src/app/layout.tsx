import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
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

export const metadata: Metadata = {
  title: "Seven Knights Rebirth (Global) - Coupon Auto Redeem",
  description:
    "Automatically redeem multiple coupon codes for Seven Knights Rebirth (Global). Batch redeem coupons, track redemption history, and never miss free rewards.",
  keywords: [
    "Seven Knights Rebirth (Global)",
    "coupon",
    "redeem",
    "coupon code",
    "free rewards",
    "Netmarble",
    "mobile game",
    "auto redeem",
  ],
  authors: [{ name: "plamworapot" }],
  openGraph: {
    title: "Seven Knights Rebirth (Global) - Coupon Auto Redeem",
    description:
      "Automatically redeem multiple coupon codes for Seven Knights Rebirth (Global). Batch redeem coupons and track redemption history.",
    type: "website",
    locale: "en_US",
    siteName: "7K Coupon Redeem",
  },
  twitter: {
    card: "summary",
    title: "Seven Knights Rebirth (Global) - Coupon Auto Redeem",
    description:
      "Automatically redeem multiple coupon codes for Seven Knights Rebirth (Global). Batch redeem coupons and track redemption history.",
  },
  robots: {
    index: true,
    follow: true,
  },
  verification: {
    google: "50PUvpuhbfPc0yAs7LJtGi9Lj7BrWmeQgfw0ZQJDErA",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider>
          {children}
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
