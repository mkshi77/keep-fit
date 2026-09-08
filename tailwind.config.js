/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './index.tsx', './App.tsx', './components/**/*.tsx'],
  theme: {
    extend: {
      colors: {
        bg: '#080808',
        card: '#151515',
        accent: '#9EFF3F',
        'accent-dim': '#365B18',
        rest: '#00ccff',
        'text-main': '#ffffff',
        'text-sub': '#888888',
      },
      fontFamily: {
        sans: ['"PingFang SC"', '"Noto Sans SC"', '-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', 'Roboto', 'Helvetica', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'pop-in': 'popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(5px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        popIn: {
          '0%': { opacity: '0', transform: 'scale(0.9)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        scan: {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
      },
    },
  },
  plugins: [],
};
