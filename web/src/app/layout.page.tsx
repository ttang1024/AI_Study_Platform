import type { Metadata, Viewport } from 'next';
import '../index.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { getWechatShareMetadata, siteUrl } from './shareMetadata';

const title = 'toto.ai - AI Study Platform';
const description = 'Turn documents, YouTube videos, podcasts, audio lectures, and web articles into AI summaries, mind maps, flashcards, and quizzes.';
const shareImage = '/share.png';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: title,
    template: '%s | toto.ai',
  },
  description,
  applicationName: 'toto.ai',
  icons: {
    icon: '/app.png',
    apple: '/app.png',
  },
  openGraph: {
    type: 'website',
    siteName: 'toto.ai',
    title,
    description,
    url: '/',
    images: [{ url: shareImage, width: 512, height: 512, alt: 'toto.ai' }],
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
    images: [shareImage],
  },
  other: getWechatShareMetadata(title, description, shareImage),
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
