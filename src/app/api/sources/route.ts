import { NextResponse } from 'next/server';
import { sourceRegistry } from '@/sources';

export async function GET() {
  try {
    const sources = sourceRegistry.listSources();
    return NextResponse.json({ success: true, data: sources });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
