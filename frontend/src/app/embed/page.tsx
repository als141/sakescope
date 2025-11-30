import { Suspense } from 'react';
import EmbedPageClient from './EmbedPageClient';

export const dynamic = 'force-dynamic';

export default function EmbedPage() {
  return (
    <Suspense fallback={null}>
      <EmbedPageClient />
    </Suspense>
  );
}
