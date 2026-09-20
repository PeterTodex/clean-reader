import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { sharedHttpsAgent } from '@/lib/request';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const imageUrl = searchParams.get('url');
  const referer = searchParams.get('referer') || '';

  if (!imageUrl) {
    return new NextResponse('Missing url parameter', { status: 400 });
  }

  try {
    let hostname = '';
    try {
      hostname = new URL(imageUrl).hostname;
    } catch {}

    const response = await axios({
      method: 'GET',
      url: imageUrl,
      responseType: 'arraybuffer',
      timeout: 10000,
      httpsAgent: sharedHttpsAgent,
      proxy: false,
      headers: {
        ...(hostname ? { Host: hostname } : {}),
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        ...(referer ? { Referer: referer } : {}),
      },
    });

    const contentType = String(response.headers['content-type'] || 'image/jpeg');
    const buffer = Buffer.from(response.data);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      },
    });
  } catch (err: any) {
    return new NextResponse('Failed to fetch image', { status: 502 });
  }
}
