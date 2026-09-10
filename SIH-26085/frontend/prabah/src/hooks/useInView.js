import { useEffect, useRef, useState } from 'react';

/**
 * Custom hook for triggering animations when element enters viewport
 * Supports staggered animations for multiple elements
 */
export function useInView(options = {}) {
  const {
    threshold = 0.1,
    rootMargin = '0px 0px -100px 0px',
    triggerOnce = false,
  } = options;

  const ref = useRef(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          if (triggerOnce && ref.current) {
            observer.unobserve(ref.current);
          }
        } else if (!triggerOnce) {
          setIsInView(false);
        }
      },
      {
        threshold,
        rootMargin,
      }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      if (ref.current) {
        observer.unobserve(ref.current);
      }
    };
  }, [threshold, rootMargin, triggerOnce]);

  return [ref, isInView];
}

export default useInView;
