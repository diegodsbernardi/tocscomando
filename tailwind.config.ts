import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        cyan: {
          DEFAULT: "#14A0DC",
          deep: "#0E7BB0",
        },
        navy: "#0B2A45",
        brandyellow: {
          DEFAULT: "#FFDE00",
          deep: "#F2C200",
        },
        appbg: "#EAEEF3",
        surface: "#FFFFFF",
        muted: "#7A8AA0",
        line: "#EAEFF5",
        // setores
        atend: {
          DEFAULT: "#14A0DC",
          bg: "#E6F6FF",
        },
        cozinha: {
          DEFAULT: "#E11D48",
          bg: "#FDE8EE",
        },
        // semáforos
        ok: {
          DEFAULT: "#16A34A",
          bg: "#E7F8EE",
        },
        warn: {
          DEFAULT: "#D97706",
          bg: "#FEF3C7",
        },
        danger: {
          DEFAULT: "#E11D48",
          bg: "#FDE8EE",
        },
        // legacy (back-compat enquanto refatoramos)
        brand: {
          DEFAULT: "#14A0DC",
          dark: "#0E7BB0",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 10px 30px -12px rgba(11,42,69,0.22)",
        card: "0 4px 16px -6px rgba(11,42,69,0.14)",
        phone: "0 30px 60px -20px rgba(11,42,69,0.35)",
      },
      borderRadius: {
        card: "18px",
        hero: "26px",
      },
      backgroundImage: {
        "cyan-hero":
          "linear-gradient(150deg, #1AAEEC 0%, #14A0DC 42%, #0E7BB0 100%)",
        "app-radial":
          "radial-gradient(120% 60% at 50% -10%, rgba(20,160,220,0.18), transparent 60%), #EAEEF3",
      },
    },
  },
  plugins: [],
};

export default config;
