import type { Metadata, Viewport } from "next";
import { Lexend_Mega } from "next/font/google";
import "./globals.css";
import FeedbackButton from "@/components/FeedbackButton";

const lexendMega = Lexend_Mega({
  variable: "--font-lexend-mega",
  subsets: ["latin"],
  weight: ["400", "700", "800", "900"],
});

const siteConfig = {
  name: "DevTools",
  description: "Free online developer tools: Subdomain Scanner, OTP Generator, Base64 Converter, JSON Server, Webhook Tester, Image Uploader, File Transfer, Time Capsule, Speech to Text, YouTube Downloader, ANeko Builder, and Community Chat. No signup required.",
  url: process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000",
};

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: `${siteConfig.name} - Free Online Developer Tools`,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  keywords: [
    "developer tools",
    "subdomain scanner",
    "subdomain finder",
    "OTP generator",
    "TOTP authenticator",
    "base64 image converter",
    "JSON mock API",
    "webhook tester",
    "image uploader",
    "file transfer",
    "file sharing",
    "time capsule",
    "speech to text",
    "audio transcription",
    "youtube downloader",
    "youtube to mp3",
    "ANeko skin builder",
    "free online tools",
    "privacy tools",
  ],
  authors: [{ name: "DevTools Team" }],
  creator: "DevTools",
  publisher: "DevTools",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteConfig.url,
    siteName: siteConfig.name,
    title: `${siteConfig.name} - Free Online Developer Tools`,
    description: siteConfig.description,
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "DevTools - Free Online Developer Tools",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteConfig.name} - Free Online Developer Tools`,
    description: siteConfig.description,
    images: ["/og-image.png"],
  },
  icons: {
    icon: "/favicon.svg",
    apple: "/apple-icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFFEF0" },
    { media: "(prefers-color-scheme: dark)", color: "#0F0F0F" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteConfig.name,
    description: siteConfig.description,
    url: siteConfig.url,
    potentialAction: {
      "@type": "SearchAction",
      target: `${siteConfig.url}/check-subdomain?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Google Analytics */}
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-LYS24MWFYG" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-LYS24MWFYG');
            `,
          }}
        />
        <script
          type="application/ld+json"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd),
          }}
        />
      </head>
      <body className={`${lexendMega.variable} antialiased`}>
        {children}
        <FeedbackButton />
      </body>
    </html>
  );
}
