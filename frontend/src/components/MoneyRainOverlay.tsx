import { useEffect, useMemo, useState } from "react";

type Bill = {
  id: string;
  x: number;
  size: number;
  drift: number;
  rotate: number;
  duration: number;
  delay: number;
  opacity: number;
};

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function makeBills(seed: number, count: number): Bill[] {
  const base = String(seed);

  return Array.from({ length: count }).map((_, i) => ({
    id: `${base}-${i}-${Math.random().toString(16).slice(2)}`,
    x: rand(0, 96),
    size: rand(24, 54),
    drift: rand(-90, 90),
    rotate: rand(-260, 260),
    duration: rand(1700, 3000),
    delay: rand(0, 500),
    opacity: rand(0.78, 1),
  }));
}

export type MoneyRainOverlayProps = {
  seed: number;
  count?: number;
  hideAfterMs?: number;
  symbol?: string;
};

export default function MoneyRainOverlay({
  seed,
  count = 85,
  hideAfterMs = 3400,
  symbol = "💰",
}: MoneyRainOverlayProps) {
  const bills = useMemo(() => makeBills(seed, count), [seed, count]);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!seed) return;

    setVisible(true);

    const t = window.setTimeout(() => {
      setVisible(false);
    }, hideAfterMs);

    return () => window.clearTimeout(t);
  }, [seed, hideAfterMs]);

  if (!visible) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
        zIndex: 99999,
      }}
    >
      {bills.map((b) => (
        <div
          key={b.id}
          style={{
            position: "absolute",
            left: `${b.x}%`,
            top: "-90px",
            fontSize: `${b.size}px`,
            opacity: b.opacity,
            animationName: "moneyBagFall",
            animationDuration: `${b.duration}ms`,
            animationTimingFunction: "cubic-bezier(.2,.75,.35,1)",
            animationDelay: `${b.delay}ms`,
            animationFillMode: "forwards",
            ["--drift" as any]: `${b.drift}px`,
            ["--rotate" as any]: `${b.rotate}deg`,
          }}
        >
          {symbol}
        </div>
      ))}

      <style>
        {`
          @keyframes moneyBagFall {
            0% {
              transform: translate3d(0, -120px, 0) rotate(0deg) scale(0.75);
            }

            15% {
              opacity: 1;
            }

            100% {
              transform: translate3d(var(--drift), 125vh, 0) rotate(var(--rotate)) scale(1.08);
              opacity: 0.95;
            }
          }
        `}
      </style>
    </div>
  );
}