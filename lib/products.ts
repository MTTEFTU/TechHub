export type Product = {
  id: string;
  name: string;
  category: string;
  price: number;
  image: string;
  blurb: string;
  stock?: number;
  rating?: number;
};

export const products: Product[] = [
  {
    id: 'aurora-phone-14',
    name: 'Aurora Phone 14',
    category: 'Phones',
    price: 799,
    image:
      'https://images.unsplash.com/photo-1592286927505-1def25115558?w=800&q=80&auto=format&fit=crop',
    blurb: '6.4" OLED, 48MP camera, 2-day battery.',
  },
  {
    id: 'nimbus-book-pro',
    name: 'Nimbus Book Pro 14',
    category: 'Laptops',
    price: 1399,
    image:
      'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=800&q=80&auto=format&fit=crop',
    blurb: '14" 120Hz display, 32GB RAM, all-day battery.',
  },
  {
    id: 'echo-buds-air',
    name: 'Echo Buds Air',
    category: 'Audio',
    price: 149,
    image:
      'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=800&q=80&auto=format&fit=crop',
    blurb: 'Active noise cancelling, 30hr total playback.',
  },
  {
    id: 'orbit-watch-se',
    name: 'Orbit Watch SE',
    category: 'Wearables',
    price: 229,
    image:
      'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=80&auto=format&fit=crop',
    blurb: 'GPS, heart rate, 5-day battery life.',
  },
  {
    id: 'hub-cam-2',
    name: 'Hub Cam 2',
    category: 'Smart Home',
    price: 89,
    image:
      'https://images.unsplash.com/photo-1558002038-1055907df827?w=800&q=80&auto=format&fit=crop',
    blurb: '2K indoor security camera with night vision.',
  },
  {
    id: 'flux-tablet-11',
    name: 'Flux Tablet 11',
    category: 'Tablets',
    price: 549,
    image:
      'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=800&q=80&auto=format&fit=crop',
    blurb: '11" liquid retina display, stylus included.',
  },
];
