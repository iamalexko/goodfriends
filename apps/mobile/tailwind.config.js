/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './context/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        base:    '#FFFBF5',
        ink:     '#111111',
        primary: '#FB923C',
        mint:    '#34D399',
        violet:  '#818CF8',
        pink:    '#F472B6',
        gold:    '#FCD34D',
      },
    },
  },
  plugins: [],
}
