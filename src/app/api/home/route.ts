import { NextRequest, NextResponse } from 'next/server';
import { sourceRegistry } from '@/sources';
import { fetchHomeWithCache } from '@/lib/chapter-cache';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sourceId = searchParams.get('source') || undefined;
  const refresh = searchParams.get('refresh') === '1' || searchParams.get('refresh') === 'true';

  try {
    const source = sourceRegistry.getSource(sourceId);

    // If source does not support getHome, cleanly return empty data
    if (!source.getHome) {
      return NextResponse.json({ success: true, data: [] });
    }

    const { sections, cached } = await fetchHomeWithCache(
      source.meta.id,
      () => source.getHome!(),
      refresh
    );

    return NextResponse.json(
      { success: true, data: sections },
      {
        headers: {
          'X-Cache': cached ? 'HIT' : 'MISS',
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
