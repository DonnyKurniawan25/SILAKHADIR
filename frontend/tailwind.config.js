/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Palet mengikuti lambang Kabupaten Lombok Barat
        // Biru langit (perisai), kuning emas (bingkai/bintang), merah (pita)
        brand: {
          50: '#eaf6fd',
          100: '#cde9f9',
          200: '#9bd2f2',
          300: '#63b8e9',
          400: '#2f9cdd',
          500: '#1685c4',       // warna utama biru logo
          600: '#126ea4',
          700: '#0f5785',
          800: '#0c4469',
          900: '#0a3452',
        },
        gold: {
          50: '#fff8dc',
          100: '#fef1b8',
          200: '#fde572',
          300: '#fbd942',
          400: '#f5c91e',       // kuning emas logo
          500: '#dcb118',
          600: '#a88312',
          700: '#75600d',
        },
        accent: {
          50: '#fdecec',
          100: '#fbd6d6',
          400: '#e25252',
          500: '#d32f2f',       // merah pita logo
          600: '#b91c1c',
          700: '#8f1515',
        },
        ink: {
          900: '#0f172a',
          700: '#334155',
          500: '#64748b',
          300: '#cbd5e1',
        },
      },
      fontFamily: {
        sans: ['Poppins', 'system-ui', 'Segoe UI', 'sans-serif'],
        serif: ['Poppins', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(12, 68, 105, 0.06), 0 1px 0 rgba(12, 68, 105, 0.04)',
        'card-hover': '0 4px 12px rgba(12, 68, 105, 0.1)',
      },
      borderRadius: {
        'xs': '4px',
      },
    },
  },
  plugins: [],
}
