/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './**/*.{js,ts,jsx,tsx}',
    '!./node_modules/**',
    '!./dist/**',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Space Grotesk"', 'sans-serif'],
      },
      colors: {
        // Palette roles (see utils/categoryStyle.ts for category tile colors):
        //  primary accent = yellow · income = green · transfer/info = blue
        //  owed (friends) = orange · alert/negative only = red · ink = black
        neo: {
          yellow: '#FFD23F',
          green: '#62E3A4',
          greenDark: '#16643D', // income text (AA on white/cream); dark mode flips it in globals.css
          danger: '#A62327', // error/destructive text; bg-neo-red stays the bright fill
          red: '#F0443B',
          blue: '#82B8FF',
          purple: '#C9B8FF',
          pink: '#FFB3D1',
          orange: '#FF9F45',
          ink: '#111111',
          bg: '#F6F1E7',
          surface: '#FFFFFF',
        },
      },
      boxShadow: {
        // --neo-shadow flips to a light color in dark mode (styles/globals.css)
        neo: '4px 4px 0px 0px var(--neo-shadow)',
        'neo-sm': '2px 2px 0px 0px var(--neo-shadow)',
        'neo-lg': '6px 6px 0px 0px var(--neo-shadow)',
        'neo-pressed': '0px 0px 0px 0px var(--neo-shadow)',
      },
    },
  },
  plugins: [],
};
