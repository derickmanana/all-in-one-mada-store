export const MGA_PER_USDT = 4500;

export function formatMGA(n: number | bigint): string {
  return new Intl.NumberFormat("fr-FR").format(Number(n)) + " MGA";
}

export function formatUSDT(mga: number | bigint): string {
  const v = Number(mga) / MGA_PER_USDT;
  return v.toLocaleString("en-US", { maximumFractionDigits: 2 }) + " USDT";
}

export function PriceDual({ mga, className }: { mga: number | bigint; className?: string }) {
  return (
    <span className={className}>
      <span className="font-black">{formatMGA(mga)}</span>
      <span className="ml-2 text-xs opacity-70">≈ {formatUSDT(mga)}</span>
    </span>
  );
}

export function Money({ value, className }: { value: number | bigint; className?: string }) {
  return <span className={className}>{formatMGA(value)}</span>;
}
