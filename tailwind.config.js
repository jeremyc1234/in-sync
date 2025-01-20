/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      keyframes: {
        confetti: {
          '0%': { transform: 'translateY(0) rotate(0)', opacity: 1 },
          '100%': { transform: 'translateY(-100vh) rotate(360deg)', opacity: 0 }
        }
      },
      animation: {
        confetti: 'confetti linear forwards'
      }
    },
  },
  plugins: [],
};