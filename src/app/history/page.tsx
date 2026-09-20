'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function HistoryRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/bookshelf?tab=history');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
