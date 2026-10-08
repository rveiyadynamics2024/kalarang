import React, { useEffect, useRef, useState } from 'react';
import { Star } from 'lucide-react';
import { motion } from 'motion/react';
import { testimonials } from '../../content/siteContent';
import CenteredSectionHeader from './CenteredSectionHeader';

export default function TestimonialsSection() {
  const reviewsRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    const reviews = reviewsRef.current;
    if (!reviews) return;

    const timer = window.setInterval(() => {
      if (isPaused) return;
      const halfway = reviews.scrollWidth / 2;
      if (reviews.scrollLeft >= halfway) {
        reviews.scrollLeft -= halfway;
      } else {
        reviews.scrollLeft += 1;
      }
    }, 35);

    return () => window.clearInterval(timer);
  }, [isPaused]);

  const reviewItems = [...testimonials.quotes, ...testimonials.quotes];

  return (
    <section id="testimonials" className="py-14 sm:py-20 bg-surface border-y border-border/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <CenteredSectionHeader title="Happy Customers" subtitle="Loved by our community" />

        <div
          ref={reviewsRef}
          className="flex gap-4 sm:gap-6 overflow-x-auto pb-2 scrollbar-hide"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          onFocus={() => setIsPaused(true)}
          onBlur={() => setIsPaused(false)}
          aria-label="Customer reviews"
        >
          {reviewItems.map((review, index) => (
            <motion.blockquote
              key={`${review.name}-${index}`}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.55, delay: (index % testimonials.quotes.length) * 0.08, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -8, transition: { duration: 0.25 } }}
              className="group shrink-0 w-[280px] sm:w-[300px] snap-start bg-cream border border-border/80 p-5 sm:p-6 flex flex-col gap-4 shadow-sm hover:shadow-[var(--shadow-soft-hover)] transition-shadow duration-300"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-sand flex items-center justify-center shrink-0 text-sm font-semibold text-tan">
                  {review.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}
                </div>
                <div className="flex gap-0.5 text-tan">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <motion.span
                      key={star}
                      initial={{ opacity: 0, scale: 0.5 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ delay: index * 0.08 + star * 0.04, duration: 0.2 }}
                    >
                      <Star className="h-3.5 w-3.5 fill-tan text-tan" />
                    </motion.span>
                  ))}
                </div>
              </div>
              <p className="text-sm text-muted leading-relaxed flex-grow">&ldquo;{review.quote}&rdquo;</p>
              <footer className="flex flex-col gap-1 text-xs font-semibold text-espresso uppercase tracking-wide">
                <span>{review.name}</span>
                <span className="text-[10px] font-medium tracking-[0.12em] text-muted normal-case">{review.location}</span>
              </footer>
            </motion.blockquote>
          ))}
        </div>
      </div>
    </section>
  );
}
