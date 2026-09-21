import type { Metadata, Viewport } from 'next';
import './globals.css';
import { GlobalThemeProvider } from '@/components/GlobalThemeProvider';

export const metadata: Metadata = {
  title: '清阅',
  description: '一款专注于极致阅读体验的开源网页小说阅读器。支持多书源切换、防屏蔽备用线路、纯净排版、离线缓存、零广告打扰。',
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/icon.png', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
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
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var raw = localStorage.getItem('clean_reader_settings');
                  var theme = 'white';
                  if (raw) {
                    var parsed = JSON.parse(raw);
                    if (parsed && parsed.theme) theme = parsed.theme;
                  }
                  if (theme === 'oled') theme = 'dark';
                  if (theme === 'eink') theme = 'white';
                  var valid = ['white', 'dark', 'navy', 'apricot', 'parchment', 'eyecare'];
                  if (valid.indexOf(theme) === -1) theme = 'white';
                  var root = document.documentElement;
                  root.classList.add('theme-' + theme);
                  if (theme === 'dark' || theme === 'navy') {
                    root.classList.add('dark');
                  }
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-screen flex flex-col antialiased">
        <GlobalThemeProvider>
          {children}
        </GlobalThemeProvider>
      </body>
    </html>
  );
}
