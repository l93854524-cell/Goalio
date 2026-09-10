export type Cents = number & { readonly __brand: "Cents" };

export function cents(value: number): Cents {
  if (!Number.isInteger(value)) throw new Error("金额必须使用整数分");
  return value as Cents;
}

export function parseYuan(input: string): Cents | null {
  const normalized = input.replace(/,/g, "").trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const [yuan, fraction = ""] = normalized.split(".");
  const value = Number(yuan) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(value)) return null;
  return cents(value);
}

export function formatYuan(value: Cents, options: { decimals?: boolean } = {}): string {
  const yuan = value / 100;
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: options.decimals ? 2 : 0,
    maximumFractionDigits: options.decimals ? 2 : 0,
  }).format(yuan);
}

export function clampCents(value: number, min: number, max: number): Cents {
  return cents(Math.round(Math.min(max, Math.max(min, value))));
}
