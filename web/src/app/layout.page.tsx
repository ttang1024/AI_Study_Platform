import type { Metadata, Viewport } from 'next';
import '../index.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import {
  defaultShareDescription,
  defaultShareImage,
  defaultShareImageHeight,
  defaultShareImageWidth,
  defaultShareTitle,
  getWechatShareMetadata,
  siteUrl,
} from './shareMetadata';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: defaultShareTitle,
    template: '%s | toto.ai',
  },
  description: defaultShareDescription,
  applicationName: 'toto.ai',
  icons: {
    icon: '/app.png',
    apple: '/app.png',
  },
  openGraph: {
    type: 'website',
    siteName: 'toto.ai',
    title: defaultShareTitle,
    description: defaultShareDescription,
    url: '/',
    images: [
      {
        url: defaultShareImage,
        width: defaultShareImageWidth,
        height: defaultShareImageHeight,
        alt: 'toto.ai AI study platform',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: defaultShareTitle,
    description: defaultShareDescription,
    images: [defaultShareImage],
  },
  other: getWechatShareMetadata(defaultShareTitle, defaultShareDescription, defaultShareImage),
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Bangers&family=Quicksand:wght@400;600;700&family=Orbitron:wght@400;700&family=Cinzel:wght@400;700&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
