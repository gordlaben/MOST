import { useState, useCallback, useRef } from 'react';

interface UseInViewOptions extends IntersectionObserverInit {
  triggerOnce?: boolean;
}

export function useInView({ triggerOnce = true, root = null, rootMargin = '0px', threshold = 0 }: UseInViewOptions = {}) {
  const [inView, setInView] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const ref = useCallback((node: HTMLDivElement | null) => {
    if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
    }

    if (node) {
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                setInView(true);
                if (triggerOnce) {
                    observer.disconnect();
                }
            } else {
                if (!triggerOnce) {
                    setInView(false);
                }
            }
        }, { root, rootMargin, threshold });

        observer.observe(node);
        observerRef.current = observer;
    }
  }, [triggerOnce, root, rootMargin, threshold]);

  return { ref, inView };
}
