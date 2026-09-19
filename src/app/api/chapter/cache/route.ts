import { NextRequest, NextResponse } from 'next/server';
import { sourceRegistry } from '@/sources';
import { getCachedChapterIds } from '@/lib/chapter-cache';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const bookId = searchParams.get('bookId');
  const sourceId = searchParams.get('source') || undefined;

  if (!bookId) {
    return NextResponse.json({ success: false, error: '书籍 ID 不能为空' }, { status: 400 });
  }

  try {
    const source = sourceRegistry.getSource(sourceId);
    const cachedChapterIds = getCachedChapterIds(source.meta.id, bookId);
    return NextResponse.json({ success: true, data: cachedChapterIds });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
