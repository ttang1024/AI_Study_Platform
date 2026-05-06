'use client';

import dynamic from 'next/dynamic';

const SharedContentPage = dynamic(
  () => import('../../pages/SharedContentPage').then((mod) => mod.SharedContentPage),
  { ssr: false },
);

export function SharedContentClient({ token }: { token: string }) {
  return <SharedContentPage token={token} />;
}
