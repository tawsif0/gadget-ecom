import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import usePublicSettings from "../../hooks/usePublicSettings";

const isExternalLink = (value) =>
  /^https?:\/\//i.test(value) ||
  String(value || "").startsWith("mailto:") ||
  String(value || "").startsWith("tel:");

const normalizeLink = (value) => {
  const normalized = String(value || "").trim();
  if (!normalized || normalized === "#") return "";
  return normalized;
};

const buildNoticeItems = (storefront = {}, contact = {}, placement = "top") => {
  const quickLinks = Array.isArray(storefront?.navQuickLinks)
    ? storefront.navQuickLinks
        .map((entry) => ({
          kind: "link",
          label: String(entry?.label || "").trim(),
          path: normalizeLink(entry?.path),
        }))
        .filter((entry) => entry.label && entry.path && !entry.path.includes("top-categories"))
    : [];

  const trustBullets = Array.isArray(storefront?.trustBullets)
    ? storefront.trustBullets
        .map((entry) => ({
          kind: "text",
          label: String(entry || "").trim(),
        }))
        .filter((entry) => entry.label)
    : [];

  const supportPhone = String(contact?.phone1 || "").trim();
  const supportEmail = String(contact?.email || "").trim();
  const supportItems = [
    supportPhone
      ? {
          kind: "link",
          label: `Call ${supportPhone}`,
          path: `tel:${supportPhone.replace(/[^\d+]/g, "")}`,
        }
      : null,
    supportEmail
      ? {
          kind: "link",
          label: supportEmail,
          path: `mailto:${supportEmail}`,
        }
      : null,
  ].filter(Boolean);

  const orderedItems =
    placement === "bottom"
      ? [...trustBullets, ...quickLinks, ...supportItems]
      : [...quickLinks, ...trustBullets, ...supportItems];

  return orderedItems.length > 0
    ? orderedItems
    : [
        { kind: "text", label: "Fast marketplace discovery with office product wiring" },
        { kind: "link", label: "Shop Now", path: "/shop" },
        { kind: "link", label: "Track Order", path: "/track-order" },
      ];
};

const StorefrontNoticeBar = ({ placement = "top" }) => {
  const navigate = useNavigate();
  const { settings } = usePublicSettings();
  const storefront = settings?.storefront || {};
  const contact = settings?.contact || {};

  const items = useMemo(
    () => buildNoticeItems(storefront, contact, placement),
    [contact, placement, storefront],
  );

  const repeatedItems = useMemo(() => {
    const baseItems = [...items];
    while (baseItems.length < 10) {
      baseItems.push(...items);
    }
    return [...baseItems, ...baseItems].slice(0, Math.max(12, baseItems.length * 2));
  }, [items]);

  const isTop = placement === "top";
  const shellClassName = isTop
    ? "border-b border-white/10 bg-slate-950 text-white"
    : "border-y border-slate-200 bg-white text-slate-900";
  const pillClassName = isTop
    ? "border-white/15 bg-white/10 text-white hover:bg-white/14"
    : "border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100";
  const dotClassName = isTop ? "bg-white/75" : "bg-slate-500";

  const handleClick = (path) => {
    const target = normalizeLink(path);
    if (!target) return;

    if (isExternalLink(target)) {
      window.location.href = target;
      return;
    }

    navigate(target);

    if (typeof window !== "undefined") {
      const hash = target.includes("#") ? target.split("#")[1] : "";
      if (hash) {
        window.setTimeout(() => {
          document.getElementById(hash)?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }, 120);
      } else {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    }
  };

  return (
    <div className={shellClassName}>
      <style>
        {`
          @keyframes storefront-notice-scroll {
            from { transform: translate3d(0, 0, 0); }
            to { transform: translate3d(-50%, 0, 0); }
          }
        `}
      </style>
      <div className="relative overflow-hidden">
        <div
          className="flex w-max items-center gap-3 py-2 [animation:storefront-notice-scroll_30s_linear_infinite]"
          aria-label="Storefront notices"
        >
          {repeatedItems.map((item, index) => {
            const key = `${placement}-${item.kind}-${item.label}-${index}`;

            if (item.kind === "link") {
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleClick(item.path)}
                  data-scroll-top="true"
                  className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${pillClassName}`}
                >
                  <span className={`inline-block h-1.5 w-1.5 rounded-full ${dotClassName}`} />
                  <span>{item.label}</span>
                </button>
              );
            }

            return (
              <div
                key={key}
                className="inline-flex shrink-0 items-center gap-2 px-3 py-1.5 text-xs font-medium"
              >
                <span className={`inline-block h-1.5 w-1.5 rounded-full ${dotClassName}`} />
                <span>{item.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default StorefrontNoticeBar;
