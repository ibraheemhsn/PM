/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        // خط عربي واضح للواجهات — محمَّل في index.html
        sans: ['"IBM Plex Sans Arabic"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
