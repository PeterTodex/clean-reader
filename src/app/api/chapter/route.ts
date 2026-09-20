import { NextRequest, NextResponse } from 'next/server';
import { sourceRegistry } from '@/sources';
import { fetchChapterWithCache } from '@/lib/chapter-cache';

// The chapter cache uses Node.js filesystem APIs.
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const bookId = searchParams.get('bookId');
  const chapterId = searchParams.get('chapterId');
  const sourceId = searchParams.get('source') || undefined;

  if (!bookId || !chapterId) {
    return NextResponse.json({ success: false, error: '书籍 ID 和章节 ID 均不能为空' }, { status: 400 });
  }

  try {
    const source = sourceRegistry.getSource(sourceId);
    // Key on the *resolved* source id: getSource() falls back to the default source when the
    // requested id is unknown, so caching under the requested-but-missing id would both pollute
    // the cache and never be hit again.
    const { content, cached } = await fetchChapterWithCache(
      source.meta.id,
      bookId,
      chapterId,
      () => source.getChapter(bookId, chapterId)
    );
    return NextResponse.json(
      { success: true, data: content },
      { headers: { 'X-Cache': cached ? 'HIT' : 'MISS' } }
    );
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
