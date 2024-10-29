/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./wwwroot/**/*.html",
  ],
  theme: {
    extend: {},
  },
  plugins: [require("daisyui")],
  daisyui: {
    themes: ["light"], // Set "light" as the default theme
  },
}

