/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowRight, FaShoppingBag, FaFire } from "react-icons/fa";
import axios from "axios";
import { toast } from "react-hot-toast";
import { FiEye } from "react-icons/fi";
import { getProductPricingDisplay } from "../../utils/productPricing";

const baseUrl = import.meta.env.VITE_API_URL;
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
  <div
    className={`${className} bg-linear-to-br from-gray-50 to-gray-100 flex items-center justify-center`}
  >
    <svg
      className="w-8 h-8 text-gray-300"
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

const BestSellingProducts = () => {
  const [groupedProducts, setGroupedProducts] = useState({});
  const [loading, setLoading] = useState(true);
  const [processingBuyNow, setProcessingBuyNow] = useState(null);
  const [activeCategory, setActiveCategory] = useState(null);
  const [showAllProducts, setShowAllProducts] = useState({});
  const navigate = useNavigate();

  // Fetch Best Selling products using PUBLIC route
  const fetchBestSellingProducts = async () => {
    try {
      const response = await axios.get(
        `${baseUrl}/products/public/type/Best%20Selling`,
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
        rating: product.rating || (Math.random() * 1.5 + 3.5).toFixed(1),
        reviewCount:
          product.reviewCount || Math.floor(Math.random() * 100) + 20,
      }));
    } catch (err) {
      console.error("Error fetching best selling products:", err);
      toast.error("Failed to load best selling products", {
        autoClose: 3000,
      });
      return [];
    }
  };

  // Group Best Selling products by category
  const groupProductsByCategory = (productsList) => {
    const grouped = {};

    productsList.forEach((product) => {
      const productCategory = product.category;

      if (!productCategory) return;

      let categoryId, categoryName;

      if (typeof productCategory === "object" && productCategory._id) {
        categoryId = productCategory._id;
        categoryName = productCategory.name || "Uncategorized";
      } else if (productCategory) {
        categoryId = productCategory;
        categoryName = "Uncategorized";
      } else {
        return;
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
          // Try to parse if it's a JSON string
          try {
            const parsedColors = JSON.parse(product.colors);
            if (Array.isArray(parsedColors)) {
              colorsArray = parsedColors;
            }
          } catch (e) {
            // If not JSON, split by comma or treat as single color
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
        image:
          product.images && product.images.length > 0
            ? product.images[0]
            : null,
        brand: product.brand,
        category: product.category,
        productType: product.productType,
        rating: product.rating,
        reviewCount: product.reviewCount,
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
        const productsData = await fetchBestSellingProducts();
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
        toast.error("Failed to load best selling products", {
          autoClose: 3000,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Function to handle Buy Now
  const handleBuyNow = async (productId) => {
    if (processingBuyNow === productId) return;

    setProcessingBuyNow(productId);
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        toast.error("Please login to proceed with purchase", {
          autoClose: 3000,
        });
        navigate("/login");
        return;
      }

      const response = await axios.post(
        `${baseUrl}/cart`,
        {
          productId: productId,
          quantity: 1,
          color: "",
          dimensions: "",
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (response.data.success) {
        toast.success("Added to cart! Redirecting to checkout...", {
          autoClose: 2000,
        });

        setTimeout(() => {
          navigate("/checkout");
        }, 1000);
      } else {
        throw new Error(response.data.message || "Failed to add to cart");
      }
    } catch (err) {
      console.error("Error in Buy Now:", err);
      toast.error(
        err.response?.data?.message || err.message || "Failed to proceed",
        {
          autoClose: 3000,
        },
      );
    } finally {
      setProcessingBuyNow(null);
    }
  };

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
            <div className="inline-flex items-center justify-center w-12 h-12 bg-gray-100 rounded-full mb-4">
              <FaFire className="w-6 h-6 text-gray-400" />
            </div>
            <h3 className="text-base font-semibold text-gray-600">
              Loading Best Selling Products
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Organizing by categories...
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
    <section className="bg-white py-10 md:py-14">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header Section */}
        <div className="text-center mb-8 md:mb-12">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center">
              <FaFire className="w-4 h-4 text-white" />
            </div>
            <span className="text-xs font-semibold text-gray-600 tracking-wider uppercase">
              Hot Sellers
            </span>
          </div>

          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-black mb-3 md:mb-4">
            Best Selling Products
          </h2>

          <div className="max-w-xl mx-auto">
            <p className="text-sm md:text-base text-gray-600 leading-relaxed">
              Shop our most popular products loved by thousands of customers
              worldwide, organized by category.
            </p>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="mb-8 md:mb-10">
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
                      ? "bg-gray-600 text-white shadow-md"
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
          <div className="mb-10 md:mb-12">
            {/* Category Header */}

            {/* Products Grid - Intelligently Centered */}
            <div className={`${getGridClasses(productCount, isExpanded)}`}>
              {displayProducts.map((product, index) => {
                const isProcessing = processingBuyNow === product.id;
                const pricing = getProductPricingDisplay(product);
                const cardMetaLine = getCardMetaLine(product);

                return (
                  <div
                    key={product.id}
                    className="group flex h-full w-full basis-[calc(33.333%-0.5rem)] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-1 hover:border-gray-300 hover:shadow-lg sm:basis-[calc(33.333%-0.75rem)] md:basis-[calc(25%-0.75rem)] lg:basis-[calc(20%-0.75rem)]"
                    style={{
                      animationDelay: `${index * 100}ms`,
                    }}
                  >
                    {/* Product Image */}
                    <div
                      className="relative overflow-hidden bg-linear-to-br from-gray-50 via-white to-gray-100 p-2 sm:p-2.5 cursor-pointer"
                      onClick={() => {
                        navigate(`/product/${product.id}`);
                        window.scrollTo(0, 0);
                      }}
                    >
                      <div className="relative aspect-square rounded-xl overflow-hidden bg-white shadow-sm ring-1 ring-gray-200/60">
                        <ProductImage
                          src={product.image}
                          alt={product.title}
                          className="h-full w-full object-contain transition-transform duration-500"
                        />
                        {/* Best Seller Badge */}
                        <div className="absolute top-2 left-2">
                          <span className="px-2 py-1 bg-red-600 text-white text-xs font-bold rounded-md">
                            BEST SELLING
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Product Info */}
                    <div className="flex flex-1 flex-col px-3 py-2.5 text-left sm:px-4 sm:py-3">
                      <div className="space-y-1">
                        <h3
                          className="line-clamp-2 cursor-pointer text-[13px] font-semibold leading-snug text-black hover:text-gray-700 sm:text-sm"
                          onClick={() => navigate(`/product/${product.id}`)}
                        >
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
                        <div className="flex items-baseline justify-start gap-2">
                          {pricing.isTba ? (
                            <div className="text-base font-black text-gray-900 sm:text-lg">
                              TBA
                            </div>
                          ) : pricing.hasDiscount ? (
                            <>
                              <div className="text-xs text-gray-400 line-through sm:text-sm">
                                {Number(pricing.previousPrice || 0).toFixed(2)}{" "}
                                Tk
                              </div>
                              <div className="text-base font-black text-black sm:text-lg">
                                {Number(pricing.currentPrice || 0).toFixed(2)}
                              </div>
                              <div className="text-xs font-semibold text-gray-600 sm:text-sm">
                                Tk
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="text-base font-black text-black sm:text-lg">
                                {Number(pricing.currentPrice || 0).toFixed(2)}
                              </div>
                              <div className="text-xs font-semibold text-gray-600 sm:text-sm">
                                Tk
                              </div>
                            </>
                          )}
                        </div>
                        <button
                          onClick={() => {
                            navigate(`/product/${product.id}`);
                            window.scrollTo(0, 0);
                          }}
                          className="flex h-8 w-full items-center justify-center gap-1 rounded-none bg-gray-900 px-3 text-xs font-semibold text-white transition hover:bg-black sm:h-9 sm:gap-2 sm:text-sm"
                        >
                          <FiEye className="text-xs sm:text-sm" />
                          <span>View Details</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom View All Button - Only show when not expanded */}
            {currentCategory.products.length > 3 && (
              <div className="mt-8 text-center">
                <button
                  onClick={() => toggleShowAll(activeCategory)}
                  className={`group inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg transition-all duration-300 hover:shadow-lg ${
                    isExpanded
                      ? "bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300"
                      : "bg-red-600 text-white hover:bg-red-700"
                  }`}
                >
                  <span>
                    {isExpanded
                      ? "Show Less"
                      : `View All ${currentCategory.products.length} Products`}
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

        {/* Empty State */}
        {currentCategory && currentCategory.products.length === 0 && (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FaFire className="w-8 h-8 text-gray-400" />
            </div>
            <h4 className="text-lg font-semibold text-gray-900 mb-2">
              No Best Selling Products Available
            </h4>
            <p className="text-gray-600 text-sm max-w-md mx-auto mb-6">
              We're currently updating this category with exciting best selling
              products.
            </p>
            <button
              onClick={() => navigate("/shop")}
              className="px-6 py-2.5 bg-black text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
            >
              Browse All Products
            </button>
          </div>
        )}
      </div>
    </section>
  );
};

export default BestSellingProducts;
