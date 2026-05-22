import React, { useMemo, useState } from "react";
import { FaEnvelope, FaPhone } from "react-icons/fa";
import { FiChevronDown } from "react-icons/fi";
import usePublicSettings from "../../hooks/usePublicSettings";

const FAQ = () => {
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

  const toggle = (id) => {
    setOpenId((current) => (current === id ? null : id));
  };

  return (
    <section className="min-h-screen bg-white py-8 md:py-12 lg:py-16">
      <div className="site-container mb-8 md:mb-12 lg:mb-16">
        <div className="text-center mb-8 md:mb-12">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-black mb-4 tracking-tight">
            How Can We Help?
          </h1>
          <p className="text-gray-600 text-base md:text-lg max-w-2xl mx-auto mb-8">
            Find answers to common questions about shopping, shipping, returns,
            and comparing products before you buy.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-8 md:mb-12">
          {[
            {
              icon: <FaEnvelope className="text-2xl" />,
              title: "Email Support",
              description: "Get help via email",
              contactValue: supportEmail,
              action: `mailto:${supportEmail}`,
              bg: "bg-gradient-to-br from-gray-50 to-gray-100",
              featured: false,
            },
            {
              icon: <FaPhone className="text-2xl" />,
              title: "Call Us",
              description: "Speak with our team",
              contactValue: supportPhone,
              action: `tel:${supportPhone.replace(/\s+/g, "")}`,
              bg: "bg-gradient-to-br from-black to-gray-900",
              featured: true,
            },
          ].map((card) => (
            <a
              key={card.title}
              href={card.action}
              className={`${card.bg} rounded-2xl p-6 md:p-8 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl border border-gray-200 ${
                card.featured ? "text-white" : "text-black"
              }`}
            >
              <div className="flex items-start justify-between mb-6 gap-4">
                <div
                  className={`p-3 rounded-xl ${card.featured ? "bg-white/10" : "bg-black/5"}`}
                >
                  {card.icon}
                </div>
                <span
                  className={`text-xs font-semibold px-3 py-1 rounded-full break-all ${
                    card.featured ? "bg-white/20" : "bg-black/10"
                  }`}
                >
                  {card.contactValue}
                </span>
              </div>
              <h3 className="text-xl font-bold mb-2">{card.title}</h3>
              <p
                className={`text-sm ${card.featured ? "text-gray-300" : "text-gray-600"}`}
              >
                {card.description}
              </p>
            </a>
          ))}
        </div>

        <div className="mb-8 md:mb-12">
          <div className="flex flex-wrap gap-2 md:gap-3 justify-center">
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category)}
                className={`px-4 md:px-6 py-2 md:py-3 rounded-full text-sm font-medium transition-all duration-300 ${
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
      </div>

      <div className="site-container">
        <div className="mb-8 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-black mb-2">
            Frequently Asked Questions
          </h2>
          <p className="text-gray-600">
            {filteredFaqs.length}{" "}
            {filteredFaqs.length === 1 ? "question" : "questions"} found
          </p>
        </div>

        <div className="space-y-4">
          {filteredFaqs.map((item) => {
            const isOpen = item.id === openId;
            return (
              <div
                key={item.id}
                className={`border border-gray-200 rounded-2xl overflow-hidden transition-all duration-300 ${
                  isOpen ? "shadow-xl" : "hover:shadow-lg"
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggle(item.id)}
                  className="w-full text-left p-6 md:p-8 bg-white hover:bg-gray-50 transition-colors duration-300 flex items-start justify-between gap-4"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xs font-semibold px-3 py-1 bg-gray-100 text-gray-700 rounded-full">
                        {item.category}
                      </span>
                    </div>
                    <h3 className="text-lg md:text-xl font-semibold text-black pr-8">
                      {item.question}
                    </h3>
                    {isOpen ? (
                      <p className="mt-4 text-gray-600 line-clamp-2">
                        {item.answer}
                      </p>
                    ) : null}
                  </div>
                  <div
                    className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                      isOpen ? "bg-black rotate-180" : "bg-gray-100"
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
                  <div className="px-6 md:px-8 pb-6 md:pb-8 bg-linear-to-b from-gray-50 to-white">
                    <div className="pl-6 border-l-2 border-black">
                      <p className="text-gray-700 leading-relaxed">
                        {item.answer}
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default FAQ;
