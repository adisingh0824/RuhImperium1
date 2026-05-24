import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { CartItem } from "@/lib/api";

interface CartContextType {
  items: CartItem[];
  addToCart: (item: Omit<CartItem, "qty">) => void;
  removeFromCart: (id: number, size: string) => void;
  updateQty: (id: number, size: string, qty: number) => void;
  clearCart: () => void;
  total: number;
  count: number;
}

const CartContext = createContext<CartContextType | null>(null);
const STORAGE_KEY = "ruh_cart_v1";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        try { setItems(JSON.parse(raw)); } catch {}
      }
    });
  }, []);

  const save = useCallback((next: CartItem[]) => {
    setItems(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const addToCart = useCallback((item: Omit<CartItem, "qty">) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.id === item.id && i.size === item.size);
      let next: CartItem[];
      if (existing) {
        next = prev.map((i) =>
          i.id === item.id && i.size === item.size ? { ...i, qty: i.qty + 1 } : i
        );
      } else {
        next = [...prev, { ...item, qty: 1 }];
      }
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const removeFromCart = useCallback((id: number, size: string) => {
    setItems((prev) => {
      const next = prev.filter((i) => !(i.id === id && i.size === size));
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const updateQty = useCallback((id: number, size: string, qty: number) => {
    setItems((prev) => {
      const next =
        qty <= 0
          ? prev.filter((i) => !(i.id === id && i.size === size))
          : prev.map((i) => (i.id === id && i.size === size ? { ...i, qty } : i));
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const clearCart = useCallback(() => save([]), [save]);

  const total = items.reduce((s, i) => s + i.price * i.qty, 0);
  const count = items.reduce((s, i) => s + i.qty, 0);

  return (
    <CartContext.Provider value={{ items, addToCart, removeFromCart, updateQty, clearCart, total, count }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
