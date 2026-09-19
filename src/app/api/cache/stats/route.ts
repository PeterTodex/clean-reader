import { NextResponse } from 'next/server';
import { getChapterCacheStats } from '@/lib/chapter-cache';

// Must stay dynamic: these numbers come from the live database. Without this, Next would
// prerender the route at build time and freeze the counts into the build output.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    return NextResponse.json({ success: true, data: getChapterCacheStats() });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
