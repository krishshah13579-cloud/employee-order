"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { CartItem } from "@/lib/types";
import { ToastProvider } from "@/components/ui/Toast";

interface CartContextType {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (index: number) => void;
  updateQuantity: (index: number, quantityOrSets: number, isSetCount?: boolean) => void;
  clearCart: () => void;
  totalItems: number;
  totalSets: number;
  totalAmount: number;
}

const CartContext = createContext<CartContextType>({
  items: [],
  addItem: () => {},
  removeItem: () => {},
  updateQuantity: () => {},
  clearCart: () => {},
  totalItems: 0,
  totalSets: 0,
  totalAmount: 0,
});

export const useCart = () => useContext(CartContext);

function CartProviderInner({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [mounted, setMounted] = useState(false);

  // Load cart from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("garmentpro-cart");
      if (saved) setItems(JSON.parse(saved));
    } catch {}
    setMounted(true);
  }, []);

  // Persist cart to localStorage
  useEffect(() => {
    if (mounted) {
      localStorage.setItem("garmentpro-cart", JSON.stringify(items));
    }
  }, [items, mounted]);

  const addItem = useCallback((item: CartItem) => {
    setItems((prev) => {
      const existing = prev.findIndex(
        (i) => i.productId === item.productId && i.color === item.color
      );

      const pcsPerSet = item.pcsPerSet || 5;
      const itemSets = item.setsCount || Math.max(1, Math.round(item.quantity / pcsPerSet));
      const maxAvailable = item.maxSetsAvailable !== undefined ? item.maxSetsAvailable : 99999;

      if (existing >= 0) {
        const updated = [...prev];
        const prevItem = updated[existing];
        const prevSets = prevItem.setsCount || Math.max(1, Math.round(prevItem.quantity / pcsPerSet));
        
        // Strict cap at max available sets
        const combinedSets = Math.min(prevSets + itemSets, maxAvailable);

        updated[existing] = {
          ...prevItem,
          setsCount: combinedSets,
          quantity: combinedSets * pcsPerSet,
          maxSetsAvailable: maxAvailable,
        };
        return updated;
      }

      // Cap single item if exceeds max
      const cappedSets = Math.min(itemSets, maxAvailable);
      return [
        ...prev,
        {
          ...item,
          setsCount: cappedSets,
          quantity: cappedSets * pcsPerSet,
          maxSetsAvailable: maxAvailable,
        },
      ];
    });
  }, []);

  const removeItem = useCallback((index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateQuantity = useCallback(
    (index: number, quantityOrSets: number, isSetCount: boolean = false) => {
      if (quantityOrSets < 1) return;
      setItems((prev) => {
        const updated = [...prev];
        const item = updated[index];
        if (!item) return prev;

        const pcsPerSet = item.pcsPerSet || 5;
        const targetSets = isSetCount
          ? quantityOrSets
          : Math.max(1, Math.round(quantityOrSets / pcsPerSet));

        const maxSets = item.maxSetsAvailable !== undefined ? item.maxSetsAvailable : 99999;
        const cappedSets = Math.max(1, Math.min(targetSets, maxSets));

        updated[index] = {
          ...item,
          setsCount: cappedSets,
          quantity: cappedSets * pcsPerSet,
        };
        return updated;
      });
    },
    []
  );

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalSets = items.reduce(
    (sum, i) => sum + (i.setsCount || Math.max(1, Math.round(i.quantity / (i.pcsPerSet || 5)))),
    0
  );
  const totalAmount = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        totalItems,
        totalSets,
        totalAmount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  return <CartProviderInner>{children}</CartProviderInner>;
}
