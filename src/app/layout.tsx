import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '清阅 - 纯粹、优雅、无广告的在线小说阅读器',
  description: '一款专注于极致阅读体验的开源网页小说阅读器。支持多书源切换、防屏蔽备用线路、纯净排版、离线缓存、零广告打扰。',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: '清阅',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen flex flex-col antialiased">
        {children}
      </body>
    </html>
  );
}
