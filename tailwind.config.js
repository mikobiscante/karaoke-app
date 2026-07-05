/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./style/**/*.{css,js,ts,jsx,tsx,mdx}",
    "./styles/**/*.{css,js,ts,jsx,tsx,mdx}",
    "./**/*.{html,js,jsx,ts,tsx,mdx}",
  ],
  theme: { extend: {} },
  plugins: [],
};
