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
    ],
    [storeName, supportEmail, supportPhone],
  );

  const [openId, setOpenId] = useState(faqItems[0]?.id || null);
  const [activeCategory, setActiveCategory] = useState("All");

  const categories = ["All", "Payment", "Shipping", "Support"];
  const filteredFaqs = faqItems.filter(
    (item) => activeCategory === "All" || item.category === activeCategory,
  );

  const toggle = (questionId) => {
    setOpenId((current) => (current === questionId ? null : questionId));
  };

  return (
    <section id={id} className="bg-[#f9f9f9] py-16 md:py-20">
      <div className="site-shell">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-[#172839] md:text-4xl">
            Frequently Asked Questions
          </h2>
          <p className="mt-3 text-sm text-slate-600 md:text-base">
            Quick answers powered by your live store contact details.
          </p>
        </div>

        <div className="mb-10 flex flex-wrap justify-center gap-2">
          {categories.map((category) => {
            const isActive = activeCategory === category;
            return (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category)}
                className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
                  isActive
                    ? "bg-(--brand-theme-color) text-(--brand-button-text-color) shadow-[0_12px_30px_var(--brand-theme-shadow)]"
                    : "bg-white text-slate-700 ring-1 ring-slate-200 hover:text-(--brand-theme-color)"
                }`}
              >
                {category}
              </button>
            );
          })}
        </div>

        <div className="mx-auto max-w-3xl space-y-4">
          {filteredFaqs.map((item) => {
            const isOpen = item.id === openId;
            return (
              <div
                key={item.id}
                className={`overflow-hidden rounded-xl border border-slate-200 bg-white transition ${
                  isOpen
                    ? "shadow-[0_2px_12px_rgba(0,0,0,0.08)]"
                    : "hover:shadow-md"
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggle(item.id)}
                  className="flex w-full items-start justify-between gap-4 p-6 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <p className="mb-2 inline-flex rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold tracking-wide text-slate-600">
                      {item.category}
                    </p>
                    <h3 className="text-lg font-bold text-[#172839] md:text-xl">
                      {item.question}
                    </h3>
                    {isOpen ? (
                      <p className="mt-3 text-sm leading-relaxed text-slate-600">
                        {item.answer}
                      </p>
                    ) : null}
                  </div>

                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition ${
                      isOpen
                        ? "border-(--brand-theme-color) bg-(--brand-theme-color) text-(--brand-button-text-color)"
                        : "border-slate-200 bg-white text-slate-600"
                    }`}
                  >
                    <FiChevronDown
                      className={`text-lg transition-transform ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    />
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default FaqQuestionsSection;
