const colors = require("tailwindcss/colors");
const defaultTheme = require("tailwindcss/defaultTheme");

// ===== Paleta de la app =====
// Colores sobrios y cálidos. Para cambiar el estilo de toda la app alcanza con tocar estas escalas.
// (La app usa los nombres de Tailwind "pink", "green", "red"... pero acá se redefinen con tonos apagados.)

// Acento principal: rosa palo (botones, pestañas activas, títulos)
const rosePalo = {
  50: "#F9F5F6",
  100: "#F4EBED",
  200: "#E9D8DC",
  300: "#D8BAC1",
  400: "#BB8B96",
  500: "#8D5361",
  600: "#774651",
  700: "#603942",
  800: "#4D2D35",
  900: "#3A2228",
  950: "#27171A",
};

// Verde salvia (finalizado, confirmaciones)
const salvia = {
  50: "#F6F9F7",
  100: "#EDF2EF",
  200: "#DBE6DF",
  300: "#C0D3C6",
  400: "#95B29E",
  500: "#51705C",
  600: "#425C4B",
  700: "#33473A",
  800: "#27352B",
  900: "#1A231D",
  950: "#111813",
};

// Ladrillo (cancelar, eliminar, errores)
const ladrillo = {
  50: "#FAF5F4",
  100: "#F6EBEA",
  200: "#EDD7D4",
  300: "#DFB8B4",
  400: "#CA847D",
  500: "#9F4B41",
  600: "#863F37",
  700: "#6D332C",
  800: "#572923",
  900: "#411E1B",
  950: "#2B1412",
};

// Dorado apagado (editar, avisos)
const dorado = {
  50: "#FBF8F4",
  100: "#F7F2E9",
  200: "#EEE4D3",
  300: "#E2D0B1",
  400: "#936F33",
  500: "#8F6D32",
  600: "#755929",
  700: "#5B4520",
  800: "#443418",
  900: "#2D2310",
  950: "#1E170B",
};

// Azul acero (acciones secundarias)
const acero = {
  50: "#F6F7F9",
  100: "#ECF0F3",
  200: "#D9E0E8",
  300: "#BDC9D6",
  400: "#8FA3B7",
  500: "#546B83",
  600: "#46596D",
  700: "#384757",
  800: "#2C3844",
  900: "#202932",
  950: "#14191F",
};

// Carbón cálido (acciones neutras)
const carbon = {
  50: "#F8F7F7",
  100: "#F1EFEE",
  200: "#E3E0DE",
  300: "#CEC8C5",
  400: "#ABA19C",
  500: "#635954",
  600: "#504844",
  700: "#3D3734",
  800: "#2C2826",
  900: "#1C1917",
  950: "#161413",
};

module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}", "./public/index.html"],
  theme: {
    extend: {
      colors: {
        gray: colors.stone, // grises cálidos
        pink: rosePalo,
        rose: rosePalo,
        green: salvia,
        emerald: salvia,
        teal: salvia,
        lime: salvia,
        red: ladrillo,
        yellow: dorado,
        amber: dorado,
        orange: dorado,
        blue: acero,
        sky: acero,
        cyan: acero,
        purple: carbon,
        indigo: carbon,
        violet: carbon,
        fuchsia: carbon,
      },
      fontFamily: {
        sans: ['"DM Sans"', ...defaultTheme.fontFamily.sans],
        display: ['"Cormorant Garamond"', "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};
