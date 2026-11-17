/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        discord: {
          rail: '#1e1f22',
          sidebar: '#2b2d31',
          chat: '#313338',
          input: '#383a40',
          hover: '#35373c',
          blurple: '#5865F2',
          blurpleHover: '#4752c4',
          text: '#dbdee1',
          muted: '#949ba4',
          green: '#23a55a',
          red: '#da373c',
        },
      },
      fontFamily: {
        sans: ['"gg sans"', '"Noto Sans"', '"Helvetica Neue"', 'Helvetica', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
