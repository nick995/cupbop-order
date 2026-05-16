import { priceForProtein } from "./menu";

export interface CartLine {
  id: string;           // unique id for this line (e.g., crypto.randomUUID())
  proteinId: string;
  spicyLevelId: string;
  modIds: string[];     // bowl mods: "no-rice", "no-noodle", "no-cabbage"
  qty: number;
}

const CART_KEY = "cupbop_cart_v3";

export const CART_UPDATED_EVENT = "cupbop:cart-updated";

function emitCartUpdated(): void {
  if (typeof window === "undefined") return;
  // Defer to a microtask so subscribers' setState never fires during a
  // parent component's render — avoids React's "update component while
  // rendering different component" warning when saveCart is invoked from
  // inside a setState updater function.
  queueMicrotask(() => {
    window.dispatchEvent(new CustomEvent(CART_UPDATED_EVENT));
  });
}

export function loadCart(): CartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (l): l is CartLine =>
        l &&
        typeof l.id === "string" &&
        typeof l.proteinId === "string" &&
        typeof l.spicyLevelId === "string" &&
        Array.isArray(l.modIds) &&
        typeof l.qty === "number" &&
        l.qty > 0
    );
  } catch {
    return [];
  }
}

export function saveCart(lines: CartLine[]): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(CART_KEY, JSON.stringify(lines));
  emitCartUpdated();
}

export function clearCart(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(CART_KEY);
  emitCartUpdated();
}

export function removeLine(lineId: string): CartLine[] {
  const next = loadCart().filter((l) => l.id !== lineId);
  saveCart(next);
  return next;
}

export function newLineId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function lineSubtotal(line: CartLine): number {
  return priceForProtein(line.proteinId) * line.qty;
}

export function cartSubtotal(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + lineSubtotal(l), 0);
}

export function cartCount(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.qty, 0);
}
