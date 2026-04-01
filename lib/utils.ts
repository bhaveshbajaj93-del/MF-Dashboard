import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a return value as a coloured string */
export function fmtReturn(val: number | null | undefined, decimals = 2): string {
  if (val === null || val === undefined) return "—";
  return `${val >= 0 ? "+" : ""}${val.toFixed(decimals)}%`;
}

/** Format large numbers compactly */
export function fmtCrores(val: number | null | undefined): string {
  if (val === null || val === undefined) return "—";
  if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L Cr`;
  if (val >= 1000) return `₹${(val / 1000).toFixed(1)}K Cr`;
  return `₹${val.toFixed(0)} Cr`;
}

export function fmtPct(val: number | null | undefined, decimals = 2): string {
  if (val === null || val === undefined) return "—";
  return `${val.toFixed(decimals)}%`;
}

export function fmtNum(val: number | null | undefined, decimals = 2): string {
  if (val === null || val === undefined) return "—";
  return val.toFixed(decimals);
}

export function returnColor(val: number | null | undefined): string {
  if (val === null || val === undefined) return "text-muted-foreground";
  if (val > 0) return "text-green-500";
  if (val < 0) return "text-red-500";
  return "text-muted-foreground";
}

export function categoryColor(type: string): string {
  const map: Record<string, string> = {
    equity:  "bg-blue-500/20 text-blue-400 border-blue-500/30",
    debt:    "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    hybrid:  "bg-purple-500/20 text-purple-400 border-purple-500/30",
    liquid:  "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
    index:   "bg-green-500/20 text-green-400 border-green-500/30",
    fof:     "bg-orange-500/20 text-orange-400 border-orange-500/30",
    other:   "bg-gray-500/20 text-gray-400 border-gray-500/30",
  };
  return map[type] ?? map.other;
}
