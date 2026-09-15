import React, { useState, useEffect, useRef } from 'react';
import { Search, PackageSearch, Clock, CheckCircle2, Truck, PartyPopper, ShieldAlert } from 'lucide-react';
import AnnouncementBar from '../components/layout/AnnouncementBar';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';
import { useOrders } from '../hooks/useOrders';
import { Order } from '../types';

const STATUS_STEPS: { key: Order['status']; label: string; icon: React.ElementType }[] = [
  { key: 'pending', label: 'Pending Verification', icon: Clock },
  { key: 'confirmed', label: 'Confirmed', icon: CheckCircle2 },
  { key: 'shipped', label: 'Shipped', icon: Truck },
  { key: 'delivered', label: 'Delivered', icon: PartyPopper },
];

function statusIndex(status: Order['status']) {
  return STATUS_STEPS.findIndex((s) => s.key === status);
}

export default function TrackOrder() {
  const { subscribeToOrdersByPhone } = useOrders();

  const [phoneInput, setPhoneInput] = useState('');
  const [activePhone, setActivePhone] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => unsubscribeRef.current?.();
  }, []);

  const handleTrack = (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = phoneInput.replace(/[^0-9]/g, '');
    if (normalized.length < 10) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }

    unsubscribeRef.current?.();
    setError(null);
    setLoading(true);
    setSearched(true);
    setActivePhone(normalized);

    unsubscribeRef.current = subscribeToOrdersByPhone(
      normalized,
      (data) => {
        setOrders(data);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
  };

  return (
    <div id="track-order-page" className="min-h-screen flex flex-col bg-[#FDF8F2]">
      <AnnouncementBar />
      <Navbar />

      <div className="max-w-3xl mx-auto px-4 py-10 sm:px-6 lg:px-8 flex-grow w-full">
        <div className="text-center mb-8">
          <PackageSearch className="h-10 w-10 text-[#B8860B] mx-auto mb-3" />
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#1C1008] uppercase">
            Track Your Order
          </h1>
          <p className="text-gray-500 text-sm mt-1.5 font-sans">
            Enter the mobile number you used while placing your order to see its live status.
          </p>
        </div>

        {/* Lookup form */}
        <form
          onSubmit={handleTrack}
          className="bg-white border-2 border-[#B8860B]/20 rounded-md p-4 sm:p-5 flex flex-col sm:flex-row gap-3 shadow-sm mb-8"
        >
          <input
            type="tel"
            required
            placeholder="Enter your 10-digit mobile number"
            value={phoneInput}
            onChange={(e) => setPhoneInput(e.target.value)}
            className="flex-1 bg-[#FDF8F2] border border-[#B8860B]/25 rounded px-4 py-3 text-sm text-[#1C1008] focus:border-[#7A1C2E] focus:outline-none font-sans"
          />
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 bg-[#7A1C2E] hover:bg-[#1C1008] disabled:opacity-60 text-white py-3 px-6 rounded text-xs tracking-widest font-sans font-bold uppercase transition-colors"
          >
            <Search className="h-4 w-4" />
            {loading ? 'Searching...' : 'Track Order'}
          </button>
        </form>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded p-4 text-center mb-8 flex items-center justify-center gap-2 text-red-700 text-sm">
            <ShieldAlert className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}

        {loading && (
          <div className="text-center py-16 text-gray-500">
            <div className="w-10 h-10 border-4 border-[#B8860B] border-t-transparent rounded-full animate-spin mb-4 mx-auto" />
            <p className="font-serif italic text-[#1C1008]">Looking up your orders...</p>
          </div>
        )}

        {!loading && searched && !error && (
          <>
            {orders.length === 0 ? (
              <div className="bg-[#E8D5B0]/20 border border-[#B8860B]/15 rounded p-10 text-center flex flex-col items-center gap-2">
                <PackageSearch className="h-8 w-8 text-gray-400" />
                <p className="font-serif italic text-base text-gray-600">
                  No orders found for this mobile number.
                </p>
                <p className="text-xs text-gray-400">
                  Double-check the number you entered at checkout, or place a new order from our catalog.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                {/* Summary strip */}
                <div className="bg-[#7A1C2E] text-white rounded-md px-5 py-4 flex items-center justify-between font-sans">
                  <span className="text-sm sm:text-base font-semibold">
                    You have placed{' '}
                    <strong className="text-[#F5D98B]">
                      {orders.length} order{orders.length !== 1 ? 's' : ''}
                    </strong>{' '}
                    with us so far.
                  </span>
                  <span className="text-[10px] uppercase tracking-widest opacity-80 hidden sm:inline">
                    Updates every 10s
                  </span>
                </div>

                {orders.map((order) => {
                  const currentIndex = statusIndex(order.status);
                  const dateStr = order.createdAt?.seconds
                    ? new Date(order.createdAt.seconds * 1000).toLocaleString('en-IN')
                    : 'Recent Order';

                  return (
                    <div
                      key={order.id}
                      className="bg-white border-2 border-[#B8860B]/15 rounded-md p-5 shadow-sm flex flex-col gap-5"
                    >
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-gray-100 pb-3">
                        <div>
                          <span className="text-[10px] font-mono text-gray-400 uppercase block">Order Reference</span>
                          <strong className="text-xs font-mono font-bold text-[#7A1C2E] uppercase select-all">
                            {order.id}
                          </strong>
                        </div>
                        <span className="text-[11px] text-gray-500 font-sans">Placed: {dateStr}</span>
                      </div>

                      {/* Status tracker */}
                      <div className="flex items-center justify-between px-1">
                        {STATUS_STEPS.map((step, idx) => {
                          const Icon = step.icon;
                          const reached = idx <= currentIndex;
                          return (
                            <React.Fragment key={step.key}>
                              <div className="flex flex-col items-center gap-1.5 flex-1">
                                <div
                                  className={`h-9 w-9 rounded-full flex items-center justify-center border-2 transition-colors ${
                                    reached
                                      ? 'bg-[#7A1C2E] border-[#7A1C2E] text-white'
                                      : 'bg-white border-gray-200 text-gray-300'
                                  }`}
                                >
                                  <Icon className="h-4 w-4" />
                                </div>
                                <span
                                  className={`text-[9px] sm:text-[10px] font-bold uppercase text-center leading-tight ${
                                    reached ? 'text-[#1C1008]' : 'text-gray-300'
                                  }`}
                                >
                                  {step.label}
                                </span>
                              </div>
                              {idx < STATUS_STEPS.length - 1 && (
                                <div className={`h-0.5 flex-1 mb-5 ${idx < currentIndex ? 'bg-[#7A1C2E]' : 'bg-gray-200'}`} />
                              )}
                            </React.Fragment>
                          );
                        })}
                      </div>

                      {/* Items */}
                      <div className="flex flex-col gap-2 divide-y divide-gray-100 text-xs sm:text-sm font-sans">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="py-2 flex justify-between items-center">
                            <div className="flex flex-col">
                              <span className="font-semibold text-[#1C1008]">{item.productName}</span>
                              <span className="text-[10px] text-gray-500">Color: {item.color}</span>
                            </div>
                            <span className="text-gray-600">
                              Qty {item.qty} &times; ₹{item.price.toLocaleString('en-IN')}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="flex justify-between items-center border-t border-[#B8860B]/10 pt-3 font-sans">
                        <span className="text-[10px] uppercase text-gray-500 font-semibold">
                          {order.paymentMethod === 'online' ? 'Paid Online' : 'Cash on Delivery'}
                        </span>
                        <span className="text-lg font-bold text-[#7A1C2E]">
                          ₹{order.total.toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      <Footer />
    </div>
  );
}