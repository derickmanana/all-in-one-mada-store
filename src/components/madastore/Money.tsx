export function formatMGA(n: number | bigint): string {
  return new Intl.NumberFormat("fr-FR").format(Number(n)) + " MGA";
}

export function Money({ value, className }: { value: number | bigint; className?: string }) {
  return <span className={className}>{formatMGA(value)}</span>;
}
