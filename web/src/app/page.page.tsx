import type { Metadata } from 'next';
import { LandingClient } from './_components/LandingClient';
import { getWechatShareMetadata } from './shareMetadata';

const title = 'toto.ai - Learn from videos, audio, documents, and articles';
const description = 'AI-powered study platform for summaries, mind maps, flashcards, quizzes, notes, glossary terms, and shareable study links.';
const shareImage = '/share.png';

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    title,
    description,
    url: '/',
    images: [{ url: shareImage, width: 1200, height: 630, alt: 'toto.ai AI study platform' }],
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
    images: [shareImage],
  },
  other: getWechatShareMetadata(title, description, shareImage),
};

export default function Page() {
  return <LandingClient />;
}
