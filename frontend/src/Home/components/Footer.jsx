import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaFacebookF,
  FaInstagram,
  FaWhatsapp,
  FaYoutube,
} from "react-icons/fa6";
import usePublicSettings from "../../hooks/usePublicSettings";
import { toPublicAssetUrl } from "../../utils/publicSettings";

const quickLinks = [
  { name: "Home", path: "/" },
  { name: "Shop All", path: "/shop" },
  { name: "Contact", path: "/contact" },
];

const policyLinks = [
  { name: "Privacy Policy", path: "/policy/privacy" },
  { name: "Terms of Service", path: "/policy/terms" },
  { name: "Shipping Info", path: "/policy/shipping" },
  { name: "Returns", path: "/policy/return" },
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
  const { settings } = usePublicSettings();

  const website = useMemo(() => settings?.website || {}, [settings]);
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
  const footerDescription =
    String(storefront?.footerCaption || "").trim() ||
    "Empowering your digital life with premium tech accessories built for the modern ecommerce flow.";

  const handleNavigation = (path) => {
    const target = String(path || "").trim() || "/";
    navigate(target);
    try {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      // ignore scroll failures
    }
  };

  const socialLinks = [
    {
      label: "Facebook",
      href: withProtocol(social?.facebook),
      icon: <FaFacebookF />,
    },
    {
      label: "WhatsApp",
      href: withProtocol(social?.whatsapp),
      icon: <FaWhatsapp />,
    },
    {
      label: "Instagram",
      href: withProtocol(social?.instagram),
      icon: <FaInstagram />,
    },
    {
      label: "YouTube",
      href: withProtocol(social?.youtube),
      icon: <FaYoutube />,
    },
  ].filter((link) => link.href);

  return (
    <footer className="w-full bg-white text-slate-900">
      <div className="border-t border-slate-200/70 bg-gradient-to-b from-white to-slate-50">
        <div className="site-shell grid grid-cols-1 gap-10 py-12 md:grid-cols-4 md:gap-10 md:py-16">
          <div className="flex flex-col gap-6">
            <button
              type="button"
              onClick={() => handleNavigation("/")}
              className="inline-flex items-center text-left"
            >
              {hasBrandLogoImage ? (
                <img
                  src={brandLogo}
                  alt={brandName}
                  className="h-10 w-auto max-w-[220px] object-contain"
                />
              ) : (
                <span className="text-xl font-extrabold tracking-tight text-slate-900">
                  {brandLogoText || brandName}
                </span>
              )}
            </button>

            <p className="text-sm leading-relaxed text-slate-600">
              {footerDescription}
            </p>

            {socialLinks.length ? (
              <div className="flex items-center gap-3">
                {socialLinks.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-[var(--brand-theme-color)] hover:text-[var(--brand-button-text-color)] hover:shadow-md"
                    aria-label={link.label}
                    title={link.label}
                  >
                    {link.icon}
                  </a>
                ))}
              </div>
            ) : null}
          </div>

          <div className="flex flex-col gap-4">
            <h5 className="text-sm font-extrabold tracking-wide text-slate-900">
              Quick Navigation
            </h5>
            <ul className="flex flex-col gap-2 text-sm text-slate-600">
              {quickLinks.map((link) => (
                <li key={link.path}>
                  <button
                    type="button"
                    onClick={() => handleNavigation(link.path)}
                    className="text-left transition hover:text-[var(--brand-theme-color)]"
                  >
                    {link.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col gap-4">
            <h5 className="text-sm font-extrabold tracking-wide text-slate-900">
              Policies & Support
            </h5>
            <ul className="flex flex-col gap-2 text-sm text-slate-600">
              {policyLinks.map((link) => (
                <li key={link.path}>
                  <button
                    type="button"
                    onClick={() => handleNavigation(link.path)}
                    className="text-left transition hover:text-[var(--brand-theme-color)]"
                  >
                    {link.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col gap-4">
            <h5 className="text-sm font-extrabold tracking-wide text-slate-900">
              Support
            </h5>
            <p className="text-sm leading-relaxed text-slate-600">
              Send a message from the contact page, then review the questions
              section right below the form.
            </p>
            <button
              type="button"
              onClick={() => handleNavigation("/contact")}
              className="app-btn-primary w-fit rounded-xl px-5 py-3 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 hover:opacity-95 hover:shadow-md"
            >
              Contact Us
            </button>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200/70 bg-slate-50 py-6">
        <div className="site-shell flex flex-col gap-2 text-xs text-slate-600 md:flex-row md:items-center md:justify-between">
          <p>
            © {currentYear} {brandName}. All rights reserved.
          </p>
          <a
            href={withProtocol("arbeittechnology.com")}
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-500 transition hover:text-[var(--brand-theme-color)] hover:underline"
          >
            Developed by Arbeit Technology
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
