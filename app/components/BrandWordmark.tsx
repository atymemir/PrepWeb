type BrandWordmarkProps = {
  className?: string;
  compact?: boolean;
};

export default function BrandWordmark({ className = "", compact = false }: BrandWordmarkProps) {
  const coreLetterSpacing = "-0.095em";

  return (
    <span
      className={["inline-flex items-end leading-none normal-case", className].join(" ").trim()}
      style={{ fontFamily: "Montserrat, Avenir Next, Segoe UI, sans-serif" }}
    >
      <span className="font-bold" style={{ letterSpacing: coreLetterSpacing }}>
        alg
      </span>
      <span
        className="relative ml-[-0.08em] font-bold"
        style={{
          letterSpacing: coreLetterSpacing,
          fontSize: "0.74em",
          transform: "translateY(0.19em)",
        }}
      >
        a
      </span>
      {!compact && (
        <span className="ml-[0.34em] text-[0.88em] font-semibold tracking-[0.01em] text-current opacity-[0.82]">
          prep
        </span>
      )}
    </span>
  );
}
