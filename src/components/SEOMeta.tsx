import { useEffect } from 'react';

interface SEOMetaProps {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: 'website' | 'product';
}

const SITE_NAME = 'Custom For Life Studio';
const DEFAULT_DESCRIPTION = 'Brindes personalizados com qualidade premium. Copos térmicos, camisetas, kits corporativos e muito mais com gravação a laser.';
const DEFAULT_IMAGE = '/og-image.jpg';

export function SEOMeta({ title, description, image, url, type = 'website' }: SEOMetaProps) {
  const fullTitle = title ? `${title} | ${SITE_NAME}` : SITE_NAME;
  const metaDescription = description || DEFAULT_DESCRIPTION;
  const metaImage = image || DEFAULT_IMAGE;
  const metaUrl = url || (typeof window !== 'undefined' ? window.location.href : '');

  useEffect(() => {
    document.title = fullTitle;

    const setMeta = (name: string, content: string, property = false) => {
      const attr = property ? 'property' : 'name';
      let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, name);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    setMeta('description', metaDescription);
    setMeta('og:title', fullTitle, true);
    setMeta('og:description', metaDescription, true);
    setMeta('og:image', metaImage, true);
    setMeta('og:url', metaUrl, true);
    setMeta('og:type', type, true);
    setMeta('og:site_name', SITE_NAME, true);
    setMeta('twitter:card', 'summary_large_image');
    setMeta('twitter:title', fullTitle);
    setMeta('twitter:description', metaDescription);
    setMeta('twitter:image', metaImage);
  }, [fullTitle, metaDescription, metaImage, metaUrl, type]);

  return null;
}
