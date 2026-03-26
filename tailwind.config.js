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
        neo: {
          yellow: '#FFDE59',
          green: '#C3F53C',
          greenDark: '#26C485',
          red: '#FF4D4D',
          blue: '#5CE1E6',
          purple: '#C3B1E1',
          pink: '#FF99C8',
          orange: '#FF914D',
          bg: '#F4F4F5',
          surface: '#FFFFFF',
        },
      },
      boxShadow: {
        neo: '4px 4px 0px 0px rgba(0,0,0,1)',
        'neo-sm': '2px 2px 0px 0px rgba(0,0,0,1)',
        'neo-lg': '6px 6px 0px 0px rgba(0,0,0,1)',
        'neo-pressed': '0px 0px 0px 0px rgba(0,0,0,1)',
      },
    },
  },
  plugins: [],
};
