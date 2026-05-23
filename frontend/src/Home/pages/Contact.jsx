/* eslint-disable react-hooks/exhaustive-deps */
import React, { useMemo, useState } from "react";
import axios from "axios";
import {
  FiCheckCircle,
  FiClock,
  FiHeadphones,
  FiMail,
  FiMapPin,
  FiPhone,
  FiSend,
  FiUser,
} from "react-icons/fi";
import { toast } from "react-hot-toast";
import usePublicSettings from "../../hooks/usePublicSettings";
import { useThemeColors } from "../../hooks/useThemeColors";
import SearchableSelect from "../../components/SearchableSelect";
import RichTextEditor from "../../components/RichTextEditor";
import { stripHtml } from "../../utils/richText";
import FaqQuestionsSection from "../components/FaqQuestionsSection";

const baseUrl = import.meta.env.VITE_API_URL;

const subjectOptions = [
  { value: "order", label: "Order Inquiry" },
  { value: "support", label: "Product Support" },
  { value: "warranty", label: "Warranty Claim" },
  { value: "wholesale", label: "Wholesale" },
  { value: "other", label: "Other" },
];

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

const fallbackMapUrl =
  "https://www.google.com/maps?q=Dhaka+Bangladesh&output=embed";

const getMapLinkUrl = (addressLink, address = "") => {
  const directLink = withProtocol(addressLink);
  if (directLink) return directLink;
  if (address) {
    return `https://maps.google.com/?q=${encodeURIComponent(address)}`;
  }
  return "https://maps.google.com";
};

const getMapEmbedUrl = (addressLink, address = "") => {
  const directLink = withProtocol(addressLink);
  const fallbackQuery = String(address || "").trim();

  if (!directLink) {
    return fallbackQuery
      ? `https://www.google.com/maps?q=${encodeURIComponent(fallbackQuery)}&output=embed`
      : fallbackMapUrl;
  }

  try {
    const url = new URL(directLink);
    const hostname = url.hostname.replace(/^www\./i, "").toLowerCase();

    if (!hostname.includes("google.") && hostname !== "maps.app.goo.gl") {
      return directLink;
    }

    if (
      url.pathname.includes("/maps/embed") ||
      url.searchParams.get("output") === "embed"
    ) {
      return directLink;
    }

    const query = url.searchParams.get("q") || "";
    if (query) {
      return `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
    }

    return fallbackQuery
      ? `https://www.google.com/maps?q=${encodeURIComponent(fallbackQuery)}&output=embed`
      : fallbackMapUrl;
  } catch {
    return fallbackQuery
      ? `https://www.google.com/maps?q=${encodeURIComponent(fallbackQuery)}&output=embed`
      : fallbackMapUrl;
  }
};

const Contact = () => {
  const { settings } = usePublicSettings();
  const { themeColor, buttonTextColor } = useThemeColors();
  const website = settings?.website || {};
  const contact = settings?.contact || {};
  const storeName =
    String(website?.storeName || "E-Commerce").trim() || "E-Commerce";

  const [focusedField, setFocusedField] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "order",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const contactInfo = useMemo(
    () => ({
      email: String(contact?.email || "support@marketplace.com.bd").trim(),
      phone1: String(contact?.phone1 || "+880 1700-000000").trim(),
      phone2: String(contact?.phone2 || "").trim(),
      address: stripHtml(contact?.address) || "Dhaka 1215, Bangladesh",
      addressLink: getMapLinkUrl(
        contact?.addressLink,
        stripHtml(contact?.address),
      ),
      mapUrl: getMapEmbedUrl(contact?.addressLink, stripHtml(contact?.address)),
    }),
    [contact],
  );

  const handleChange = (event) => {
    setFormData((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const payload = {
      name: String(formData.name || "").trim(),
      email: String(formData.email || "").trim(),
      phone: String(formData.phone || "").trim(),
      subject:
        subjectOptions.find((option) => option.value === formData.subject)
          ?.label || "Other",
      message: String(formData.message || "").trim(),
    };

    if (
      !payload.name ||
      !payload.email ||
      !payload.subject ||
      !stripHtml(payload.message)
    ) {
      toast.error("Name, email, subject, and message are required");
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await axios.post(
        `${baseUrl}/contact-submissions`,
        payload,
      );
      if (!response.data?.success) {
        toast.error("Failed to send your message");
        return;
      }

      toast.success("Your message has been sent");
      setIsSubmitted(true);
      setFormData({
        name: "",
        email: "",
        phone: "",
        subject: "order",
        message: "",
      });
      window.setTimeout(() => setIsSubmitted(false), 3500);
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Failed to send your message",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const labelClass = (key) =>
    `text-xs font-bold tracking-wide ${
      focusedField === key
        ? "text-[var(--brand-theme-color)]"
        : "text-slate-600"
    }`;

  return (
    <main className="bg-[#f9f9f9] text-[#1a1c1c]">
      <section className="bg-white py-16 md:py-24">
        <div className="site-shell text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-[#172839] md:text-5xl">
            Get <span className="text-(--brand-theme-color)">in Touch</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-slate-600 md:text-lg">
            We're here to help with any questions about our products or your
            order. Our team typically responds within 24 hours.
          </p>
        </div>
      </section>

      <section className="py-14 md:py-20">
        <div className="site-shell">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-6">
            <div className="lg:col-span-7 rounded-xl bg-white p-7 shadow-[0_2px_12px_rgba(0,0,0,0.08)] md:p-10">
              {isSubmitted ? (
                <div className="py-10 text-center">
                  <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                    <FiCheckCircle className="text-3xl text-emerald-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-[#172839]">
                    Message Sent!
                  </h2>
                  <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
                    Thanks for reaching out. We will reply as soon as possible.
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsSubmitted(false)}
                    className="app-btn-primary mt-6 rounded-full px-8 py-3 text-sm font-semibold shadow-lg transition hover:scale-105 hover:opacity-95"
                    style={{
                      color: buttonTextColor,
                      backgroundColor: themeColor,
                    }}
                  >
                    Send Another Message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="flex flex-col gap-1">
                      <label className={labelClass("name")} htmlFor="name">
                        Name
                      </label>
                      <input
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        onFocus={() => setFocusedField("name")}
                        onBlur={() => setFocusedField("")}
                        placeholder="John Doe"
                        className="h-12 w-full rounded-lg border border-slate-200 bg-white px-4 outline-none transition focus:border-[#172839] focus:ring-4 focus:ring-[#172839]/10"
                        required
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className={labelClass("email")} htmlFor="email">
                        Email
                      </label>
                      <input
                        id="email"
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        onFocus={() => setFocusedField("email")}
                        onBlur={() => setFocusedField("")}
                        placeholder="john@example.com"
                        className="h-12 w-full rounded-lg border border-slate-200 bg-white px-4 outline-none transition focus:border-[#172839] focus:ring-4 focus:ring-[#172839]/10"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="flex flex-col gap-1">
                      <label className={labelClass("phone")} htmlFor="phone">
                        Phone Number
                      </label>
                      <input
                        id="phone"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        onFocus={() => setFocusedField("phone")}
                        onBlur={() => setFocusedField("")}
                        placeholder="+880 1234 567 890"
                        className="h-12 w-full rounded-lg border border-slate-200 bg-white px-4 outline-none transition focus:border-[#172839] focus:ring-4 focus:ring-[#172839]/10"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label
                        className={labelClass("subject")}
                        htmlFor="subject"
                      >
                        Subject
                      </label>
                      <SearchableSelect
                        value={formData.subject}
                        onChange={(value) =>
                          setFormData((current) => ({
                            ...current,
                            subject: value,
                          }))
                        }
                        options={subjectOptions}
                        placeholder="Select subject"
                        searchable={false}
                        className="min-w-0"
                        buttonClassName="h-12 w-full rounded-lg border border-slate-200 bg-white px-4 text-left outline-none transition focus:border-[#172839] focus:ring-4 focus:ring-[#172839]/10"
                        menuClassName="rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className={labelClass("message")} htmlFor="message">
                      Message
                    </label>
                    <div
                      onFocusCapture={() => setFocusedField("message")}
                      onBlurCapture={() => setFocusedField("")}
                    >
                      <RichTextEditor
                        value={formData.message}
                        onChange={(value) =>
                          setFormData((current) => ({
                            ...current,
                            message: value,
                          }))
                        }
                        placeholder="How can we help you today?"
                        minHeight={180}
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="app-btn-primary inline-flex h-14 w-full items-center justify-center gap-2 rounded-full px-10 text-sm font-semibold shadow-lg transition hover:scale-105 hover:opacity-95 active:scale-95 disabled:cursor-not-allowed disabled:opacity-70 md:w-auto"
                    style={{
                      color: buttonTextColor,
                      backgroundColor: themeColor,
                    }}
                  >
                    {isSubmitting ? (
                      <>
                        <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <FiSend />
                        Send Message
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>

            <div className="lg:col-span-5 space-y-6">
              <div className="rounded-xl bg-white p-6 shadow-[0_2px_12px_rgba(0,0,0,0.08)] transition hover:scale-[1.02]">
                <div className="flex items-start gap-4">
                  <div className="rounded-lg bg-[#172839]/5 p-3 text-(--brand-theme-color)">
                    <FiMapPin className="text-xl" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-[#172839]">
                      Our Store
                    </h3>
                    <p className="mt-2 text-sm text-slate-600">
                      {contactInfo.address}
                    </p>
                    <a
                      href={contactInfo.addressLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-(--brand-theme-color) hover:underline"
                    >
                      View on map <FiMapPin />
                    </a>
                  </div>
                </div>
              </div>

              <div className="rounded-xl bg-white p-6 shadow-[0_2px_12px_rgba(0,0,0,0.08)] transition hover:scale-[1.02]">
                <div className="flex items-start gap-4">
                  <div className="rounded-lg bg-[#172839]/5 p-3 text-(--brand-theme-color)">
                    <FiHeadphones className="text-xl" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-[#172839]">
                      Customer Support
                    </h3>
                    <p className="mt-2 text-sm text-slate-600">
                      Phone: {contactInfo.phone1}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      Email: {contactInfo.email}
                    </p>
                    {contactInfo.phone2 ? (
                      <p className="mt-1 text-sm text-slate-600">
                        Alternate: {contactInfo.phone2}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative h-112.5 w-full overflow-hidden bg-[#172839]/5">
        <div className="pointer-events-none absolute inset-0 z-10 bg-[#172839]/20" />
        <iframe
          title={`${storeName} location`}
          src={contactInfo.mapUrl}
          width="100%"
          height="450"
          style={{ border: 0 }}
          allowFullScreen=""
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="h-full w-full grayscale contrast-125"
        />
        <div className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2">
          <div className="flex flex-col items-center">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-full border-4 border-white shadow-xl"
              style={{ backgroundColor: themeColor }}
            >
              <FiMapPin className="text-2xl text-white" />
            </div>
            <div className="mt-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-[#172839] shadow-lg">
              {storeName}
            </div>
          </div>
        </div>
      </section>

      {/* FAQs (right after the big map) */}
      <FaqQuestionsSection id="faqs" />
    </main>
  );
};

export default Contact;
