/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./wwwroot/**/*.{html,js}",
  ],
  safelist: [
    'bg-red-200',
    'bg-green-200',
    'text-red-900',
    'text-green-900',
    'px-6',
    'py-4',
    'whitespace-nowrap',
    'text-sm',
    'font-medium'
  ],
  theme: {
    extend: {},
  },
  plugins: [require("daisyui")],
  daisyui: {
    themes: ["light"], // Set "light" as the default theme
  },
}

