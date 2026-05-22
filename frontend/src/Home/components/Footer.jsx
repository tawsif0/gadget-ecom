import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiArrowRight } from "react-icons/fi";
import {
  FaArrowRotateLeft,
  FaChevronRight,
  FaEnvelope,
  FaFacebookF,
  FaGift,
  FaHeadset,
  FaInstagram,
  FaPhone,
  FaTruckFast,
  FaWhatsapp,
  FaYoutube,
} from "react-icons/fa6";
import { FaMapMarkerAlt } from "react-icons/fa";
import usePublicSettings from "../../hooks/usePublicSettings";
import { toPublicAssetUrl } from "../../utils/publicSettings";

const quickLinks = [
  { name: "Home", path: "/" },
  { name: "Shop", path: "/shop" },
  { name: "About Us", path: "/about" },
  { name: "Contact", path: "/contact" },
  { name: "FAQs", path: "/faqs" },
];

const policyLinks = [
  { name: "Shipping Policy", path: "/policy/shipping" },
  { name: "Delivery Policy", path: "/policy/delivery" },
  { name: "Terms & Conditions", path: "/policy/terms" },
  { name: "Return Policy", path: "/policy/return" },
  { name: "Privacy Policy", path: "/policy/privacy" },
];

const normalizeLogoMode = (value) =>
  String(value || "")
    .trim()
    .toLowerCase() === "text"
    ? "text"
    : "image";

const withProtocol = (value) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("mailto:") ||
    trimmed.startsWith("tel:")
  ) {
    return trimmed;
  }
  return `https://${trimmed}`;
};

const Footer = () => {
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();
  const lastScrollY = useRef(0);
  const [scrollDir, setScrollDir] = useState("down");
  const [isAtTop, setIsAtTop] = useState(true);
  const [isAtBottom, setIsAtBottom] = useState(false);
  const { settings } = usePublicSettings();

  const website = useMemo(() => settings?.website || {}, [settings]);
  const contact = useMemo(() => settings?.contact || {}, [settings]);
  const social = useMemo(() => settings?.social || {}, [settings]);
  const storefront = useMemo(() => settings?.storefront || {}, [settings]);

  const brandName =
    String(website?.storeName || "E-Commerce").trim() || "E-Commerce";
  const brandLogoMode = normalizeLogoMode(website?.logoMode);
  const brandLogo =
    brandLogoMode === "image" ? toPublicAssetUrl(website?.logoUrl || "") : "";
  const hasBrandLogoImage = Boolean(brandLogo);
  const brandLogoText =
    String(website?.logoText || "").trim() ||
    String(website?.storeName || "E-Commerce").trim();

  const socialLinks = [
    {
      label: "Facebook",
      href: withProtocol(social?.facebook),
      subtitle: "Follow our page",
      icon: (
        <FaFacebookF className="text-xl text-blue-400 group-hover:text-white" />
      ),
      iconWrap:
        "flex h-12 w-12 items-center justify-center rounded-full bg-blue-600/20 transition-colors duration-300 group-hover:bg-blue-500",
      hoverBorder: "hover:border-blue-500",
    },
    {
      label: "WhatsApp",
      href: withProtocol(social?.whatsapp),
      subtitle: "Chat with us",
      icon: (
        <FaWhatsapp className="text-xl text-green-400 group-hover:text-white" />
      ),
      iconWrap:
        "flex h-12 w-12 items-center justify-center rounded-full bg-green-600/20 transition-colors duration-300 group-hover:bg-green-500",
      hoverBorder: "hover:border-green-500",
    },
    {
      label: "Instagram",
      href: withProtocol(social?.instagram),
      subtitle: "See latest updates",
      icon: (
        <FaInstagram className="text-xl text-pink-400 group-hover:text-white" />
      ),
      iconWrap:
        "flex h-12 w-12 items-center justify-center rounded-full bg-pink-600/20 transition-colors duration-300 group-hover:bg-pink-500",
      hoverBorder: "hover:border-pink-500",
    },
    {
      label: "YouTube",
      href: withProtocol(social?.youtube),
      subtitle: "Watch our content",
      icon: (
        <FaYoutube className="text-xl text-red-400 group-hover:text-white" />
      ),
      iconWrap:
        "flex h-12 w-12 items-center justify-center rounded-full bg-red-600/20 transition-colors duration-300 group-hover:bg-red-500",
      hoverBorder: "hover:border-red-500",
    },
  ].filter((item) => item.href);

  const contactInfo = {
    address:
      String(contact?.address || "").trim() ||
      "Shop 12, Level 3, Bashundhara City, Panthapath, Dhaka 1215, Bangladesh",
    addressLink:
      withProtocol(contact?.addressLink) ||
      `https://maps.google.com/?q=${encodeURIComponent(
        String(
          contact?.address || "Bashundhara City Panthapath Dhaka Bangladesh",
        ).trim(),
      )}`,
    phone1: String(contact?.phone1 || "+880 1700-000000").trim(),
    phone2: String(contact?.phone2 || "").trim(),
    email: String(contact?.email || "support@marketplace.com.bd").trim(),
  };

  const footerCaption =
    String(storefront?.footerCaption || "").trim() ||
    "Built for Bangladesh ecommerce operations";
  const footerDescription =
    String(website?.tagline || "").trim() ||
    "Bangladesh-focused ecommerce store with secure checkout, reliable delivery, and organized shopping.";

  const handleNavigation = (path) => {
    navigate(path);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    const updateScrollState = () => {
      const y = window.scrollY || window.pageYOffset || 0;
      const doc = document.documentElement;
      const winHeight = window.innerHeight || 0;
      const docHeight = doc.scrollHeight || 0;

      const atTop = y <= 0;
      const atBottom = y + winHeight >= docHeight - 2;

      setIsAtTop(atTop);
      setIsAtBottom(atBottom);

      const delta = y - lastScrollY.current;
      if (Math.abs(delta) > 4) {
        setScrollDir(delta > 0 ? "down" : "up");
        lastScrollY.current = y;
      }
    };

    updateScrollState();
    window.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);

    return () => {
      window.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, []);

  return (
    <footer className="bg-white text-slate-900">
      <div className="border-b border-slate-200 py-8 md:py-10">
        <div className="site-shell">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: <FaTruckFast className="text-xl" />,
                title: "Fast Shipping",
                text: "Smooth delivery flow",
              },
              {
                icon: <FaArrowRotateLeft className="text-xl" />,
                title: "Easy Returns",
                text: "Simple return support",
              },
              {
                icon: <FaGift className="text-xl" />,
                title: "Offers And Discounts",
                text: "Fresh deals for shoppers",
              },
              {
                icon: <FaHeadset className="text-xl" />,
                title: "Customer Support",
                text: "Help when you need it",
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="flex items-center gap-4 rounded-xl p-4 transition-all duration-300 hover:bg-slate-100"
              >
                <div className="rounded-lg bg-slate-100 p-3">
                  {feature.icon}
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">
                    {feature.title}
                  </h3>
                  <p className="mt-1 text-sm text-slate-600">{feature.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="py-12 md:py-16">
        <div className="site-shell">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-12">
            <div className="lg:col-span-5">
              <div className="mb-8">
                <button
                  onClick={() => handleNavigation("/")}
                  className="inline-flex max-w-full cursor-pointer items-center text-left"
                >
                  {hasBrandLogoImage ? (
                    <img
                      src={brandLogo}
                      alt={brandName}
                      className="h-14 w-auto max-w-[220px] object-contain"
                    />
                  ) : (
                    <h2 className="text-3xl font-bold transition-opacity hover:opacity-90">
                      <span className="text-slate-900">{brandLogoText}</span>
                    </h2>
                  )}
                </button>
                <div className="mt-4 space-y-3 text-slate-600">
                  <p>{footerDescription}</p>
                </div>
              </div>

              <div className="space-y-4">
                <a
                  href={contactInfo.addressLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-start gap-3 transition-colors duration-200 hover:text-slate-950"
                >
                  <FaMapMarkerAlt className="mt-1 shrink-0 text-slate-500 group-hover:text-slate-900" />
                  <div>
                    <p className="font-medium text-slate-800 group-hover:text-slate-950">
                      Address
                    </p>
                    <p className="text-sm text-slate-600 group-hover:text-slate-700">
                      {contactInfo.address}
                    </p>
                  </div>
                </a>

                <div className="flex items-center gap-3">
                  <FaPhone className="shrink-0 text-slate-500" />
                  <div>
                    <p className="font-medium text-slate-800">Phone</p>
                    <div className="flex flex-wrap items-center gap-1 text-sm text-slate-600">
                      <a
                        href={`tel:${contactInfo.phone1.replace(/[^\d+]/g, "")}`}
                        className="transition-colors duration-200 hover:text-slate-900"
                      >
                        {contactInfo.phone1}
                      </a>
                      {contactInfo.phone2 ? (
                        <>
                          <span>,</span>
                          <a
                            href={`tel:${contactInfo.phone2.replace(/[^\d+]/g, "")}`}
                            className="transition-colors duration-200 hover:text-slate-900"
                          >
                            {contactInfo.phone2}
                          </a>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>

                <a
                  href={`mailto:${contactInfo.email}`}
                  className="group flex items-center gap-3 transition-colors duration-200 hover:text-slate-950"
                >
                  <FaEnvelope className="shrink-0 text-slate-500 group-hover:text-slate-900" />
                  <div>
                    <p className="font-medium text-slate-800 group-hover:text-slate-950">
                      Email
                    </p>
                    <p className="text-sm text-slate-600 group-hover:text-slate-700">
                      {contactInfo.email}
                    </p>
                  </div>
                </a>
              </div>
            </div>

            <div className="lg:col-span-3">
              <h4 className="mb-6 border-b border-slate-200 pb-2 text-lg font-bold text-slate-900">
                Quick Links
              </h4>
              <ul className="space-y-3">
                {quickLinks.map((link) => (
                  <li key={link.name}>
                    <button
                      onClick={() => handleNavigation(link.path)}
                      className="group flex w-full items-center gap-2 text-left text-slate-600 transition-colors duration-200 hover:text-slate-950"
                    >
                      <FaChevronRight className="text-xs opacity-0 transition-opacity group-hover:opacity-100" />
                      {link.name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="lg:col-span-4">
              <h4 className="mb-6 border-b border-slate-200 pb-2 text-lg font-bold text-slate-900">
                Connect With Us
              </h4>

              <div className="space-y-4">
                {socialLinks.length > 0 ? (
                  socialLinks.map((item) => (
                    <a
                      key={item.label}
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`group block rounded-xl border border-slate-200 bg-linear-to-br from-white to-slate-50 p-4 transition-all duration-300 hover:shadow-md ${item.hoverBorder}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={item.iconWrap}>{item.icon}</div>
                        <div>
                          <p className="font-medium text-slate-900">
                            {item.label}
                          </p>
                          <p className="text-sm text-slate-600">
                            {item.subtitle}
                          </p>
                        </div>
                      </div>
                    </a>
                  ))
                ) : (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                    Add your social links from Dashboard settings.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200 py-6 md:py-8">
        <div className="site-shell">
          <div className="flex flex-col items-center">
            <div className="text-center">
              <p className="text-sm text-slate-600">
                Copyright {currentYear} {brandName}. All rights reserved.
              </p>
              <p className="mt-1 text-xs text-slate-500">{footerCaption}</p>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-4 text-sm text-slate-600">
                {policyLinks.map((link) => (
                  <button
                    key={link.name}
                    onClick={() => handleNavigation(link.path)}
                    className="underline underline-offset-4 transition-colors hover:text-slate-950"
                  >
                    {link.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {!isAtTop && !isAtBottom ? (
        <button
          onClick={() => {
            if (scrollDir === "down") {
              const bottom =
                document.documentElement.scrollHeight - window.innerHeight;
              window.scrollTo({ top: bottom, behavior: "smooth" });
            } else {
              window.scrollTo({ top: 0, behavior: "smooth" });
            }
          }}
          className="group fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full border border-gray-300 bg-white text-black shadow-xl transition-all duration-300 hover:scale-110 hover:shadow-2xl"
          aria-label={scrollDir === "down" ? "Go to bottom" : "Back to top"}
        >
          <FiArrowRight
            className={`h-5 w-5 transition-transform duration-300 ${
              scrollDir === "down" ? "rotate-90" : "-rotate-90"
            }`}
          />
        </button>
      ) : null}
    </footer>
  );
};

export default Footer;
