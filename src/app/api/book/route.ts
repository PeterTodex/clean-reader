import { NextRequest, NextResponse } from 'next/server';
import { sourceRegistry } from '@/sources';
import { fetchBookWithCache } from '@/lib/chapter-cache';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const bookId = searchParams.get('id');
  const sourceId = searchParams.get('source') || undefined;
  const refresh = searchParams.get('refresh') === '1' || searchParams.get('refresh') === 'true';

  if (!bookId) {
    return NextResponse.json({ success: false, error: '书籍 ID 不能为空' }, { status: 400 });
  }

  try {
    const source = sourceRegistry.getSource(sourceId);
    const { detail, cached } = await fetchBookWithCache(
      source.meta.id,
      bookId,
      () => source.getDetail(bookId),
      refresh
    );
    return NextResponse.json(
      { success: true, data: detail },
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
