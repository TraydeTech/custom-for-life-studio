import { useLayoutEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

const positions = new Map<string, number>();

export default function ScrollToTop() {
  const location = useLocation();
  const navigationType = useNavigationType();
  useLayoutEffect(() => {
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    return () => { window.history.scrollRestoration = previous; };
  }, []);

  useLayoutEffect(() => {
    const position = navigationType === 'POP' ? positions.get(location.key) ?? 0 : 0;
    const remember = () => positions.set(location.key, window.scrollY);
    window.addEventListener('scroll', remember, { passive: true });
    const frame = requestAnimationFrame(() => window.scrollTo({ top: position, behavior: 'instant' }));
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', remember);
      if (positions.size > 100) positions.delete(positions.keys().next().value!);
    };
  }, [location.key, navigationType]);
  return null;
}
