import { NextRequest, NextResponse } from 'next/server';
import { sourceRegistry } from '@/sources';
import { searchCachedBookContent } from '@/lib/chapter-cache';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const bookId = searchParams.get('bookId') || searchParams.get('id');
  const sourceId = searchParams.get('source') || undefined;
  const keyword = searchParams.get('keyword') || '';

  if (!bookId) {
    return NextResponse.json({ success: false, error: '书籍 ID 不能为空' }, { status: 400 });
  }

  if (!keyword.trim()) {
    return NextResponse.json({ success: false, error: '检索关键词不能为空' }, { status: 400 });
  }

  try {
    const source = sourceRegistry.getSource(sourceId);
    const result = searchCachedBookContent(source.meta.id, bookId, keyword);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || '检索失败' }, { status: 500 });
  }
}
