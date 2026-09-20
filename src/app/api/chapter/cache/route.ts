import { NextRequest, NextResponse } from 'next/server';
import { sourceRegistry } from '@/sources';
import {
  getCachedChapterIds,
  startBackgroundBookCache,
  stopBackgroundBookCache,
  getBackgroundCacheStatus,
} from '@/lib/chapter-cache';

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
    const task = getBackgroundCacheStatus(source.meta.id, bookId);
    return NextResponse.json({ success: true, data: cachedChapterIds, task });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { bookId, sourceId, action = 'start' } = body || {};

    if (!bookId) {
      return NextResponse.json({ success: false, error: '书籍 ID 不能为空' }, { status: 400 });
    }

    const source = sourceRegistry.getSource(sourceId);

    if (action === 'stop') {
      const stopped = stopBackgroundBookCache(source.meta.id, bookId);
      return NextResponse.json({ success: true, stopped, message: stopped ? '已停止后台缓存' : '没有正在运行的任务' });
    }

    const result = await startBackgroundBookCache(source.meta.id, bookId);
    return NextResponse.json({ success: true, data: result });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || '启动后台缓存失败' }, { status: 500 });
  }
}
