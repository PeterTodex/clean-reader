import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        parchment: {
          50: '#faf7ee',
          100: '#f5efdc',
          200: '#ede0be',
          300: '#e3ce9c',
          800: '#3a332a',
          900: '#26221c',
        },
        eyecare: {
          50: '#f4f9f4',
          100: '#e7f3e8',
          200: '#cce6ce',
          300: '#a3d1a7',
          800: '#1b381e',
          900: '#122514',
        }
      },
      fontFamily: {
        serif: ['"Noto Serif SC"', '"Source Han Serif SC"', 'SimSun', 'STSong', 'serif'],
        kaiti: ['"Kaiti SC"', 'STKaiti', '"KaiTi"', 'serif'],
        sans: ['system-ui', '-apple-system', 'BlinkMacSystemFont', '"PingFang SC"', '"Microsoft YaHei"', 'sans-serif'],
      }
    },
  },
  plugins: [],
};
export default config;
