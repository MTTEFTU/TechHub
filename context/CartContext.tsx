'use client';
import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { Product } from '@/lib/products';
import { addCartItem, restoreCart, CartItem } from '@/lib/cart-state';
import { apiRequest } from '@/lib/api';
export type { CartItem } from '@/lib/cart-state';
type CartContextValue = {
  items: CartItem[]; addItem: (product: Product) => void; removeItem: (variantId: string) => void;
  setQty: (variantId: string, qty: number) => void; clear: () => void; subtotal: number;
  validating: boolean; validationError: string;
  countryCode: string | undefined; setCountryCode: (countryCode: string | undefined) => void;
};
const CartContext = createContext<CartContextValue | undefined>(undefined);
const STORAGE_KEY = 'tech-hub-cart';
export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [countryCode, setCountryCode] = useState<string | undefined>(undefined);
  useEffect(() => {
    try { setItems(restoreCart(window.localStorage.getItem(STORAGE_KEY))); } catch { setItems([]); }
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready) { try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch { /* Storage may be disabled. */ } }
  }, [items, ready]);
  const signature = JSON.stringify(items.map(i => ({ variantId: i.product.variantId, quantity: i.qty })));
  useEffect(() => {
    if (!ready || signature === '[]') { setValidationError(''); setValidating(false); return; }
    const controller = new AbortController();
    async function refresh() {
      setValidating(true);
      try {
        const { products } = await apiRequest<{ products: Product[] }>('/products/quote', {
          method: 'POST', signal: controller.signal,
          body: JSON.stringify({ items: JSON.parse(signature), countryCode }),
        });
        if (!controller.signal.aborted) {
          setItems(current => current.map(item => ({
            ...item, product: products.find(p => p.variantId === item.product.variantId) || item.product,
          })));
          setValidationError('');
        }
      } catch (reason) {
        if (!controller.signal.aborted) setValidationError(reason instanceof Error ? reason.message : 'Cart could not be validated.');
      } finally { if (!controller.signal.aborted) setValidating(false); }
    }
    refresh();
    const onFocus = () => { if (!controller.signal.aborted) refresh(); };
    window.addEventListener('focus', onFocus);
    return () => { controller.abort(); window.removeEventListener('focus', onFocus); };
  }, [ready, signature, countryCode]);
  const addItem = (product: Product) => setItems(prev => addCartItem(prev, product));
  const removeItem = (id: string) => setItems(prev => prev.filter(i => i.product.variantId !== id));
  const setQty = (id: string, qty: number) => setItems(prev => prev.map(i => i.product.variantId === id
    ? { ...i, qty: Number.isFinite(qty) ? Math.max(1, Math.min(100, Math.floor(qty))) : i.qty } : i));
  const subtotal = items.reduce((sum, i) => sum + i.product.price * i.qty, 0);
  const clear = useCallback(() => setItems([]), []);
  return <CartContext.Provider value={{ items, addItem, removeItem, setQty, clear, subtotal, validating, validationError, countryCode, setCountryCode }}>{children}</CartContext.Provider>;
}
export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
