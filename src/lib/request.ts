import axios, { AxiosRequestConfig } from 'axios';
import iconv from 'iconv-lite';

const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export async function fetchHtml(
  url: string,
  options?: {
    encoding?: string;
    headers?: Record<string, string>;
    timeout?: number;
    method?: 'GET' | 'POST';
    data?: any;
  }
): Promise<string> {
  const encoding = options?.encoding || 'utf-8';
  const timeout = options?.timeout || 8000;

  const config: AxiosRequestConfig = {
    method: options?.method || 'GET',
    url,
    data: options?.data,
    responseType: 'arraybuffer',
    timeout,
    headers: {
      'User-Agent': DEFAULT_USER_AGENT,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      ...(options?.headers || {}),
    },
    validateStatus: (status) => status >= 200 && status < 400,
  };

  const response = await axios(config);
  const buffer = Buffer.from(response.data);

  if (encoding.toLowerCase() !== 'utf-8') {
    return iconv.decode(buffer, encoding);
  }

  // Detect meta charset if response doesn't explicitly match
  const rawStr = buffer.toString('utf-8');
  if (/charset=["']?(gbk|gb2312)["']/i.test(rawStr)) {
    return iconv.decode(buffer, 'gbk');
  }

  return rawStr;
}

export function buildProxiedImageUrl(originalUrl: string, referer?: string): string {
  if (!originalUrl) return '';
  if (originalUrl.startsWith('/api/proxy/image')) return originalUrl;
  const params = new URLSearchParams({
    url: originalUrl,
    ...(referer ? { referer } : {}),
  });
  return `/api/proxy/image?${params.toString()}`;
}
