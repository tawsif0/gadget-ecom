import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import LandingSectionProductCard from "./LandingSectionProductCard";
import { fetchHomeCatalog } from "../../utils/homeCatalog";
const INITIAL_VISIBLE_PRODUCTS = 4;

const SECTION_THEMES = {
  popular: {
    sectionClassName: "relative overflow-hidden bg-[#1B1C18] py-16 md:py-20",
    contentShellClassName: "home-showcase-section-shell",
    headerWrapClassName: "mb-12 text-center",
    eyebrowClassName:
      "home-showcase-label mb-3 block text-[10px] uppercase tracking-[0.4em] text-white/72",
    titleClassName:
      "text-3xl font-extrabold tracking-tight text-white md:text-4xl",
    descriptionClassName: "mx-auto mt-4 max-w-xl text-sm text-white/70",
    tabsWrapClassName: "mb-10 flex flex-wrap justify-center gap-2",
    activeTabClassName: "border-white bg-white text-[#1B1C18]",
    inactiveTabClassName:
      "border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white",
    buttonClassName:
      "border border-white/15 bg-white/5 text-white hover:bg-white hover:text-[#1B1C18]",
    buttonWrapClassName: "justify-center",
  },
  "hot-deals": {
    sectionClassName: "home-showcase-satin-glow py-16 md:py-24",
    contentShellClassName: "home-showcase-section-shell",
    headerWrapClassName: "mb-14 text-center",
    eyebrowClassName:
      "home-showcase-label mb-4 block text-[10px] uppercase tracking-[0.5em] text-[#1B1C18]",
    titleClassName:
      "mx-auto max-w-2xl text-3xl font-extrabold tracking-tight text-[#1B1C18] md:text-4xl",
    descriptionClassName: "mx-auto mt-5 max-w-md text-sm leading-7 text-[#4D4635]",
    tabsWrapClassName: "mb-12 flex flex-wrap justify-center gap-2",
    activeTabClassName: "bg-[#1B1C18] text-white border-[#1B1C18]",
    inactiveTabClassName:
      "border-[#D0C5AF] bg-white/80 text-[#4D4635] hover:border-[#1B1C18] hover:text-[#1B1C18]",
    buttonClassName:
      "bg-[#1B1C18] text-white hover:bg-[#2A2A2A] hover:text-white",
    buttonWrapClassName: "justify-center",
  },
  featured: {
    sectionClassName: "bg-white py-16 md:py-24",
    contentShellClassName: "home-showcase-section-shell home-showcase-section-shell--featured",
    headerWrapClassName: "mb-12 text-left",
    eyebrowClassName:
      "home-showcase-label mb-4 block text-[10px] uppercase tracking-[0.5em] text-[#1B1C18]",
    titleClassName:
      "max-w-2xl text-4xl font-extrabold leading-tight text-[#1B1C18] md:text-5xl",
    descriptionClassName: "mt-5 max-w-xl text-sm text-[#4D4635]",
    tabsWrapClassName: "mb-10 flex flex-wrap gap-2",
    activeTabClassName: "bg-[#1B1C18] text-white border-[#1B1C18]",
    inactiveTabClassName:
      "border-[#D0C5AF] bg-[#FBF9F3] text-[#4D4635] hover:border-[#1B1C18] hover:text-[#1B1C18]",
    buttonClassName:
      "rounded-none border-x-0 border-t-0 border-b border-[#1B1C18] bg-transparent text-[#1B1C18] hover:bg-transparent hover:text-black",
    buttonWrapClassName: "justify-start",
  },
  "best-selling": {
    sectionClassName: "bg-[#F5F3ED]/60 py-16 md:py-24",
    contentShellClassName: "home-showcase-section-shell",
    headerWrapClassName: "mb-14",
    eyebrowClassName:
      "home-showcase-label mb-5 inline-flex items-center gap-2 rounded-full border border-black/10 bg-black/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.3em] text-[#1B1C18]",
    titleClassName:
      "max-w-3xl text-4xl font-extrabold leading-[0.96] tracking-tight text-[#1B1C18] md:text-5xl",
    descriptionClassName: "mt-4 max-w-2xl text-base leading-7 text-[#4D4635]",
    tabsWrapClassName: "mb-12 flex flex-wrap gap-2",
    activeTabClassName: "bg-[#1B1C18] text-white border-[#1B1C18]",
    inactiveTabClassName:
      "border-[#D0C5AF] bg-white text-[#4D4635] hover:border-[#1B1C18] hover:text-[#1B1C18]",
    buttonClassName:
      "bg-[#1B1C18] text-white hover:bg-[#2A2A2A] hover:text-white",
    buttonWrapClassName: "justify-start",
  },
  latest: {
    sectionClassName: "relative overflow-hidden bg-white py-16 md:py-24",
    contentShellClassName: "home-showcase-section-shell",
    headerWrapClassName: "mb-16 text-center",
    eyebrowClassName:
      "home-showcase-label mb-3 block text-[10px] uppercase tracking-[0.6em] text-[#1B1C18]",
    titleClassName: "text-3xl font-extrabold tracking-tight text-[#1B1C18] md:text-4xl",
    descriptionClassName: "mx-auto mt-4 max-w-xl text-sm text-[#4D4635]",
    tabsWrapClassName: "mb-10 flex flex-wrap justify-center gap-2",
    activeTabClassName: "bg-[#1B1C18] text-white border-[#1B1C18]",
    inactiveTabClassName:
      "border-[#D0C5AF] bg-white/80 text-[#4D4635] hover:border-[#1B1C18] hover:text-[#1B1C18]",
    buttonClassName:
      "w-full justify-between rounded-2xl bg-[#1B1C18] px-8 py-6 text-[#FBF9F3] hover:bg-[#2A2A2A] hover:text-white",
    buttonWrapClassName: "justify-stretch",
  },
};

const groupProductsByCategory = (products) => {
  const grouped = {};

  products.forEach((product) => {
    const productCategory = product?.category;
    let categoryId = "general";
    let categoryName = "General";

    if (typeof productCategory === "object" && productCategory?._id) {
      categoryId = productCategory._id;
      categoryName = productCategory.name || categoryName;
    } else if (typeof productCategory === "string" && productCategory.trim()) {
      categoryId = productCategory;
    }

    if (!grouped[categoryId]) {
      grouped[categoryId] = {
        categoryName,
        products: [],
      };
    }

    grouped[categoryId].products.push(product);
  });

  return grouped;
};

const resolveSectionProducts = (section) => {
  if (!section || !Array.isArray(section.categories)) {
    return [];
  }

  return section.categories.flatMap((category) =>
    Array.isArray(category?.products) ? category.products : [],
  );
};

const normalizeProducts = (products) =>
  Array.isArray(products) ? products.filter(Boolean) : [];

const ProductShowcaseSection = ({
  sectionId,
  productType,
  products,
  eyebrow,
  title,
  description,
  badgeText = "",
  loadingTitle,
  loadingDescription = "Organizing by categories...",
  emptyTitle,
  emptyDescription = "Please check back soon for more products.",
  viewAllNoun = "Products",
  containerClassName = "product-rail-shell",
  variant = "popular",
}) => {
  const navigate = useNavigate();
  const [groupedProducts, setGroupedProducts] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState(null);
  const [expandedCategories, setExpandedCategories] = useState({});

  const theme = SECTION_THEMES[variant] || SECTION_THEMES.popular;

  useEffect(() => {
    let ignore = false;

    const applyProductState = (products) => {
      const grouped = groupProductsByCategory(products);
      const categoryIds = Object.keys(grouped);

      setGroupedProducts(grouped);
      setExpandedCategories(
        categoryIds.reduce((acc, categoryId) => {
          acc[categoryId] = false;
          return acc;
        }, {}),
      );
      setActiveCategory(categoryIds[0] || null);
    };

    const fetchProducts = async () => {
      try {
        setLoading(true);
        if (Array.isArray(products)) {
          applyProductState(normalizeProducts(products));
          return;
        }

        const catalog = await fetchHomeCatalog();
        if (ignore) return;

        const section = catalog?.sections?.[productType];
        const resolvedProducts = resolveSectionProducts(section);

        if (ignore) return;
        applyProductState(normalizeProducts(resolvedProducts));
      } catch (error) {
        console.error(`Error fetching ${productType} products:`, error);
        if (!ignore) {
          setGroupedProducts({});
          setActiveCategory(null);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    fetchProducts();

    return () => {
      ignore = true;
    };
  }, [productType, products, title]);

  const categories = useMemo(() => Object.keys(groupedProducts), [groupedProducts]);
  const currentCategory = activeCategory ? groupedProducts[activeCategory] : null;
  const isExpanded = activeCategory ? expandedCategories[activeCategory] : false;
  const visibleProducts = useMemo(() => {
    if (!currentCategory) return [];
    if (isExpanded) return currentCategory.products;
    return currentCategory.products.slice(0, INITIAL_VISIBLE_PRODUCTS);
  }, [currentCategory, isExpanded]);

  if (!loading && (!categories.length || !currentCategory)) {
    return null;
  }

  const toggleExpanded = () => {
    if (!activeCategory) return;
    setExpandedCategories((prev) => ({
      ...prev,
      [activeCategory]: !prev[activeCategory],
    }));
  };

  const handleViewDetails = (product) => {
    navigate(`/product/${product?._id || product?.id}`);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const renderEmptyState = (titleText, copyText) => (
    <div className="py-12 text-center">
      <h3 className={theme.titleClassName}>{titleText}</h3>
      <p className={`${theme.descriptionClassName} mt-3`}>{copyText}</p>
    </div>
  );

  return (
    <section id={sectionId} className={`${theme.sectionClassName} home-showcase-font`}>
      {variant === "popular" ? (
        <div className="pointer-events-none absolute inset-0 opacity-20">
          <div className="absolute -right-[10%] -top-[10%] h-[50%] w-[50%] rounded-full bg-[#D4AF37] blur-[120px]" />
        </div>
      ) : null}

      {variant === "latest" ? (
        <div className="home-latest-watermark text-[#1B1C18]">NEW</div>
      ) : null}

      <div className={`${containerClassName} relative z-10`}>
        <div className={theme.contentShellClassName}>
          <div className={theme.headerWrapClassName}>
            <div>
              <span className={theme.eyebrowClassName}>{eyebrow}</span>
              <h2 className={theme.titleClassName}>{title}</h2>
              {description ? (
                <p className={theme.descriptionClassName}>{description}</p>
              ) : null}
            </div>
          </div>

          {loading
            ? renderEmptyState(loadingTitle || `Loading ${title}`, loadingDescription)
            : null}

          {!loading && categories.length && currentCategory ? (
            <>
              <div className={theme.tabsWrapClassName}>
                {categories.map((categoryId) => {
                  const category = groupedProducts[categoryId];
                  const isActive = activeCategory === categoryId;

                  return (
                    <button
                      key={categoryId}
                      type="button"
                      onClick={() => setActiveCategory(categoryId)}
                      className={`home-showcase-label rounded-full border px-4 py-2 text-[11px] font-medium uppercase tracking-[0.22em] transition-all duration-200 ${
                        isActive ? theme.activeTabClassName : theme.inactiveTabClassName
                      }`}
                    >
                      {category.categoryName}
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-1 flex-col overflow-visible">
                <div className="home-showcase-grid">
                  {visibleProducts.map((product) => (
                    <LandingSectionProductCard
                      key={product?._id || product?.id}
                      product={product}
                      variant={variant}
                      badgeText={badgeText}
                      onViewDetails={handleViewDetails}
                    />
                  ))}
                </div>

                {currentCategory.products.length > INITIAL_VISIBLE_PRODUCTS ? (
                  <div className={`mt-12 flex ${theme.buttonWrapClassName}`}>
                    <button
                      type="button"
                      onClick={toggleExpanded}
                      className={`home-showcase-label inline-flex items-center gap-3 rounded-full border px-6 py-3 text-[11px] font-bold uppercase tracking-[0.28em] transition-all duration-300 ${theme.buttonClassName}`}
                    >
                      <span>
                        {isExpanded
                          ? "Show Less"
                          : variant === "latest"
                            ? `Explore ${viewAllNoun}`
                            : `View All ${viewAllNoun}`}
                      </span>
                      {variant === "latest" ? <span aria-hidden="true">-&gt;</span> : null}
                    </button>
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
};

export default ProductShowcaseSection;
