import { useEffect } from 'react';

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
  url?: string;
  type?: 'website' | 'article' | 'product';
  product?: {
    price?: number;
    currency?: string;
    availability?: 'in stock' | 'out of stock' | 'preorder';
    sku?: string;
  };
}

const defaultSEO = {
  siteName: 'Ковка в Дворик',
  title: 'Ковка в Дворик — Интернет-магазин элементов художественной ковки',
  description: 'Более 8000 наименований кованых элементов и готовых изделий. Балясины, волюты, листья, виноград и другие элементы художественной ковки. Доставка по всей России.',
  keywords: 'ковка, кованые элементы, балясины, художественная ковка, кованые изделия, элементы ковки, ворота, ограждения, перила, заборы, декоративная ковка',
  image: '/images/hero-warehouse.png',
  url: 'https://kovka-dvorik.ru',
  locale: 'ru_RU',
};

export function SEO({
  title,
  description,
  keywords,
  image,
  url,
  type = 'website',
  product,
}: SEOProps) {
  const fullTitle = title 
    ? `${title} | ${defaultSEO.siteName}` 
    : defaultSEO.title;
  const fullDescription = description || defaultSEO.description;
  const fullKeywords = keywords || defaultSEO.keywords;
  const fullImage = image || defaultSEO.image;
  const fullUrl = url || defaultSEO.url;

  useEffect(() => {
    // Update document title
    document.title = fullTitle;

    // Helper function to update or create meta tag
    const updateMetaTag = (name: string, content: string, isProperty = false) => {
      const attribute = isProperty ? 'property' : 'name';
      let meta = document.querySelector(`meta[${attribute}="${name}"]`) as HTMLMetaElement;
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute(attribute, name);
        document.head.appendChild(meta);
      }
      meta.content = content;
    };

    // Basic meta tags
    updateMetaTag('description', fullDescription);
    updateMetaTag('keywords', fullKeywords);
    updateMetaTag('author', defaultSEO.siteName);
    updateMetaTag('robots', 'index, follow');

    // Open Graph tags
    updateMetaTag('og:title', fullTitle, true);
    updateMetaTag('og:description', fullDescription, true);
    updateMetaTag('og:image', fullImage, true);
    updateMetaTag('og:url', fullUrl, true);
    updateMetaTag('og:type', type, true);
    updateMetaTag('og:site_name', defaultSEO.siteName, true);
    updateMetaTag('og:locale', defaultSEO.locale, true);

    // Twitter Card tags
    updateMetaTag('twitter:card', 'summary_large_image');
    updateMetaTag('twitter:title', fullTitle);
    updateMetaTag('twitter:description', fullDescription);
    updateMetaTag('twitter:image', fullImage);

    // Product specific meta tags
    if (type === 'product' && product) {
      if (product.price) {
        updateMetaTag('product:price:amount', product.price.toString(), true);
        updateMetaTag('product:price:currency', product.currency || 'RUB', true);
      }
      if (product.availability) {
        updateMetaTag('product:availability', product.availability, true);
      }
    }

    // Canonical URL
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = fullUrl;

  }, [fullTitle, fullDescription, fullKeywords, fullImage, fullUrl, type, product]);

  return null;
}

// Schema.org JSON-LD for Organization
export function OrganizationSchema() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Ковка в Дворик',
    description: 'Интернет-магазин элементов художественной ковки',
    url: 'https://kovka-dvorik.ru',
    logo: 'https://kovka-dvorik.ru/images/logo.jpg',
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: '+7-959-111-00-00',
      contactType: 'sales',
      availableLanguage: 'Russian',
    },
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'ул. Лутугинская',
      addressLocality: 'Луганск',
      addressCountry: 'RU',
    },
    sameAs: [
      'https://vk.com/kovka_dvorik',
      'https://t.me/kovka_dvorik',
    ],
  };

  useEffect(() => {
    const existingScript = document.querySelector('script[data-schema="organization"]');
    if (existingScript) {
      existingScript.remove();
    }

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute('data-schema', 'organization');
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);

    return () => {
      script.remove();
    };
  }, []);

  return null;
}

// Schema.org JSON-LD for Product
interface ProductSchemaProps {
  name: string;
  description: string;
  image: string;
  sku: string;
  price: number;
  currency?: string;
  availability?: 'InStock' | 'OutOfStock' | 'PreOrder';
  category?: string;
  brand?: string;
  rating?: number;
  reviewCount?: number;
}

export function ProductSchema({
  name,
  description,
  image,
  sku,
  price,
  currency = 'RUB',
  availability = 'InStock',
  category,
  brand = 'Ковка в Дворик',
  rating,
  reviewCount,
}: ProductSchemaProps) {
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    description,
    image,
    sku,
    brand: {
      '@type': 'Brand',
      name: brand,
    },
    offers: {
      '@type': 'Offer',
      price,
      priceCurrency: currency,
      availability: `https://schema.org/${availability}`,
      seller: {
        '@type': 'Organization',
        name: 'Ковка в Дворик',
      },
    },
  };

  if (category) {
    schema.category = category;
  }

  if (rating && reviewCount) {
    schema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: rating,
      reviewCount: reviewCount,
    };
  }

  useEffect(() => {
    const existingScript = document.querySelector(`script[data-schema="product-${sku}"]`);
    if (existingScript) {
      existingScript.remove();
    }

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute('data-schema', `product-${sku}`);
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);

    return () => {
      script.remove();
    };
  }, [name, description, image, sku, price, currency, availability, category, brand, rating, reviewCount]);

  return null;
}

// Schema.org JSON-LD for BreadcrumbList
interface BreadcrumbItem {
  name: string;
  url: string;
}

export function BreadcrumbSchema({ items }: { items: BreadcrumbItem[] }) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };

  useEffect(() => {
    const existingScript = document.querySelector('script[data-schema="breadcrumb"]');
    if (existingScript) {
      existingScript.remove();
    }

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute('data-schema', 'breadcrumb');
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);

    return () => {
      script.remove();
    };
  }, [items]);

  return null;
}

// Schema.org JSON-LD for LocalBusiness
export function LocalBusinessSchema() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: 'Ковка в Дворик',
    description: 'Интернет-магазин элементов художественной ковки. Более 8000 наименований кованых элементов и готовых изделий.',
    image: 'https://kovka-dvorik.ru/images/hero-warehouse.png',
    telephone: '+7-959-111-00-00',
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'ул. Лутугинская',
      addressLocality: 'Луганск',
      addressCountry: 'RU',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: 48.5740,
      longitude: 39.3078,
    },
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        opens: '09:00',
        closes: '18:00',
      },
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Saturday', 'Sunday'],
        opens: '10:00',
        closes: '16:00',
      },
    ],
    priceRange: '₽₽',
  };

  useEffect(() => {
    const existingScript = document.querySelector('script[data-schema="localbusiness"]');
    if (existingScript) {
      existingScript.remove();
    }

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute('data-schema', 'localbusiness');
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);

    return () => {
      script.remove();
    };
  }, []);

  return null;
}

export default SEO;
