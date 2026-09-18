import { NextRequest, NextResponse } from 'next/server';
import { sourceRegistry } from '@/sources';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const bookId = searchParams.get('id');
  const sourceId = searchParams.get('source') || 'diyibanzhu';
  const mirror = searchParams.get('mirror') || undefined;

  if (!bookId) {
    return NextResponse.json({ success: false, error: '书籍 ID 不能为空' }, { status: 400 });
  }

  try {
    const source = sourceRegistry.getSource(sourceId);
    const detail = await source.getDetail(bookId, mirror);
    return NextResponse.json({ success: true, data: detail });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
