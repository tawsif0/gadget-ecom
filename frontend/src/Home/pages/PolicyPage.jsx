import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { FiArrowLeft } from "react-icons/fi";
import { fetchPublicSettings } from "../../utils/publicSettings";
import { hasHtmlContent } from "../../utils/richText";

const normalizePolicyKey = (value) => {
  const key = String(value || "").trim().toLowerCase();
  if (key === "shipment") return "shipping";
  return key;
};

const POLICY_MAP = {
  shipping: {
    title: "Shipping Policy",
    key: "shipmentPolicy",
  },
  delivery: {
    title: "Delivery Policy",
    key: "deliveryPolicy",
  },
  terms: {
    title: "Terms & Conditions",
    key: "termsConditions",
  },
  return: {
    title: "Return Policy",
    key: "returnPolicy",
  },
  privacy: {
    title: "Privacy Policy",
    key: "privacyPolicy",
  },
  cancellation: {
    title: "Cancellation Policy",
    key: "cancellationPolicy",
  },
};

const policyContentClassName =
  "prose prose-slate max-w-none text-slate-700 " +
  "[&_h1]:mb-4 [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:tracking-tight [&_h1]:text-slate-900 " +
  "[&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-slate-900 " +
  "[&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:text-slate-900 " +
  "[&_p]:mt-4 [&_p]:leading-7 [&_p]:text-slate-700 " +
  "[&_ul]:mt-4 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5 " +
  "[&_ol]:mt-4 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-5 " +
  "[&_li]:leading-7 [&_li]:text-slate-700 " +
  "[&_a]:font-semibold [&_a]:text-slate-900 [&_a]:underline [&_a]:decoration-2 [&_a]:underline-offset-4 [&_a]:decoration-slate-400 " +
  "[&_blockquote]:mt-6 [&_blockquote]:rounded-2xl [&_blockquote]:border-l-4 [&_blockquote]:border-slate-300 [&_blockquote]:bg-slate-50 [&_blockquote]:px-4 [&_blockquote]:py-3 [&_blockquote]:text-slate-700 " +
  "[&_table]:mt-6 [&_table]:w-full [&_table]:overflow-hidden [&_table]:rounded-2xl [&_table]:border [&_table]:border-slate-200 " +
  "[&_th]:border [&_th]:border-slate-200 [&_th]:bg-slate-50 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_td]:border [&_td]:border-slate-200 [&_td]:px-3 [&_td]:py-2";

const createNotFoundPolicy = () => ({
  title: "Policy Not Found",
  key: "",
});

const PolicyPage = () => {
  const { policyType } = useParams();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState(null);

  const policyKey = normalizePolicyKey(policyType);
  const policy = POLICY_MAP[policyKey] || null;
  const policyPage = policy || createNotFoundPolicy();
  const isKnownPolicy = Boolean(policy);
  const content = policy
    ? String(settings?.policies?.[policy.key] || "").trim()
    : "";

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const data = await fetchPublicSettings();
        if (!cancelled) {
          setSettings(data);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="min-h-screen bg-white py-8 md:py-12 lg:py-16">
      <div className="site-container">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:border-gray-300 hover:text-black"
        >
          <FiArrowLeft className="h-4 w-4" />
          Back to home
        </Link>
      </div>

      <div className="site-shell py-10 sm:py-12 lg:py-14">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-3xl font-black tracking-tight text-gray-950 sm:text-4xl lg:text-5xl">
            {policyPage.title}
          </h1>
          <div className="mx-auto mt-5 h-px w-28 bg-gray-200" />
        </div>
      </div>

      <div className="site-container pb-16">
        <article className="mt-6 rounded-3xl border border-gray-200 bg-white p-5 shadow-xl sm:p-7">
          {loading ? (
            <div className="space-y-4">
              <div className="h-5 w-2/3 animate-pulse rounded-full bg-gray-200" />
              <div className="h-4 w-full animate-pulse rounded-full bg-gray-200" />
              <div className="h-4 w-11/12 animate-pulse rounded-full bg-gray-200" />
              <div className="h-4 w-10/12 animate-pulse rounded-full bg-gray-200" />
              <div className="h-4 w-9/12 animate-pulse rounded-full bg-gray-200" />
            </div>
          ) : content ? (
            hasHtmlContent(content) ? (
              <div
                className={policyContentClassName}
                dangerouslySetInnerHTML={{ __html: content }}
              />
            ) : (
              <div className={`${policyContentClassName} whitespace-pre-line`}>
                {content}
              </div>
            )
          ) : isKnownPolicy ? (
            <div className="rounded-[28px] border border-gray-200 bg-gray-50 p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-gray-500">
                No content yet
              </p>
              <p className="mt-2 text-base leading-7 text-gray-700">
                This policy has not been configured yet.
              </p>
            </div>
          ) : (
            <div className="rounded-[28px] border border-rose-200 bg-rose-50 p-6 text-rose-800">
              <p className="text-sm font-semibold uppercase tracking-[0.22em]">
                Not found
              </p>
              <p className="mt-2 text-base leading-7">
                The requested policy page is not available.
              </p>
            </div>
          )}
        </article>
      </div>
    </section>
  );
};

export default PolicyPage;
