/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        rail: {
          navy: '#0B1F3A',
          dark: '#071324',
          blue: '#2563EB',
          teal: '#14B8A6',
          green: '#16A34A',
          amber: '#F59E0B',
          red: '#DC2626',
          bg: '#F8FAFC',
          card: '#FFFFFF',
          border: '#E2E8F0',
          muted: '#64748B',
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-right': {
          '0%': { opacity: '0', transform: 'translateX(24px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.22s ease-out both',
        'slide-in-right': 'slide-in-right 0.25s ease-out both',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}
