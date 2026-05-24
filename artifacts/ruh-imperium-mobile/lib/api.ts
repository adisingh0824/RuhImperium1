export interface Product {
  id: number;
  name: string;
  displayName: string;
  img: string;
  cat: string;
  notes: string;
  price: number;
  oldPrice: number | null;
  stars: number;
  reviews: number;
  badge: string | null;
  sizes: string[];
  desc: string;
  bestseller: boolean;
  tags: string[];
}

export interface CartItem {
  id: number;
  name: string;
  img: string;
  price: number;
  size: string;
  qty: number;
}

export interface Order {
  id: string;
  status: string;
  total: number;
  items: CartItem[];
  createdAt: string;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  isAdmin?: boolean;
}

function getBase(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  return domain ? `https://${domain}` : "";
}

export function imageUrl(img: string): string {
  if (!img) return "";
  if (img.startsWith("http")) return img;
  const filename = img.startsWith("/") ? img.slice(1) : img;
  return `${getBase()}/${filename}`;
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  token?: string
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const res = await fetch(`${getBase()}${path}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || `API error ${res.status}`);
  return data as T;
}

export function apiGet<T>(path: string, token?: string): Promise<T> {
  return apiFetch<T>(path, { method: "GET" }, token);
}

export function apiPost<T>(path: string, body: unknown, token?: string): Promise<T> {
  return apiFetch<T>(path, { method: "POST", body: JSON.stringify(body) }, token);
}
