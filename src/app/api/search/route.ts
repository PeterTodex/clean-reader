import { NextRequest, NextResponse } from 'next/server';
import { sourceRegistry } from '@/sources';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const keyword = searchParams.get('keyword');
  const sourceId = searchParams.get('source') || 'diyibanzhu';
  const mirror = searchParams.get('mirror') || undefined;

  if (!keyword || !keyword.trim()) {
    return NextResponse.json({ success: false, error: '搜索关键词不能为空' }, { status: 400 });
  }

  try {
    const source = sourceRegistry.getSource(sourceId);
    const results = await source.search(keyword.trim(), mirror);
    return NextResponse.json({ success: true, data: results });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
