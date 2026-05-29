/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'sans-serif'],
      },
      colors: {
        base: '#FFFBF5',
        ink: '#111111',
        primary: '#FB923C',
        mint: '#34D399',
        violet: '#818CF8',
        pink: '#F472B6',
        gold: '#FCD34D',
      },
      borderRadius: {
        phone: '44px',
        card: '20px',
        pill: '999px',
      },
    },
  },
  plugins: [],
}
