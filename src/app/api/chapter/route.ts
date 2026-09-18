import { NextRequest, NextResponse } from 'next/server';
import { sourceRegistry } from '@/sources';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const bookId = searchParams.get('bookId');
  const chapterId = searchParams.get('chapterId');
  const sourceId = searchParams.get('source') || 'diyibanzhu';
  const mirror = searchParams.get('mirror') || undefined;

  if (!bookId || !chapterId) {
    return NextResponse.json({ success: false, error: '书籍 ID 和章节 ID 均不能为空' }, { status: 400 });
  }

  try {
    const source = sourceRegistry.getSource(sourceId);
    const content = await source.getChapter(bookId, chapterId, mirror);
    return NextResponse.json({ success: true, data: content });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
