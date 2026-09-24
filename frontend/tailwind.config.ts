/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#0B2E33',
          800: '#071f22',
          900: '#041315'
        },
        teal: {
          DEFAULT: '#028090',
          50: '#f0f9fa',
          100: '#d9f1f3',
          200: '#b4e3e7',
          300: '#81ced6',
          400: '#47b2c0',
          500: '#028090',
          600: '#026774',
          700: '#03525d',
          800: '#06444d',
          900: '#093a42'
        },
        'light-teal': '#2BB3BE',
        mint: '#02C39A',
        brand: {
          navy: '#0B2E33',
          teal: '#028090',
          'light-teal': '#2BB3BE',
          mint: '#02C39A'
        }
      }
    }
  },
  plugins: []
};
