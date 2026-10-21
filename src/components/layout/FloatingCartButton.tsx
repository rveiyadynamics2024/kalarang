import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ShoppingBag } from 'lucide-react';
import { useCartStore } from '../../store/cartStore';

/**
 * Floating "View Cart" button.
 * - Appears at the bottom of the screen only after the customer adds items.
 * - Clicking it opens the cart page (/cart) showing the added products.
 * - Hidden on the cart page itself and on admin pages.
 */
export default function FloatingCartButton() {
  const itemCount = useCartStore((state) => state.itemCount);
  const { pathname } = useLocation();

  const hidden =
    itemCount === 0 || pathname.startsWith('/cart') || pathname.startsWith('/admin');

  if (hidden) return null;

  return (
    <Link
      to="/cart"
      id="floating-cart-button"
      aria-label={`View cart, ${itemCount} item${itemCount > 1 ? 's' : ''}`}
      className="fixed bottom-5 left-1/2 -translate-x-1/2 sm:left-auto sm:translate-x-0 sm:right-6 z-50 flex items-center gap-3 rounded-full bg-maroon text-white pl-4 pr-5 py-3 shadow-xl hover:bg-espresso transition-colors"
    >
      <span className="relative">
        <ShoppingBag className="h-5 w-5" />
        <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] rounded-full bg-gold text-maroon text-[10px] font-bold flex items-center justify-center px-1">
          {itemCount}
        </span>
      </span>
      <span className="text-sm font-semibold tracking-wide">View Cart</span>
    </Link>
  );
}