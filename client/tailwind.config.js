/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
        mono: ['"DM Mono"', 'monospace'],
      },
      colors: {
        parchment: {
          50:  '#FDFAF4',
          100: '#F9F3E3',
          200: '#F0E4C4',
          300: '#E4CFA0',
          400: '#D4B57A',
          500: '#C49A56',
        },
        ink: {
          900: '#1A0F07',
          800: '#2C1810',
          700: '#3D2315',
          600: '#5A3520',
          500: '#7A4A2E',
          400: '#9B6443',
        },
        seal: {
          500: '#8B2020',
          600: '#6E1A1A',
          400: '#A83030',
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        'slide-up': 'slideUp 0.4s ease-out forwards',
        'stamp': 'stamp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
      },
      keyframes: {
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { opacity: 0, transform: 'translateY(16px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        stamp: { from: { opacity: 0, transform: 'scale(1.4) rotate(-3deg)' }, to: { opacity: 1, transform: 'scale(1) rotate(-3deg)' } },
      },
    },
  },
  plugins: [],
}
