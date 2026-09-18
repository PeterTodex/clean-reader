import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export async function POST(req: NextRequest) {
  try {
    const { mirror } = await req.json();
    if (!mirror) {
      return NextResponse.json({ success: false, error: 'Mirror URL is required' }, { status: 400 });
    }

    const start = Date.now();
    await axios.get(mirror, {
      timeout: 5000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      validateStatus: (status) => status >= 200 && status < 400,
    });
    const latency = Date.now() - start;

    return NextResponse.json({ success: true, latency, available: true });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      available: false,
      error: err.message,
      latency: -1,
    });
  }
}
