import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, CreditCard, Check, ArrowLeft, ShieldCheck, Truck, RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';
import { useProducts } from '../hooks/useProducts';
import { useCollections } from '../hooks/useCollections';
import { useOrders } from '../hooks/useOrders';
import { useCartStore } from '../store/cartStore';
import ProductGrid from '../components/products/ProductGrid';
import AnnouncementBar from '../components/layout/AnnouncementBar';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

export default function ProductDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { products, loading: productsLoading } = useProducts();
  const { collections } = useCollections({ includeSeedFallbacks: true });
  const { addItem } = useCartStore();
  const { addOrder } = useOrders();

  const [activeImage, setActiveImage] = useState<string>('');
  const [showVideo, setShowVideo] = useState(false);
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [isAddedFeedback, setIsAddedFeedback] = useState<boolean>(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentSuccessId, setPaymentSuccessId] = useState<string | null>(null);

  // Buyer details required before "Buy Now / Pay Online" can proceed —
  // without these, a successful payment had nowhere to be saved and never
  // appeared in the admin orders panel.
  const [showBuyerForm, setShowBuyerForm] = useState(false);
  const [buyerName, setBuyerName] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [buyerAddress, setBuyerAddress] = useState('');
  const [buyerPincode, setBuyerPincode] = useState('');

  const product = products.find((p) => p.slug === slug && !p.isDeleted);

  // Set initial selected state when product loads
  useEffect(() => {
    if (product) {
      if (product.images && product.images.length > 0) {
        setActiveImage(product.images[0]);
      }
      if (product.colors && product.colors.length > 0) {
        setSelectedColor(product.colors[0]);
      } else {
        setSelectedColor('Standard');
      }
    }
  }, [product, slug]);

  if (productsLoading) {
    return (
      <div className="min-h-screen bg-[#FDF8F2] flex flex-col justify-between">
        <AnnouncementBar />
        <Navbar />
        <div className="flex-grow flex items-center justify-center p-8">
          <div className="text-center">
            <div className="w-10 h-10 border-4 border-[#B8860B] border-t-transparent rounded-full animate-spin mb-4 mx-auto" />
            <p className="font-serif italic text-base text-[#1C1008]">Polishing your selected handloom artifact...</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-[#FDF8F2] flex flex-col justify-between">
        <AnnouncementBar />
        <Navbar />
        <div className="flex-grow flex items-center justify-center p-8 max-w-sm mx-auto text-center">
          <div>
            <h2 className="font-serif text-2xl font-bold text-[#1C1008] mb-2 uppercase">Saree Not Found</h2>
            <p className="font-sans text-sm text-gray-500 mb-6">The item you are attempting to review may be currently deleted or out of stock.</p>
            <Link to="/collections/all" className="bg-[#7A1C2E] text-white py-3 px-6 rounded text-xs font-sans tracking-widest font-semibold uppercase">Browse Saree Catalogue</Link>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // Lookup Saree Collection Info
  const collectionObj = collections.find((c) => c.id === product.collectionId);
  const collectionName = collectionObj ? collectionObj.name : 'Exclusive Design';

  // Saree Price Discount details
  const discountPercent = Math.round(
    ((product.mrp - product.salePrice) / product.mrp) * 100
  );

  // Similar items (same collection except current item)
  const relatedSarees = products
    .filter((p) => p.collectionId === product.collectionId && p.id !== product.id && p.inStock)
    .slice(0, 4);

  const handleAddToCart = () => {
    addItem(product, selectedColor);
    setIsAddedFeedback(true);
    setTimeout(() => setIsAddedFeedback(false), 2000);
  };

  // "Pay Online" first collects delivery details (so we have somewhere to
  // ship the item and something to show in /admin), then hands off to
  // Razorpay.
  const handleOnlinePayment = () => {
    setPaymentError(null);
    setShowBuyerForm(true);
  };

  const handleBuyerFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!buyerName || !buyerPhone || !buyerAddress || !buyerPincode) {
      setPaymentError('Please fill in all delivery details to continue.');
      return;
    }
    if (buyerPhone.replace(/[^0-9]/g, '').length < 10) {
      setPaymentError('Please enter a valid 10-digit mobile number.');
      return;
    }

    const keyId = import.meta.env.VITE_RAZORPAY_KEY_ID?.trim();
    if (!keyId) {
      setPaymentError('Online payment is not configured. Add VITE_RAZORPAY_KEY_ID to your local .env file.');
      return;
    }

    setPaymentLoading(true);
    setPaymentError(null);

    try {
      if (!window.Razorpay) {
        await new Promise<void>((resolve, reject) => {
          const existingScript = document.querySelector('script[data-razorpay-checkout]');
          if (existingScript) {
            existingScript.addEventListener('load', () => resolve(), { once: true });
            existingScript.addEventListener('error', () => reject(new Error('Razorpay failed to load.')), { once: true });
            return;
          }

          const script = document.createElement('script');
          script.src = 'https://checkout.razorpay.com/v1/checkout.js';
          script.async = true;
          script.dataset.razorpayCheckout = 'true';
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Razorpay failed to load.'));
          document.body.appendChild(script);
        });
      }

      if (!window.Razorpay) throw new Error('Razorpay checkout is unavailable.');

      const checkout = new window.Razorpay({
        key: keyId,
        amount: Math.round(product.salePrice * 100),
        currency: 'INR',
        name: 'KALARANG Silks & Studio',
        description: product.name,
        image: '/kalarang.png',
        prefill: { name: buyerName, contact: buyerPhone },
        notes: { product_slug: product.slug, selected_colour: selectedColor || 'Standard' },
        theme: { color: '#7A1C2E' },
        handler: async (response: { razorpay_payment_id?: string }) => {
          // Payment succeeded on Razorpay's side — now save the order to
          // Supabase so it shows up in /admin/orders and on the customer's
          // /track-order page. Without this call, a successful payment had
          // no record anywhere.
          try {
            const orderId = await addOrder({
              customerName: buyerName,
              phone: buyerPhone.replace(/[^0-9]/g, ''),
              address: buyerAddress,
              pincode: buyerPincode,
              notes: '',
              items: [
                {
                  productId: product.id,
                  productName: product.name,
                  color: selectedColor || 'Standard',
                  image: imagesList[0] || '',
                  qty: 1,
                  price: product.salePrice,
                },
              ],
              subtotal: product.salePrice,
              shippingCharges: 0,
              total: product.salePrice,
              paymentMethod: 'online',
              paymentId: response.razorpay_payment_id,
            });
            setShowBuyerForm(false);
            setPaymentSuccessId(orderId);
          } catch (saveError) {
            console.error('Failed to save paid order:', saveError);
            setPaymentError(
              'Payment succeeded but we could not save your order automatically. ' +
              'Please contact us with your payment confirmation so we can log it manually.'
            );
          } finally {
            setPaymentLoading(false);
          }
        },
        modal: { ondismiss: () => setPaymentLoading(false) },
      });
      checkout.open();
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : 'Unable to open online payment.');
      setPaymentLoading(false);
    }
  };

  const showAddToCart = product.inStock && product.allowAddToCart !== false;

  const imagesList = product.images && product.images.length > 0 ? product.images : [
    'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=800&q=80'
  ];

  return (
    <div id={`product-detail-${slug}`} className="min-h-screen flex flex-col bg-[#FDF8F2]">
      <AnnouncementBar />
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8 flex-grow">
        
        {/* Navigation Breadcrumbs */}
        <div className="mb-6">
          <button 
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1.5 text-xs font-sans tracking-wider text-gray-500 hover:text-[#7A1C2E] uppercase font-bold cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" /> Go Back
          </button>
        </div>

        {/* Product Splitted Core View */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-start">
          
          {/* Saree Images Canvas / Gallery */}
          <div className="flex flex-col gap-4">
            <div className="relative aspect-[3/4] bg-[#E8D5B0]/25 border border-[#B8860B]/10 overflow-hidden rounded home-card">
              {showVideo && product.videoUrl ? (
                <video
                  src={product.videoUrl}
                  controls
                  className="w-full h-full object-cover"
                  poster={imagesList[0]}
                />
              ) : (
                <img
                  src={activeImage || imagesList[0]}
                  alt={product.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              )}
              
              {/* Sold out stamp on details */}
              {!product.inStock && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <span className="bg-[#1C1008] text-white border-2 border-[#B8860B] font-serif tracking-widest text-lg font-bold uppercase py-3.5 px-8 select-none">
                    Currently Selected Hand
                  </span>
                </div>
              )}
            </div>

            {/* Thumbnail Navigation Carousel */}
            {(imagesList.length > 1 || product.videoUrl) && (
              <div className="flex gap-3 overflow-x-auto pb-1">
                {product.videoUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowVideo(true);
                    }}
                    className={`relative w-20 aspect-[3/4] overflow-hidden rounded border-2 flex items-center justify-center bg-maroon/10 cursor-pointer ${
                      showVideo ? 'border-[#7A1C2E]' : 'border-[#B8860B]/10'
                    }`}
                  >
                    <span className="text-[10px] font-bold text-maroon uppercase">Video</span>
                  </button>
                )}
                {imagesList.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setShowVideo(false);
                      setActiveImage(img);
                    }}
                    className={`relative w-20 aspect-[3/4] overflow-hidden rounded bg-[#E8D5B0]/30 border-2 transition-all cursor-pointer ${
                      activeImage === img ? 'border-[#7A1C2E] scale-95 shadow-md' : 'border-[#B8860B]/10 hover:border-[#B8860B]/30'
                    }`}
                  >
                    <img 
                      src={img} 
                      alt={`Thumbnail view ${idx + 1}`} 
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover" 
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Saree Specifications Metadata Panel */}
          <div className="flex flex-col gap-6">
            
            {/* Header copy */}
            <div className="flex flex-col gap-2">
              <Link
                to={`/collections/${collectionObj?.slug || 'all'}`}
                className="text-xs tracking-[0.2em] text-[#B8860B] uppercase font-bold hover:text-[#7A1C2E] transition-colors"
              >
                {collectionName} Section
              </Link>
              <h1 className="font-serif text-2xl sm:text-3xl text-[#1C1008] font-bold tracking-normal leading-tight uppercase font-medium">
                {product.name}
              </h1>
              <div className="flex flex-wrap gap-2 items-center mt-2">
                <span className="bg-[#E8D5B0] text-[#1C1008] text-[10px] sm:text-xs font-semibold px-2.5 py-1 uppercase rounded tracking-wider">
                  Fabric: {product.fabric}
                </span>
                <span className="bg-green-700/10 text-green-800 text-[10px] sm:text-xs font-semibold px-2.5 py-1 uppercase rounded tracking-wider">
                  Traditional Design
                </span>
              </div>
            </div>

            {/* Pricing Section */}
            <div className="bg-[#E8D5B0]/35 border border-[#B8860B]/10 p-5 rounded-md">
              <div className="flex items-baseline gap-4">
                <span className="font-sans text-3xl font-extrabold text-[#7A1C2E]">
                  ₹{product.salePrice.toLocaleString('en-IN')}
                </span>
                {product.mrp > product.salePrice && (
                  <>
                    <span className="font-sans text-lg text-gray-400 line-through">
                      ₹{product.mrp.toLocaleString('en-IN')}
                    </span>
                    <span className="text-sm font-sans font-bold text-green-700">
                      You Save {discountPercent}%!
                    </span>
                  </>
                )}
              </div>
              <p className="text-[10px] sm:text-xs text-gray-500 mt-2 font-sans">
                Price is inclusive of all taxes. Free shipping applies above standard threshold values.
              </p>
            </div>

            {product.colors && product.colors.filter((c) => c && c !== 'Standard').length > 0 && (
              <div className="flex flex-col gap-3">
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#1C1008]">
                  Colour
                </p>
                <div className="flex flex-wrap gap-2">
                  {product.colors
                    .filter((c) => c && c !== 'Standard')
                    .map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setSelectedColor(color)}
                        className={`px-3.5 py-2 rounded text-xs font-semibold uppercase tracking-wider border transition-colors ${
                          selectedColor === color
                            ? 'bg-[#7A1C2E] text-white border-[#7A1C2E]'
                            : 'bg-white text-[#1C1008] border-[#B8860B]/25 hover:border-[#7A1C2E]'
                        }`}
                      >
                        {color}
                      </button>
                    ))}
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3.5 mt-2">
              {showAddToCart ? (
                <button
                  onClick={handleAddToCart}
                  className={`flex-1 py-4.5 px-6 rounded text-xs tracking-widest font-sans font-bold uppercase transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    isAddedFeedback
                      ? 'bg-green-700 text-white shadow-xl'
                      : 'bg-[#7A1C2E] hover:bg-[#1C1008] text-white shadow-md hover:shadow-lg'
                  }`}
                >
                  {isAddedFeedback ? (
                    <>
                      <Check className="h-4.5 w-4.5 animate-bounce" />
                      Added to Cart!
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="h-4.5 w-4.5 shrink-0" />
                      Add to Cart
                    </>
                  )}
                </button>
              ) : product.inStock ? null : (
                <button
                  disabled
                  className="flex-grow py-4.5 px-6 rounded text-xs tracking-widest font-sans font-bold uppercase cursor-not-allowed bg-gray-200 text-gray-400 flex items-center justify-center"
                >
                  Sold Out
                </button>
              )}

              <button
                onClick={handleOnlinePayment}
                disabled={paymentLoading || !product.inStock}
                className="flex-1 bg-[#7A1C2E] hover:bg-[#1C1008] disabled:opacity-60 text-white py-4.5 px-6 rounded text-xs tracking-widest font-sans font-bold uppercase transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                <CreditCard className="h-4.5 w-4.5 shrink-0" />
                {paymentLoading ? 'Opening Payment...' : 'Pay Online with Razorpay'}
              </button>
            </div>

            {paymentError && (
              <p className="text-xs text-[#7A1C2E] bg-[#E8D5B0]/25 border border-[#B8860B]/20 rounded p-3" role="status">
                {paymentError}
              </p>
            )}

            {/* Product details */}
            <div className="border-t border-[#B8860B]/10 pt-6">
              <h3 className="font-serif text-lg font-bold text-[#1C1008] uppercase mb-3 tracking-wider">
                Details
              </h3>
              {product.details ? (
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                  {product.details}
                </p>
              ) : (
                <p className="text-sm text-gray-500 italic">
                  Handcrafted saree from our {collectionName} collection.
                </p>
              )}
            </div>

            {/* Trust elements */}
            <div className="border-t border-[#B8860B]/10 pt-6 grid grid-cols-3 gap-2 text-center text-[10px] sm:text-xs text-gray-500 font-sans mt-4">
              <div className="flex flex-col items-center gap-1">
                <Truck className="h-5 w-5 text-[#B8860B]" />
                <span>Express delivery in India</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <ShieldCheck className="h-5 w-5 text-[#B8860B]" />
                <span>100% Genuine Loom Silk</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <RefreshCw className="h-5 w-5 text-[#B8860B]" />
                <span>Easy replacement support</span>
              </div>
            </div>

          </div>
        </div>

        {/* You May Also Like Section */}
        {relatedSarees.length > 0 && (
          <section id="related-sarees-carousel" className="border-t border-[#B8860B]/15 mt-16 pt-12">
            <div className="mb-8 text-center sm:text-left">
              <h2 className="font-serif text-2xl text-[#1C1008] tracking-wide uppercase font-bold">
                You May Also Like
              </h2>
              <div className="h-0.5 w-16 bg-[#B8860B] mt-1.5 mx-auto sm:mx-0" />
            </div>
            
            <ProductGrid products={relatedSarees} />
          </section>
        )}

      </div>

      {/* Buyer details modal — collected before Razorpay opens */}
      {showBuyerForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-[#FDF8F2] border-2 border-[#B8860B] rounded-lg max-w-md w-full p-6 shadow-xl">
            <h2 className="font-serif text-xl font-bold text-[#1C1008] uppercase mb-1">Delivery Details</h2>
            <p className="text-xs text-gray-500 mb-4 font-sans">
              We need this to ship your saree and confirm your payment.
            </p>
            <form onSubmit={handleBuyerFormSubmit} className="flex flex-col gap-3 font-sans">
              <input
                type="text"
                required
                placeholder="Full Name"
                value={buyerName}
                onChange={(e) => setBuyerName(e.target.value)}
                className="bg-white border border-[#B8860B]/25 rounded px-3.5 py-2.5 text-sm text-[#1C1008] focus:border-[#7A1C2E] focus:outline-none"
              />
              <input
                type="tel"
                required
                placeholder="10-digit mobile number"
                value={buyerPhone}
                onChange={(e) => setBuyerPhone(e.target.value)}
                className="bg-white border border-[#B8860B]/25 rounded px-3.5 py-2.5 text-sm text-[#1C1008] focus:border-[#7A1C2E] focus:outline-none"
              />
              <textarea
                required
                rows={2}
                placeholder="Shipping address"
                value={buyerAddress}
                onChange={(e) => setBuyerAddress(e.target.value)}
                className="bg-white border border-[#B8860B]/25 rounded px-3.5 py-2.5 text-sm text-[#1C1008] focus:border-[#7A1C2E] focus:outline-none resize-none"
              />
              <input
                type="text"
                required
                placeholder="Pincode"
                value={buyerPincode}
                onChange={(e) => setBuyerPincode(e.target.value)}
                className="bg-white border border-[#B8860B]/25 rounded px-3.5 py-2.5 text-sm text-[#1C1008] focus:border-[#7A1C2E] focus:outline-none"
              />

              {paymentError && (
                <p className="text-xs text-[#7A1C2E] bg-[#E8D5B0]/25 border border-[#B8860B]/20 rounded p-2.5">
                  {paymentError}
                </p>
              )}

              <div className="flex gap-2.5 mt-1">
                <button
                  type="button"
                  onClick={() => setShowBuyerForm(false)}
                  className="flex-1 py-3 rounded text-xs font-bold uppercase tracking-wider border border-[#B8860B]/30 text-[#1C1008]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={paymentLoading}
                  className="flex-1 py-3 rounded text-xs font-bold uppercase tracking-wider bg-[#7A1C2E] hover:bg-[#1C1008] disabled:opacity-60 text-white"
                >
                  {paymentLoading ? 'Opening Payment...' : 'Continue to Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Post-payment success modal */}
      {paymentSuccessId && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-[#FDF8F2] border-2 border-[#B8860B] rounded-lg max-w-md w-full p-6 shadow-xl text-center flex flex-col items-center gap-3">
            <Check className="h-12 w-12 text-green-700" />
            <h2 className="font-serif text-xl font-bold text-[#1C1008] uppercase">Payment Successful!</h2>
            <p className="text-sm text-gray-600 font-sans">Your order has been placed and recorded.</p>
            <code className="text-xs font-mono font-bold text-[#7A1C2E] uppercase select-all bg-white px-3 py-1.5 rounded border border-[#B8860B]/20">
              {paymentSuccessId}
            </code>
            <p className="text-xs text-gray-500 font-sans">
              You can check your order status anytime at{' '}
              <Link to="/track-order" className="text-[#7A1C2E] font-bold underline">
                Track Order
              </Link>{' '}
              using your mobile number.
            </p>
            <button
              onClick={() => setPaymentSuccessId(null)}
              className="mt-2 w-full py-3 rounded text-xs font-bold uppercase tracking-wider bg-[#7A1C2E] hover:bg-[#1C1008] text-white"
            >
              Done
            </button>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}