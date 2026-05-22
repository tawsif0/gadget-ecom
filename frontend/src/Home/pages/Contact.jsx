import React, { useMemo, useState } from "react";
import axios from "axios";
import {
  FiCheckCircle,
  FiMail,
  FiMapPin,
  FiMessageSquare,
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

const baseUrl = import.meta.env.VITE_API_URL;

const subjectOptions = [
  { value: "support", label: "Technical Support" },
  { value: "sales", label: "Sales Inquiry" },
  { value: "billing", label: "Billing Question" },
  { value: "partnership", label: "Partnership" },
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

  const getCoordinateMatch = (value) => {
    const source = String(value || "");
    const atMatch = source.match(
      /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?:,(\d+(?:\.\d+)?)z?)?/i,
    );
    if (atMatch) {
      return {
        lat: atMatch[1],
        lng: atMatch[2],
        zoom: atMatch[3] || "",
      };
    }

    const dataMatch = source.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/i);
    if (dataMatch) {
      return {
        lat: dataMatch[1],
        lng: dataMatch[2],
        zoom: "",
      };
    }

    return null;
  };

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

    const coordinates = getCoordinateMatch(directLink);
    if (coordinates?.lat && coordinates?.lng) {
      const query = `${coordinates.lat},${coordinates.lng}`;
      const zoomPart = coordinates.zoom
        ? `&z=${encodeURIComponent(coordinates.zoom)}`
        : "";
      return `https://www.google.com/maps?q=${encodeURIComponent(query)}${zoomPart}&output=embed`;
    }

    let query =
      url.searchParams.get("q") ||
      url.searchParams.get("query") ||
      url.searchParams.get("destination") ||
      "";

    if (!query && url.pathname.includes("/place/")) {
      query = decodeURIComponent(
        url.pathname.split("/place/")[1]?.split("/")[0] || "",
      ).replace(/\+/g, " ");
    }

    if (!query) {
      query = fallbackQuery;
    }

    if (query) {
      return `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
    }

    return fallbackMapUrl;
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

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const contactInfo = useMemo(
    () => ({
      email: String(contact?.email || "support@marketplace.com.bd").trim(),
      phone1: String(contact?.phone1 || "+880 1700-000000").trim(),
      phone2: String(contact?.phone2 || "").trim(),
      address:
        stripHtml(contact?.address) ||
        "Shop 12, Level 3, Bashundhara City, Panthapath, Dhaka 1215, Bangladesh",
      addressLink: getMapLinkUrl(
        contact?.addressLink,
        stripHtml(contact?.address),
      ),
      mapUrl: getMapEmbedUrl(contact?.addressLink, stripHtml(contact?.address)),
    }),
    [contact],
  );

  const infoCards = [
    {
      icon: <FiMail className="text-xl" />,
      title: "Email Support",
      value: contactInfo.email,
      href: `mailto:${contactInfo.email}`,
    },
    {
      icon: <FiPhone className="text-xl" />,
      title: "Call Us",
      value: contactInfo.phone1,
      href: `tel:${contactInfo.phone1.replace(/\s+/g, "")}`,
    },
    {
      icon: <FiMapPin className="text-xl" />,
      title: "Visit Us",
      value: contactInfo.address,
      href: contactInfo.addressLink,
    },
  ];

  const handleChange = (event) => {
    setFormData((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const payload = {
      ...formData,
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
        subject: "",
        message: "",
      });
      window.setTimeout(() => setIsSubmitted(false), 5000);
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Failed to send your message",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="min-h-screen bg-white">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-white opacity-5" />
        <div className="site-container relative py-12 md:py-15">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="mb-4 text-3xl font-bold tracking-tight text-black md:text-4xl lg:text-5xl">
              Get In{" "}
              <span className="bg-linear-to-r from-gray-800 to-black bg-clip-text text-transparent">
                Touch
              </span>
            </h1>
            <p className="mx-auto mb-8 max-w-2xl text-base text-gray-600 md:text-lg">
              Send your question directly to the {storeName} team. Every form
              submission appears in the admin contacted-users list right away,
              just like the reference ecommerce site.
            </p>
          </div>
        </div>
      </div>

      <div className="site-container pb-16">
        <div className="mb-12 grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12 md:mb-20">
          <div className="space-y-8">
            <div className="rounded-3xl border border-gray-200 bg-linear-to-br from-white to-gray-50 p-6 shadow-xl md:p-8">
              <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:gap-4">
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full md:h-12 md:w-12"
                  style={{
                    backgroundColor: themeColor,
                    color: buttonTextColor,
                  }}
                >
                  <FiMessageSquare className="text-lg md:text-xl" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-black md:text-2xl">
                    Send us a message
                  </h2>
                  <p className="text-sm text-gray-600 md:text-base">
                    Your message appears in the admin contacted list right away.
                  </p>
                </div>
              </div>

              {isSubmitted ? (
                <div className="py-12 text-center">
                  <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
                    <FiCheckCircle className="text-4xl text-green-600" />
                  </div>
                  <h3 className="mb-3 text-2xl font-bold text-black">
                    Message Sent Successfully
                  </h3>
                  <p className="mb-6 text-gray-600">
                    Thank you for contacting us. The admin team has already
                    received your message.
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsSubmitted(false)}
                    className="app-btn-primary rounded-full px-6 py-3 font-medium transition-colors hover:scale-105"
                  >
                    Send Another Message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                        <FiUser className="text-gray-400" /> Full Name *
                      </label>
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        required
                        className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 transition-all duration-300 focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10"
                        placeholder="John Doe"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">
                        Email Address *
                      </label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        required
                        className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 transition-all duration-300 focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10"
                        placeholder="john@example.com"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 transition-all duration-300 focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10"
                        placeholder={contactInfo.phone1}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">
                        Subject *
                      </label>
                      <SearchableSelect
                        value={formData.subject}
                        onChange={(value) =>
                          setFormData((prev) => ({ ...prev, subject: value }))
                        }
                        options={[
                          { value: "", label: "Select a subject" },
                          ...subjectOptions,
                        ]}
                        placeholder="Select a subject"
                        searchable={false}
                        className="min-w-0"
                        buttonClassName="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 transition-all duration-300 focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10"
                        menuClassName="rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Your Message *
                    </label>
                    <RichTextEditor
                      value={formData.message}
                      onChange={(value) =>
                        setFormData((current) => ({
                          ...current,
                          message: value,
                        }))
                      }
                      placeholder="Tell us how we can help you..."
                      minHeight={220}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="app-btn-primary flex w-full items-center justify-center gap-3 rounded-xl py-4 font-semibold transition-all duration-300 hover:shadow-2xl disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <FiSend className="text-xl" />
                        Send Message
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>

          <div className="space-y-8">
            <div className="grid grid-cols-1 gap-4">
              {infoCards.map((card) => (
                <a
                  key={card.title}
                  href={card.href}
                  target={card.title === "Visit Us" ? "_blank" : undefined}
                  rel={
                    card.title === "Visit Us"
                      ? "noopener noreferrer"
                      : undefined
                  }
                  className="rounded-2xl border border-gray-200 bg-linear-to-br from-white to-gray-50 p-5 shadow-sm transition hover:shadow-lg"
                >
                  <div className="flex items-start gap-4">
                    <div
                      className="flex h-11 w-11 items-center justify-center rounded-2xl"
                      style={{
                        backgroundColor: themeColor,
                        color: buttonTextColor,
                      }}
                    >
                      {card.icon}
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-500">
                        {card.title}
                      </p>
                      <p className="mt-2 break-all text-sm font-medium text-black">
                        {card.value}
                      </p>
                    </div>
                  </div>
                </a>
              ))}
            </div>

            <div className="rounded-2xl border border-gray-200 bg-linear-to-br from-gray-50 to-white p-6">
              <h3 className="mb-6 text-xl font-bold text-black">
                Find Our Store
              </h3>
              <div className="overflow-hidden rounded-xl border border-gray-300 shadow-lg">
                <iframe
                  title={`${storeName} location`}
                  src={contactInfo.mapUrl}
                  width="100%"
                  height="320"
                  style={{ border: 0 }}
                  allowFullScreen=""
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="rounded-xl"
                />
              </div>
              {contactInfo.phone2 ? (
                <p className="mt-4 text-sm text-gray-600">
                  Alternate support line:{" "}
                  <span className="font-medium text-black">
                    {contactInfo.phone2}
                  </span>
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Contact;
