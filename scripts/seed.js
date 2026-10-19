const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');
const Product = require('../models/Product');
const Review = require('../models/Review');

dotenv.config();

const mongoURI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/web_review_hub';

const seedData = async () => {
  try {
    await mongoose.connect(mongoURI);
    console.log('[Seed] Connected to MongoDB');

    // Clean existing collections
    await User.deleteMany({});
    await Product.deleteMany({});
    await Review.deleteMany({});
    console.log('[Seed] Cleared existing data');

    // Create Master Admin, 3 Sub-Admins, and 3 Regular Users
    const masterAdmin = await User.create({
      name: 'Master Administrator',
      email: 'masteradmin@gmail.com',
      password: 'masteradmin123',
      role: 'master_admin'
    });

    const admins = await User.create([
      { name: 'Marcus Vance (Lead)', email: 'admin1@honnereviews.com', password: 'adminpassword123', role: 'admin' },
      { name: 'Elena Rostova', email: 'admin2@honnereviews.com', password: 'adminpassword123', role: 'admin' },
      { name: 'Kenji Sato', email: 'admin3@honnereviews.com', password: 'adminpassword123', role: 'admin' }
    ]);

    const users = await User.create([
      { name: 'Sarah Jenkins', email: 'sarah@buyer.com', password: 'password123', role: 'user' },
      { name: 'Alex Martinez', email: 'alex@buyer.com', password: 'password123', role: 'user' },
      { name: 'David Kim', email: 'david@buyer.com', password: 'password123', role: 'user' }
    ]);

    console.log('[Seed] Created master admin, 3 moderators, and 3 test buyers');

    // Seed consumer gadgets
    const products = await Product.create([
      {
        name: 'iPhone 16 Pro Max',
        brand: 'Apple',
        category: 'Smartphones',
        price: 1199,
        imageUrl: 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?auto=format&fit=crop&w=800&q=80',
        description: 'Titanium design, A18 Pro chip, 48MP Fusion camera system with 5x telephoto, Camera Control, and best-in-class battery life.',
        specs: {
          'Display': '6.9-inch Super Retina XDR OLED 120Hz',
          'Processor': 'A18 Pro (3nm)',
          'Camera': '48MP Main + 48MP Ultra-wide + 12MP 5x Telephoto',
          'Battery': 'Up to 33 hours video playback',
          'Weight': '227g'
        },
        createdBy: admins[0]._id
      },
      {
        name: 'Galaxy S25 Ultra',
        brand: 'Samsung',
        category: 'Smartphones',
        price: 1299,
        imageUrl: 'https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?auto=format&fit=crop&w=800&q=80',
        description: 'Snapdragon 8 Elite for Galaxy, built-in S Pen, anti-reflective Gorilla Armor 2, 200MP camera with enhanced AI zoom and editing.',
        specs: {
          'Display': '6.8-inch Dynamic AMOLED 2X 120Hz',
          'Processor': 'Snapdragon 8 Elite',
          'Camera': '200MP + 50MP 5x + 50MP Ultra-wide + 10MP 3x',
          'Battery': '5000 mAh with 45W charging',
          'S-Pen': 'Integrated with BLE'
        },
        createdBy: admins[0]._id
      },
      {
        name: 'Pixel 9 Pro XL',
        brand: 'Google',
        category: 'Smartphones',
        price: 1099,
        imageUrl: 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&w=800&q=80',
        description: 'Google Tensor G4 chip, 16GB RAM for on-device Gemini Nano, iconic camera bar with 50MP triple sensor system and 7 years of OS updates.',
        specs: {
          'Display': '6.8-inch Super Actua LTPO OLED',
          'Processor': 'Google Tensor G4 + Titan M2',
          'Camera': '50MP Main + 48MP Ultra-wide + 48MP 5x Telephoto',
          'Battery': '5060 mAh',
          'OS Support': '7 Years guaranteed'
        },
        createdBy: admins[0]._id
      },
      {
        name: 'MacBook Pro 16" (M4 Max)',
        brand: 'Apple',
        category: 'Laptops',
        price: 3499,
        imageUrl: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=800&q=80',
        description: 'Liquid Retina XDR display with nano-texture option, M4 Max chip with up to 16-core CPU and 40-core GPU, up to 24 hours of battery life.',
        specs: {
          'Display': '16.2-inch Liquid Retina XDR 1600 nits peak',
          'Chip': 'Apple M4 Max',
          'Memory': '36GB Unified Memory',
          'Storage': '1TB NVMe SSD',
          'Ports': '3x Thunderbolt 5, HDMI, SDXC, MagSafe 3'
        },
        createdBy: admins[0]._id
      },
      {
        name: 'XPS 14 (9440)',
        brand: 'Dell',
        category: 'Laptops',
        price: 1899,
        imageUrl: 'https://images.unsplash.com/photo-1593642632823-8f785ba67e45?auto=format&fit=crop&w=800&q=80',
        description: 'Seamless glass touchpad, capacitive touch function row, Intel Core Ultra 7 processor, and optional 3.2K OLED InfinityEdge touch display.',
        specs: {
          'Display': '14.5-inch 3.2K OLED 120Hz Touch',
          'Processor': 'Intel Core Ultra 7 155H',
          'GPU': 'NVIDIA GeForce RTX 4050 6GB',
          'Weight': '1.68 kg'
        },
        createdBy: admins[0]._id
      },
      {
        name: 'WH-1000XM5 Wireless Headphones',
        brand: 'Sony',
        category: 'Audio',
        price: 399,
        imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80',
        description: 'Industry-leading noise canceling with two processors and 8 microphones. Magnificent sound quality engineered with high-res audio LDAC.',
        specs: {
          'Driver': '30mm carbon fiber composite',
          'Noise Canceling': 'Dual Processor V1 + HD QN1',
          'Battery': '30 hours with ANC on',
          'Multipoint': 'Yes, connects to 2 devices simultaneously'
        },
        createdBy: admins[0]._id
      },
      {
        name: 'QuietComfort Ultra Headphones',
        brand: 'Bose',
        category: 'Audio',
        price: 429,
        imageUrl: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=800&q=80',
        description: 'Breakthrough spatialized audio with Bose Immersive Audio, world-class active noise cancellation, and CustomTune technology for personalized sound.',
        specs: {
          'Audio': 'Bose Immersive Audio Spatial Tech',
          'Microphones': 'Advanced beamforming array',
          'Battery': 'Up to 24 hours (18 with Immersive Audio)',
          'Bluetooth': '5.3 with Snapdragon Sound'
        },
        createdBy: admins[0]._id
      },
      {
        name: 'Apple Watch Ultra 2',
        brand: 'Apple',
        category: 'Wearables',
        price: 799,
        imageUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=80',
        description: 'Rugged 49mm titanium case, 3000 nits brightness display, dual-frequency precision GPS, customizable Action button, and 100m water resistance.',
        specs: {
          'Case': '49mm aerospace-grade titanium',
          'Brightness': '3000 nits peak',
          'Battery': 'Up to 36 hours regular / 72 hours low power',
          'Water Resistance': '100m, certified EN13319 for dive'
        },
        createdBy: admins[0]._id
      },
      {
        name: 'MX Master 3S Wireless Mouse',
        brand: 'Logitech',
        category: 'Accessories',
        price: 99,
        imageUrl: 'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?auto=format&fit=crop&w=800&q=80',
        description: '8,000 DPI track-on-glass optical sensor, Quiet Clicks with 90% noise reduction, and MagSpeed electromagnetic scrolling wheel.',
        specs: {
          'Sensor': 'Darkfield high precision (200 - 8000 DPI)',
          'Scroll Wheel': 'MagSpeed electromagnetic with Smartshift',
          'Buttons': '7 buttons including thumb wheel',
          'Battery': 'Up to 70 days on a full charge'
        },
        createdBy: admins[0]._id
      }
    ]);

    console.log('[Seed] Created gadgets across categories');

    // Seed realistic user reviews with headings, images, and likes/dislikes
    // Review 1: Positive on iPhone
    await Review.create({
      product: products[0]._id,
      user: users[0]._id,
      heading: 'Unmatched Battery Life and 48MP Low-Light Fidelity',
      rating: 5,
      comment: 'The battery life is exceptional on the 16 Pro Max. The camera control button took a day to get used to, but 48MP raw shots look unbelievable in low light.',
      images: ['https://images.unsplash.com/photo-1695048133142-1a20484d2569?auto=format&fit=crop&w=800&q=80'],
      likes: [users[1]._id, users[2]._id],
      dislikes: []
    });

    // Review 2: Honest balanced on Galaxy S25 Ultra
    await Review.create({
      product: products[1]._id,
      user: users[1]._id,
      heading: 'Anti-Reflective Gorilla Armor is Revolutionary',
      rating: 4,
      comment: 'Display anti-reflective coating is a genuine game changer under direct sunlight. Battery easily lasts 1.5 days. Downside: Samsung bloatware is still present.',
      images: ['https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?auto=format&fit=crop&w=800&q=80'],
      likes: [users[0]._id],
      dislikes: []
    });

    // Review 3: Positive on Sony WH-1000XM5
    await Review.create({
      product: products[5]._id,
      user: users[2]._id,
      heading: 'World-Class Noise Canceling for Long Flights',
      rating: 5,
      comment: 'Best ANC headphones on the market. Used them on a 14-hour flight and completely blocked turbine hum. Super lightweight on the ears.',
      images: ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80'],
      likes: [users[0]._id, users[1]._id],
      dislikes: []
    });

    // Review 4: Flagged test review (Already flagged by 2 Admins!)
    // Evaluator can test flagging as the 3rd admin to see it auto-remove!
    await Review.create({
      product: products[0]._id,
      user: users[2]._id,
      heading: 'SCAM WARNING FREE GIFTS',
      rating: 1,
      comment: 'DO NOT BUY SCAM WARNING!! Free gift cards available at click-here-fake-promo.xyz cheap discount codes promo spam.',
      images: [],
      likes: [],
      dislikes: [users[0]._id],
      flaggedBy: [admins[0]._id, admins[1]._id], // Currently 2 flags!
      isRemoved: false
    });

    // Review 5: Positive on Pixel 9 Pro XL
    await Review.create({
      product: products[2]._id,
      user: users[0]._id,
      heading: 'Pure Android Experience with Incredible AI Editing',
      rating: 5,
      comment: 'Gemini Nano works seamlessly on-device and Magic Editor makes photo cleanup instant. The display is bright and crisp.',
      images: ['https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&w=800&q=80'],
      likes: [users[1]._id],
      dislikes: []
    });

    // Review 6: Positive on MacBook Pro 16"
    await Review.create({
      product: products[3]._id,
      user: users[1]._id,
      heading: 'Unrivaled Performance and Battery Life for Developers',
      rating: 5,
      comment: 'Compiling large projects is instantaneous with M4 Max. The Liquid Retina XDR screen is stunning, and the battery lasts through full workdays.',
      images: ['https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=800&q=80'],
      likes: [users[2]._id],
      dislikes: []
    });

    // Review 7: Balanced on Dell XPS 14
    await Review.create({
      product: products[4]._id,
      user: users[2]._id,
      heading: 'Sleek Minimalist Ultrabook with Gorgeous OLED',
      rating: 4,
      comment: 'The 3.2K OLED panel is breathtaking and build quality feels top-tier. Capacitive touch keys take some adjustment.',
      images: ['https://images.unsplash.com/photo-1593642632823-8f785ba67e45?auto=format&fit=crop&w=800&q=80'],
      likes: [users[0]._id],
      dislikes: []
    });

    // Review 8: Positive on QuietComfort Ultra
    await Review.create({
      product: products[6]._id,
      user: users[0]._id,
      heading: 'Supremely Comfortable with Immersive Audio',
      rating: 5,
      comment: 'The spatial audio modes really widen the soundstage and the ear cups remain plush for hours of continuous wear.',
      images: ['https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=800&q=80'],
      likes: [users[1]._id],
      dislikes: []
    });

    // Review 9: Positive on Apple Watch Ultra 2
    await Review.create({
      product: products[7]._id,
      user: users[1]._id,
      heading: 'The Ultimate Adventure Smartwatch',
      rating: 5,
      comment: 'Battery easily hits 3 days on trail hikes. The 3000 nits display is crystal clear even in blinding direct sun.',
      images: ['https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=80'],
      likes: [users[2]._id],
      dislikes: []
    });

    // Review 10: Positive on MX Master 3S
    await Review.create({
      product: products[8]._id,
      user: users[2]._id,
      heading: 'The Ergonomic Productivity King',
      rating: 5,
      comment: 'MagSpeed wheel and ultra-quiet switches make this the quintessential mouse for editing and multitasking.',
      images: ['https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?auto=format&fit=crop&w=800&q=80'],
      likes: [users[0]._id],
      dislikes: []
    });

    // Recalculate and synchronize review stats on all seeded products
    for (const prod of products) {
      const pReviews = await Review.find({ product: prod._id, isRemoved: { $ne: true } });
      const pCount = pReviews.length;
      const pAvg = pCount > 0
        ? Number((pReviews.reduce((sum, r) => sum + r.rating, 0) / pCount).toFixed(1))
        : 0;
      await Product.findByIdAndUpdate(prod._id, {
        numReviews: pCount,
        totalReviews: pCount,
        reviewCount: pCount,
        averageRating: pAvg
      });
    }

    console.log('[Seed] Seeded initial reviews across all gadgets and synchronized product review counters');
    console.log('[Seed] Database successfully populated!');
    process.exit(0);
  } catch (err) {
    console.error('[Seed] Error during seeding:', err);
    process.exit(1);
  }
};

seedData();
