import type { Metadata } from 'next';
import { SharedContentClient } from '../../_components/SharedContentClient';
import {
  defaultShareImage,
  defaultShareImageHeight,
  defaultShareImageWidth,
  getWechatShareMetadata,
} from '../../shareMetadata';

type PageProps = {
  params: Promise<{ token: string }>;
};

type SharedContentMetadata = {
  title: string;
  ownerName: string;
  summary?: string | null;
  notesHtml?: string | null;
  sourceType?: string | null;
};

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? process.env.API_BACKEND_URL ?? process.env.VITE_API_URL ?? '';

import { stripHtmlInline as stripHtml } from '@core/utils/stripHtml';

const truncate = (value: string, max = 180) => {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).trim()}...`;
};

const getDescription = (content?: SharedContentMetadata | null) => {
  if (!content) return 'Open shared study content on toto.ai.';
  const sourceLabel = content.sourceType ? `${content.sourceType} ` : '';
  const body = stripHtml(content.summary ?? content.notesHtml ?? '');
  return truncate(body || `Shared ${sourceLabel}study content from ${content.ownerName}.`);
};

async function fetchSharedContent(token: string): Promise<SharedContentMetadata | null> {
  if (!apiUrl) return null;
  try {
    const response = await fetch(`${apiUrl}/api/share/${encodeURIComponent(token)}`, {
      next: { revalidate: 300 },
    });
    if (!response.ok) return null;
    const json = await response.json();
    return json.data ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { token } = await params;
  const content = await fetchSharedContent(token);
  const title = content?.title ? `${content.title} - Shared Study Content` : 'Shared Study Content';
  const description = getDescription(content);
  const url = `/share/${token}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      siteName: 'toto.ai',
      title,
      description,
      url,
      images: [
        {
          url: defaultShareImage,
          width: defaultShareImageWidth,
          height: defaultShareImageHeight,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [defaultShareImage],
    },
    other: getWechatShareMetadata(title, description, defaultShareImage),
  };
}

export default async function SharePage({ params }: PageProps) {
  const { token } = await params;
  return <SharedContentClient token={token} />;
}
