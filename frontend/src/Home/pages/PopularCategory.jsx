/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FaFire, FaArrowRight, FaShoppingCart, FaClock } from "react-icons/fa";
import { FiEye } from "react-icons/fi";
import axios from "axios";
import { toast } from "react-hot-toast";

const baseUrl = import.meta.env.VITE_API_URL;
const getPricing = (product) => {
  const priceType = String(product?.priceType || "single");
  if (priceType === "tba") {
    return {
      isTba: true,
      hasDiscount: false,
      currentPrice: null,
      previousPrice: null,
    };
  }
  const currentPrice =
    Number(product?.salePrice) > 0
      ? Number(product.salePrice)
      : Number(product?.price || 0);
  const previousPrice = Number(product?.price || 0);
  const hasDiscount =
    priceType === "best" &&
    Number.isFinite(previousPrice) &&
    Number.isFinite(currentPrice) &&
    previousPrice > currentPrice;
  return { isTba: false, hasDiscount, currentPrice, previousPrice };
};
const getCardMetaLine = (product) =>
  product?.dimensions ? `Dim: ${product.dimensions}` : "";

// Helper function to get full image URL
const getFullImageUrl = (imagePath) => {
  if (!imagePath) return null;

  if (
    imagePath.startsWith("http://") ||
    imagePath.startsWith("https://") ||
    imagePath.startsWith("data:")
  ) {
    return imagePath;
  }

  if (imagePath.startsWith("/")) {
    return baseUrl ? `${baseUrl}${imagePath}` : imagePath;
  }

  if (imagePath && !imagePath.startsWith("/")) {
    return baseUrl
      ? `${baseUrl}/uploads/products/${imagePath}`
      : `/uploads/products/${imagePath}`;
  }

  return null;
};

// Simple fallback image component
const FallbackImage = ({ className, alt }) => (
  <div className={`${className} bg-gray-100 flex items-center justify-center`}>
    <svg
      className="w-8 h-8 text-gray-400"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
    <span className="sr-only">{alt || "No image available"}</span>
  </div>
);

// Image component with proper fallback
const ProductImage = ({ src, alt, className, onClick }) => {
  const [imgSrc, setImgSrc] = useState(getFullImageUrl(src));
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setImgSrc(getFullImageUrl(src));
    setHasError(false);
  }, [src]);

  const handleError = () => {
    setHasError(true);
    if (src && src.startsWith("/uploads/products/")) {
      const altUrl = `${baseUrl}${src}`;
      if (altUrl !== imgSrc) {
        setImgSrc(altUrl);
        setHasError(false);
      }
    }
  };

  if (hasError || !imgSrc) {
    return (
      <div onClick={onClick} className="cursor-pointer">
        <FallbackImage className={className} alt={alt} />
      </div>
    );
  }

  return (
    <img
      src={imgSrc}
      alt={alt}
      className={`${className} cursor-pointer`}
      onClick={onClick}
      onError={handleError}
      crossOrigin={
        imgSrc?.startsWith("http://") || imgSrc?.startsWith("https://")
          ? "anonymous"
          : undefined
      }
    />
  );
};

const PopularCategory = () => {
  const [groupedProducts, setGroupedProducts] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState(null);
  const [showAllProducts, setShowAllProducts] = useState({});
  const navigate = useNavigate();

  // Fetch Popular products using PUBLIC route
  const fetchPopularProducts = async () => {
    try {
      const response = await axios.get(
        `${baseUrl}/products/public/type/Popular`,
      );

      let productsData = [];
      if (response.data.success) {
        productsData = response.data.products || [];
      } else if (Array.isArray(response.data)) {
        productsData = response.data;
      } else if (response.data && Array.isArray(response.data.data)) {
        productsData = response.data.data;
      }

      // Add random ratings for demo
      return productsData.map((product) => ({
        ...product,
      }));
    } catch (err) {
      console.error("Error fetching popular products:", err);
      toast.error("Failed to load popular products", {
        autoClose: 3000,
      });
      return [];
    }
  };

  // Group Popular type products by category
  const groupProductsByCategory = (productsList) => {
    const grouped = {};

    productsList.forEach((product) => {
      const productCategory = product.category;

      if (!productCategory) return;

      let categoryId, categoryName;

      if (typeof productCategory === "object" && productCategory._id) {
        categoryId = productCategory._id;
        categoryName = productCategory.name || "Popular";
      } else if (productCategory) {
        categoryId = productCategory;
        categoryName = "Popular";
      } else {
        categoryId = "general";
        categoryName = "Popular";
      }

      if (!grouped[categoryId]) {
        grouped[categoryId] = {
          categoryName: categoryName,
          products: [],
        };
      }

      // Extract colors properly - handle both array and string formats
      let colorsArray = [];
      if (product.colors) {
        if (Array.isArray(product.colors)) {
          colorsArray = product.colors;
        } else if (typeof product.colors === "string") {
          try {
            const parsedColors = JSON.parse(product.colors);
            if (Array.isArray(parsedColors)) {
              colorsArray = parsedColors;
            }
          } catch (e) {
            colorsArray = product.colors.split(",").map((c) => c.trim());
          }
        }
      }

      grouped[categoryId].products.push({
        id: product._id,
        title: product.title,
        price: product.price || 0,
        salePrice: product.salePrice ?? null,
        priceType: product.priceType || "single",
        stock: Number(product.stock || 0),
        image:
          product.images && product.images.length > 0
            ? product.images[0]
            : null,
        brand: product.brand,
        category: product.category,
        productType: product.productType,
        colors: colorsArray,
        dimensions: product.dimensions || "",
      });
    });

    return grouped;
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const productsData = await fetchPopularProducts();
        const grouped = groupProductsByCategory(productsData);
        setGroupedProducts(grouped);

        // Initialize showAllProducts state
        const initialState = {};
        Object.keys(grouped).forEach((categoryId) => {
          initialState[categoryId] = false;
        });
        setShowAllProducts(initialState);

        // Set first category as active
        const firstCategory = Object.keys(grouped)[0];
        if (firstCategory) {
          setActiveCategory(firstCategory);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
        toast.error("Failed to load data", {
          autoClose: 3000,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const toggleShowAll = (categoryId) => {
    setShowAllProducts((prev) => ({
      ...prev,
      [categoryId]: !prev[categoryId],
    }));
  };

  // Calculate grid classes based on product count and expanded state
  const getGridClasses = () =>
    "flex flex-wrap justify-center items-stretch gap-2 sm:gap-3";

  // Get product count to display
  const getDisplayProducts = (products, isExpanded) => {
    if (isExpanded) return products;
    return products.slice(0, 3);
  };

  if (loading) {
    return (
      <section className="bg-white py-12 md:py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-gray-100 rounded-full mb-4 animate-pulse">
              <FaFire className="w-6 h-6 text-orange-500" />
            </div>
            <h3 className="text-base font-semibold text-gray-600">
              Loading Popular Products
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Discovering trending items...
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (!loading && Object.keys(groupedProducts).length === 0) {
    return null;
  }

  const categories = Object.keys(groupedProducts);
  const currentCategory = activeCategory
    ? groupedProducts[activeCategory]
    : null;
  const isExpanded = activeCategory ? showAllProducts[activeCategory] : false;
  const displayProducts = currentCategory
    ? getDisplayProducts(currentCategory.products, isExpanded)
    : [];
  const productCount = displayProducts.length;

  return (
    <section className="bg-white py-10 md:py-14 lg:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header Section */}
        <div className="text-center mb-8 md:mb-12 lg:mb-16">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center">
              <FaFire className="w-4 h-4 text-white" />
            </div>
            <span className="text-xs font-semibold text-gray-600 tracking-wider uppercase">
              Trending Now
            </span>
          </div>

          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-black mb-3 md:mb-4">
            Popular Products
          </h2>

          <div className="max-w-2xl mx-auto">
            <p className="text-sm md:text-base lg:text-lg text-gray-600 leading-relaxed">
              Discover our most sought-after items that everyone's talking
              about. Limited quantities available for these trending favorites.
            </p>
            <div className="mt-4 flex items-center justify-center gap-2">
              <div className="w-16 h-px bg-gray-300"></div>
              <span className="text-xs text-gray-500">FEATURED SELECTION</span>
              <div className="w-16 h-px bg-gray-300"></div>
            </div>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="mb-8 md:mb-10 lg:mb-12">
          <div className="flex flex-wrap justify-center gap-2">
            {categories.map((categoryId) => {
              const category = groupedProducts[categoryId];
              const isActive = activeCategory === categoryId;

              return (
                <button
                  key={categoryId}
                  onClick={() => setActiveCategory(categoryId)}
                  className={`px-3 py-2 rounded-lg transition-all duration-200 flex items-center gap-2 ${
                    isActive
                      ? "bg-black text-white shadow-md"
                      : "bg-gray-50 text-gray-700 hover:bg-gray-100 hover:shadow-sm"
                  }`}
                >
                  <span className="font-medium text-sm">
                    {category.categoryName}
                  </span>
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded-full ${
                      isActive
                        ? "bg-white/20 text-white"
                        : "bg-gray-200 text-gray-600"
                    }`}
                  >
                    {category.products.length}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Active Category Section */}
        {currentCategory && (
          <div className="mb-10 md:mb-12 lg:mb-14">
            {/* Products Grid */}
            <div className={`${getGridClasses(productCount, isExpanded)}`}>
              {displayProducts.map((product) => {
                const pricing = getPricing(product);
                const cardMetaLine = getCardMetaLine(product);
                return (
                  <div
                    key={product.id}
                    className="group relative flex h-full w-full basis-[calc(33.333%-0.5rem)] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-1 hover:border-gray-300 hover:shadow-lg sm:basis-[calc(33.333%-0.75rem)] md:basis-[calc(25%-0.75rem)] lg:basis-[calc(20%-0.75rem)]"
                    onClick={() => {
                      navigate(`/product/${product.id}`);
                      window.scrollTo(0, 0);
                    }}
                  >
                    {/* Popular Badge */}
                    <div className="absolute top-4 right-4 z-20">
                      <div className="px-3 py-1.5 bg-linear-to-r from-black to-gray-800 text-white text-xs font-bold rounded-full flex items-center gap-1">
                        <FaFire className="w-3 h-3" />
                        Trending
                      </div>
                    </div>

                    {/* Image Container */}
                    <div className="relative overflow-hidden bg-linear-to-br from-gray-50 via-white to-gray-100 p-2 sm:p-2.5">
                      <div className="relative aspect-square rounded-xl overflow-hidden bg-white shadow-sm ring-1 ring-gray-200/60">
                        <ProductImage
                          src={product.image}
                          alt={product.title}
                          className="h-full w-full object-contain transition-transform duration-500"
                          onClick={() => {
                            navigate(`/product/${product.id}`);
                            window.scrollTo(0, 0);
                          }}
                        />

                        {/* Gradient Overlay */}
                        <div className="absolute inset-0 bg-linear-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex flex-1 flex-col px-3 py-2.5 text-left sm:px-4 sm:py-3">
                      <div className="space-y-1">
                        <h3 className="line-clamp-2 cursor-pointer text-[13px] font-semibold leading-snug text-black transition-colors group-hover:text-gray-700 sm:text-sm">
                          {product.title}
                        </h3>
                        {product.brand ? (
                          <p className="text-xs text-gray-500 line-clamp-1">
                            {`Brand: ${product.brand}`}
                          </p>
                        ) : null}
                        {cardMetaLine ? (
                          <div className="flex items-center gap-2">
                            {cardMetaLine ? (
                              <p className="text-xs text-gray-500 line-clamp-1">
                                {cardMetaLine}
                              </p>
                            ) : null}
                          </div>
                        ) : null}
                      </div>

                      {/* Fixed Footer */}
                      <div className="mt-auto flex flex-col gap-2 border-t border-gray-100 pt-2.5">
                        {pricing.isTba ? (
                          <div className="text-base font-black text-gray-900 sm:text-lg">
                            TBA
                          </div>
                        ) : pricing.hasDiscount ? (
                          <div className="flex items-baseline justify-start gap-2">
                            <span className="text-xs text-gray-400 line-through sm:text-sm">
                              {Number(pricing.previousPrice || 0).toFixed(2)} Tk
                            </span>
                            <span className="text-base font-black text-black sm:text-lg">
                              {Number(pricing.currentPrice || 0).toFixed(2)}
                            </span>
                            <span className="text-xs font-semibold text-gray-600 sm:text-sm">
                              Tk
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-baseline justify-start gap-2">
                            <span className="text-base font-black text-black sm:text-lg">
                              {Number(pricing.currentPrice || 0).toFixed(2)}
                            </span>
                            <span className="text-xs font-semibold text-gray-600 sm:text-sm">
                              Tk
                            </span>
                          </div>
                        )}

                        <button
                          onClick={() => {
                            navigate(`/product/${product.id}`);
                            window.scrollTo(0, 0);
                          }}
                          className="flex h-8 w-full items-center justify-center gap-2 rounded-none bg-gray-900 text-xs font-semibold text-white transition hover:bg-black sm:h-9 sm:text-sm"
                        >
                          <FiEye className="w-3.5 h-3.5" />
                          <span>View Details</span>
                        </button>
                      </div>
                    </div>

                    {/* Hover Effect Border */}
                    <div className="pointer-events-none absolute inset-0 rounded-2xl border border-transparent transition-all duration-300 group-hover:border-gray-300"></div>
                  </div>
                );
              })}
            </div>

            {/* View All / Show Less Button */}
            {currentCategory.products.length > 3 && (
              <div className="mt-8 lg:mt-10 text-center">
                <button
                  onClick={() => toggleShowAll(activeCategory)}
                  className="group inline-flex items-center gap-2 px-5 py-2.5 bg-black text-white text-sm font-medium rounded-lg hover:bg-gray-900 transition-all duration-300 hover:shadow-lg"
                >
                  <span className="text-sm font-medium">
                    {isExpanded
                      ? "Show Less"
                      : `View All ${currentCategory.products.length} Popular Products`}
                  </span>
                  <FaArrowRight
                    className={`w-3 h-3 transition-transform ${
                      isExpanded
                        ? "rotate-180 group-hover:-translate-x-1"
                        : "group-hover:translate-x-1"
                    }`}
                  />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

export default PopularCategory;
