export function Logo({ size = 42 }: { size?: number }) {
  const fontSize = Math.round(size * 0.43);
  return (
    <div
      className="grid place-items-center flex-shrink-0 rounded-full bg-cyan font-display font-extrabold text-brandyellow shadow-card"
      style={{
        width: size,
        height: size,
        fontSize,
        letterSpacing: "-1px",
        boxShadow: "0 0 0 3px #0B2A45 inset, 0 4px 16px -6px rgba(11,42,69,0.14)",
      }}
    >
      T
    </div>
  );
}
