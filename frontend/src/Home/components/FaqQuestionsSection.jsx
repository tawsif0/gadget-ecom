import React, { useMemo, useState } from "react";
import { FiChevronDown } from "react-icons/fi";
import usePublicSettings from "../../hooks/usePublicSettings";

const FaqQuestionsSection = ({ id = "faqs" } = {}) => {
  const { settings } = usePublicSettings();
  const contact = settings?.contact || {};

  const storeName =
    String(settings?.website?.storeName || "E-Commerce").trim() || "E-Commerce";
  const supportEmail = String(
    contact?.email || "support@marketplace.com.bd",
  ).trim();
  const supportPhone = String(contact?.phone1 || "+880 1700-000000").trim();

  const faqItems = useMemo(
    () => [
      {
        id: 1,
        question: "What payment methods do you accept?",
        answer:
          "We accept the payment methods currently enabled in your ecommerce checkout flow, including COD-ready setups and any other active payment options from the admin side.",
        category: "Payment",
      },
      {
        id: 2,
        question: "How long does shipping take?",
        answer:
          "Shipping time depends on delivery area, product setup, and the method selected during checkout. Buyers can also check the policy and contact pages for the latest support guidance.",
        category: "Shipping",
      },
      {
        id: 3,
        question: "How do I contact customer support?",
        answer: `You can contact the ${storeName} support team by email at ${supportEmail} or by phone at ${supportPhone}. These support details are controlled from website settings so the storefront always shows the latest contact information.`,
        category: "Support",
      },
      {
        id: 4,
        question: "Can I compare products before buying?",
        answer:
          "Yes. The storefront includes a compare feature so buyers can check product differences side by side before placing an order.",
        category: "Products",
      },
    ],
    [storeName, supportEmail, supportPhone],
  );

  const [openId, setOpenId] = useState(faqItems[0]?.id || null);
  const [activeCategory, setActiveCategory] = useState("All");

  const categories = ["All", "Payment", "Shipping", "Support", "Products"];
  const filteredFaqs = faqItems.filter(
    (item) => activeCategory === "All" || item.category === activeCategory,
  );

  const toggle = (questionId) => {
    setOpenId((current) => (current === questionId ? null : questionId));
  };

  return (
    <section id={id} className=" p-6  md:p-8">
      <div className="mb-8 text-center">
        <h2 className="text-2xl font-bold text-black md:text-3xl">
          Frequently Asked Questions
        </h2>
      </div>

      <div className="mb-8">
        <div className="flex flex-wrap justify-center gap-2 md:gap-3">
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setActiveCategory(category)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-all duration-300 md:px-6 md:py-3 ${
                activeCategory === category
                  ? "app-btn-primary shadow-lg"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {filteredFaqs.map((item) => {
          const isOpen = item.id === openId;
          return (
            <div
              key={item.id}
              className={`overflow-hidden rounded-2xl border border-gray-200 transition-all duration-300 ${
                isOpen ? "shadow-xl" : "hover:shadow-lg"
              }`}
            >
              <button
                type="button"
                onClick={() => toggle(item.id)}
                className="flex w-full items-start justify-between gap-4 bg-white p-6 text-left transition-colors duration-300 hover:bg-gray-50 md:p-8"
              >
                <div className="flex-1">
                  <div className="mb-2 flex items-center gap-3">
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                      {item.category}
                    </span>
                  </div>
                  <h3 className="pr-8 text-lg font-semibold text-black md:text-xl">
                    {item.question}
                  </h3>
                  {isOpen ? (
                    <p className="mt-4 line-clamp-2 text-gray-600">
                      {item.answer}
                    </p>
                  ) : null}
                </div>

                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all duration-300 ${
                    isOpen ? "rotate-180 bg-black" : "bg-gray-100"
                  }`}
                >
                  <FiChevronDown
                    className={`text-lg transition-transform duration-300 ${
                      isOpen ? "text-white" : "text-gray-600"
                    }`}
                  />
                </div>
              </button>

              {isOpen ? (
                <div className="bg-linear-to-b from-gray-50 to-white px-6 pb-6 md:px-8 md:pb-8">
                  <div className="border-l-2 border-black pl-6">
                    <p className="leading-relaxed text-gray-700">
                      {item.answer}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default FaqQuestionsSection;
