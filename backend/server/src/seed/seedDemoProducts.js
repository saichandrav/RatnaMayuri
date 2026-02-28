import Product from "../models/Product.js";

const demoProducts = [
  {
    name: "Kundan Bridal Necklace Set",
    category: "jewellery",
    subCategory: "Bridal",
    price: 45999,
    originalPrice: 52999,
    description:
      "Exquisite kundan bridal necklace set featuring intricate meenakari work with uncut polki diamonds. Includes matching earrings and maang tikka. Crafted by master artisans with 22K gold plating.",
    images: ["asset:product-necklace"],
    stock: 5,
    rating: 4.8,
    reviewCount: 124,
    isFeatured: true,
  },
  {
    name: "Temple Gold Jhumka Earrings",
    category: "jewellery",
    subCategory: "Temple",
    price: 12499,
    originalPrice: 14999,
    description:
      "Traditional temple-style jhumka earrings with pearl drops. Handcrafted in pure gold with antique finish. Perfect for weddings, festivals, and special occasions.",
    images: ["asset:product-earrings"],
    stock: 12,
    rating: 4.9,
    reviewCount: 89,
    isFeatured: true,
  },
  {
    name: "Antique Gold Bangles Set of 4",
    category: "jewellery",
    subCategory: "Antique",
    price: 18750,
    description:
      "Set of 4 antique-finish gold bangles with ruby and emerald stone embellishments. Traditional Rajasthani design with modern comfort fit.",
    images: ["asset:product-bangles"],
    stock: 15,
    rating: 4.6,
    reviewCount: 203,
    isFeatured: true,
  },
  {
    name: "Kanjeevaram Pure Silk Saree",
    category: "saree",
    subCategory: "Kanjeevaram",
    price: 2499,
    originalPrice: 2999,
    description:
      "Authentic Kanjeevaram pure silk saree with real zari work. Features traditional temple border and rich pallu with peacock motifs. Handwoven by master weavers.",
    images: ["asset:product-saree"],
    stock: 10,
    rating: 4.8,
    reviewCount: 156,
    isFeatured: true,
  },
];

export const seedDemoProducts = async seller => {
  if (!seller) {
    return;
  }

  const existing = await Product.findOne({ seller: seller.id });
  if (existing) {
    return;
  }

  const seeded = demoProducts.map(product => ({ ...product, seller: seller.id }));
  await Product.insertMany(seeded);
};
