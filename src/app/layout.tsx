import type { Metadata, Viewport } from "next";
import { Lexend_Mega } from "next/font/google";
import "./globals.css";

const lexendMega = Lexend_Mega({
  variable: "--font-lexend-mega",
  subsets: ["latin"],
  weight: ["400", "700", "800", "900"],
});

const siteConfig = {
  name: "DevTools",
  description: "Free online tools for developers. Subdomain Scanner, OTP Generator, Base64 Image converter. No signup required, 100% client-side processing.",
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
    "TOTP",
    "base64 image",
    "base64 converter",
    "free online tools",
    "security tools",
    "cloudflare detector",
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
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
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
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
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
            }),
          }}
        />
      </head>
      <body className={`${lexendMega.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
