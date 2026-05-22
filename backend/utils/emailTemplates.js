// utils/emailTemplates.js
const nodemailer = require("nodemailer");

// Create reusable transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE,
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_SECURE === "true",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });
};

// Order status email template
const getOrderStatusEmailTemplate = (order, newStatus) => {
  const statusMessages = {
    pending: "is pending confirmation",
    confirmed: "has been confirmed",
    processing: "is now being processed",
    shipped: "has been shipped",
    delivered: "has been delivered successfully",
    cancelled: "has been cancelled",
    returned: "has been marked as returned",
  };

  const statusColors = {
    pending: "#FFA500",
    confirmed: "#0ea5e9",
    processing: "#3498db",
    shipped: "#9b59b6",
    delivered: "#2ecc71",
    cancelled: "#e74c3c",
    returned: "#f97316",
  };

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          background-color: #f5f5f5;
        }
        
        .container {
          max-width: 600px;
          margin: 0 auto;
          background: white;
          border-radius: 10px;
          overflow: hidden;
          box-shadow: 0 4px 20px rgba(0,0,0,0.1);
        }
        
        .header {
          background: #000000;
          color: white;
          padding: 30px 20px;
          text-align: center;
        }
        
        .header h1 {
          font-size: 28px;
          margin-bottom: 10px;
          font-weight: 600;
        }
        
        .header p {
          opacity: 0.9;
          font-size: 16px;
        }
        
        .content {
          padding: 30px;
        }
        
        .status-card {
          background: ${statusColors[newStatus] || "#3498db"};
          color: white;
          padding: 20px;
          border-radius: 8px;
          margin: 20px 0;
          text-align: center;
        }
        
        .status-card h2 {
          font-size: 22px;
          margin-bottom: 10px;
          font-weight: 600;
        }
        
        .order-number {
          font-size: 24px;
          font-weight: bold;
          letter-spacing: 2px;
          background: rgba(255,255,255,0.1);
          padding: 10px 20px;
          border-radius: 5px;
          display: inline-block;
          margin: 10px 0;
        }
        
        .info-section {
          background: #f8f9fa;
          padding: 20px;
          border-radius: 8px;
          margin: 25px 0;
          border-left: 4px solid #000;
        }
        
        .info-section h3 {
          color: #000;
          margin-bottom: 15px;
          font-size: 18px;
        }
        
        .product-table {
          width: 100%;
          border-collapse: collapse;
          margin: 20px 0;
          background: white;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 2px 10px rgba(0,0,0,0.05);
        }
        
        .product-table th {
          background: #f1f1f1;
          padding: 15px;
          text-align: left;
          font-weight: 600;
          color: #333;
          border-bottom: 2px solid #ddd;
        }
        
        .product-table td {
          padding: 15px;
          border-bottom: 1px solid #eee;
        }
        
        .product-table tr:last-child td {
          border-bottom: none;
        }
        
        .product-image {
          width: 60px;
          height: 60px;
          object-fit: cover;
          border-radius: 5px;
        }
        
        .summary {
          background: white;
          padding: 20px;
          border-radius: 8px;
          margin: 25px 0;
          border: 1px solid #eee;
        }
        
        .summary-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid #f1f1f1;
        }
        
        .summary-row:last-child {
          border-bottom: none;
          font-weight: bold;
          font-size: 18px;
          padding-top: 15px;
          color: #000;
        }
        
        .tracking-link {
          display: block;
          text-align: center;
          background: #000;
          color: white;
          padding: 15px;
          border-radius: 8px;
          text-decoration: none;
          font-weight: 600;
          margin: 25px 0;
          transition: all 0.3s ease;
        }
        
        .tracking-link:hover {
          background: #333;
        }
        
        .footer {
          text-align: center;
          padding: 25px;
          color: #666;
          font-size: 14px;
          background: #f8f9fa;
          border-top: 1px solid #eee;
        }
        
        .footer p {
          margin: 5px 0;
        }
        
        .contact-info {
          margin-top: 20px;
          padding-top: 20px;
          border-top: 1px solid #ddd;
        }
        
        @media (max-width: 600px) {
          .container {
            margin: 10px;
            border-radius: 5px;
          }
          
          .header {
            padding: 20px 15px;
          }
          
          .content {
            padding: 20px 15px;
          }
          
          .product-table {
            font-size: 14px;
          }
          
          .product-table th,
          .product-table td {
            padding: 10px;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Order Status Update</h1>
          <p>Your order status has been updated</p>
        </div>
        
        <div class="content">
          <div class="status-card">
            <h2>Order ${statusMessages[newStatus]}</h2>
            <div class="order-number">${order.orderNumber}</div>
            <p>Status: <strong>${newStatus.toUpperCase()}</strong></p>
          </div>
          
          <div class="info-section">
            <h3>Order Information</h3>
            <p><strong>Customer:</strong> ${order.shippingAddress?.firstName} ${order.shippingAddress?.lastName}</p>
            <p><strong>Email:</strong> ${order.shippingAddress?.email}</p>
            <p><strong>Phone:</strong> ${order.shippingAddress?.phone}</p>
            <p><strong>Order Date:</strong> ${new Date(
              order.createdAt,
            ).toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}</p>
          </div>
          
          <h3 style="color: #000; margin-bottom: 15px;">Order Items</h3>
          <table class="product-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Quantity</th>
                <th>Price</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${order.items
                .map(
                  (item) => `
                <tr>
                  <td>
                    <strong>${item.product?.title || "Product"}</strong>
                    ${item.color ? `<br><small>Color: ${item.color}</small>` : ""}
                    ${item.size ? `<br><small>Size: ${item.size}</small>` : ""}
                  </td>
                  <td>${item.quantity}</td>
                  <td>Tk ${item.price?.toFixed(2)}</td>
                  <td>Tk ${(item.quantity * item.price).toFixed(2)}</td>
                </tr>
              `,
                )
                .join("")}
            </tbody>
          </table>
          
          <div class="summary">
            <h3 style="color: #000; margin-bottom: 15px;">Order Summary</h3>
            <div class="summary-row">
              <span>Subtotal:</span>
              <span>Tk ${order.subtotal?.toFixed(2)}</span>
            </div>
            ${
              order.shippingFee > 0
                ? `
            <div class="summary-row">
              <span>Shipping Fee:</span>
              <span>Tk ${order.shippingFee?.toFixed(2)}</span>
            </div>
            `
                : ""
            }
            ${
              order.discount > 0
                ? `
            <div class="summary-row">
              <span>Discount:</span>
              <span>-Tk ${order.discount?.toFixed(2)}</span>
            </div>
            `
                : ""
            }
            <div class="summary-row">
              <span>Total Amount:</span>
              <span>Tk ${order.total?.toFixed(2)}</span>
            </div>
          </div>
          
          <a href="${process.env.FRONTEND_URL || "http://localhost:3000"}/track-order/${order.orderNumber}" class="tracking-link">
            Track Your Order
          </a>
          
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h4 style="color: #000; margin-bottom: 10px;">Shipping Address</h4>
            <p>${order.shippingAddress?.address}</p>
            <p>${order.shippingAddress?.city}, ${order.shippingAddress?.district || ""} ${order.shippingAddress?.postalCode}</p>
            <p>${order.shippingAddress?.country || "Bangladesh"}</p>
          </div>
        </div>
        
        <div class="footer">
          <p>Thank you for shopping with us!</p>
          <p>If you have any questions about your order, please contact our support team.</p>
          
          <div class="contact-info">
            <p><strong>Support Email:</strong> ${process.env.SUPPORT_EMAIL || "support@example.com"}</p>
            <p><strong>Support Phone:</strong> ${process.env.SUPPORT_PHONE || "+880 1XXX-XXXXXX"}</p>
          </div>
          
          <p style="margin-top: 20px; font-size: 12px; color: #999;">
            © ${new Date().getFullYear()} ${process.env.STORE_NAME || "E-Commerce Store"}. All rights reserved.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
};

const getStoreName = () =>
  String(process.env.STORE_NAME || "E-Commerce Store").trim();

const getFrontendBaseUrl = () =>
  String(process.env.FRONTEND_URL || "http://localhost:5173")
    .trim()
    .replace(/\/+$/, "");

const getSenderAddress = () =>
  String(
    process.env.EMAIL_FROM || process.env.EMAIL_USER || "no-reply@example.com",
  ).trim();

const isEmailConfigured = () =>
  Boolean(
    process.env.EMAIL_USER &&
    process.env.EMAIL_PASS &&
    (process.env.EMAIL_SERVICE || process.env.EMAIL_HOST),
  );

const formatMoney = (value) => `${Number(value || 0).toFixed(2)} Tk`;

const escapeHtml = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const summarizeText = (value, max = 220) => {
  const text = String(value || "").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max).trim()}...`;
};

const buildMailLayout = ({
  title,
  intro,
  detailsHtml = "",
  ctaLabel = "",
  ctaUrl = "",
}) => `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <style>
        body { margin:0; padding:0; background:#f5f5f5; font-family: Arial, sans-serif; color:#111; }
        .wrap { max-width:640px; margin:0 auto; padding:20px 12px; }
        .card { background:#fff; border:1px solid #e5e7eb; border-radius:12px; overflow:hidden; }
        .head { background:#000; color:#fff; padding:20px; }
        .body { padding:20px; }
        .meta { background:#fafafa; border:1px solid #e5e7eb; border-radius:10px; padding:14px; margin:14px 0; }
        .cta { display:inline-block; margin-top:8px; background:#000; color:#fff !important; text-decoration:none; padding:10px 14px; border-radius:8px; font-weight:600; }
        .foot { border-top:1px solid #e5e7eb; margin-top:16px; padding-top:12px; color:#6b7280; font-size:12px; }
      </style>
    </head>
    <body>
      <div class="wrap">
        <div class="card">
          <div class="head"><h2 style="margin:0;">${escapeHtml(title)}</h2></div>
          <div class="body">
            <p style="margin-top:0;">${escapeHtml(intro)}</p>
            <div class="meta">${detailsHtml}</div>
            ${
              ctaLabel && ctaUrl
                ? `<a class="cta" href="${escapeHtml(ctaUrl)}">${escapeHtml(ctaLabel)}</a>`
                : ""
            }
            <div class="foot">
              ${escapeHtml(getStoreName())} | Support: ${escapeHtml(
                process.env.SUPPORT_EMAIL || "support@example.com",
              )}
            </div>
          </div>
        </div>
      </div>
    </body>
  </html>
`;

const sendTransactionalEmail = async ({ to, subject, html }) => {
  const email = String(to || "")
    .trim()
    .toLowerCase();
  if (!email) return false;
  if (!isEmailConfigured()) {
    console.warn(`Email skipped (not configured): ${subject} -> ${email}`);
    return false;
  }

  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: `"${getStoreName()}" <${getSenderAddress()}>`,
      to: email,
      subject,
      html,
    });
    return true;
  } catch (error) {
    console.error(`Failed to send email: ${subject} -> ${email}`, error);
    return false;
  }
};

// Send order status email
const sendOrderStatusEmail = async (order, newStatus) => {
  const email = order?.shippingAddress?.email || order?.user?.email || "";
  const orderNumber = String(order?.orderNumber || "").trim();
  if (!email || !orderNumber) return false;

  return sendTransactionalEmail({
    to: email,
    subject: `Order #${orderNumber} status: ${String(newStatus || "").toUpperCase()}`,
    html: getOrderStatusEmailTemplate(order, newStatus),
  });
};

const sendOrderPlacedEmail = async (order) => {
  const email = order?.shippingAddress?.email || order?.user?.email || "";
  const orderNumber = String(order?.orderNumber || "").trim();
  if (!email || !orderNumber) return false;

  const fullName = `${order?.shippingAddress?.firstName || ""} ${
    order?.shippingAddress?.lastName || ""
  }`
    .trim()
    .replace(/\s+/g, " ");

  const itemsHtml = (order?.items || [])
    .slice(0, 8)
    .map((item) => {
      const title = escapeHtml(
        item?.product?.title || item?.title || "Product",
      );
      const qty = Number(item?.quantity || 1);
      const subtotal = formatMoney(Number(item?.price || 0) * qty);
      return `<p style="margin:4px 0;"><strong>${title}</strong> x ${qty} - ${subtotal}</p>`;
    })
    .join("");

  const ctaUrl = `${getFrontendBaseUrl()}/track-order/${encodeURIComponent(orderNumber)}`;

  return sendTransactionalEmail({
    to: email,
    subject: `Order received #${orderNumber}`,
    html: buildMailLayout({
      title: `Order Confirmed #${orderNumber}`,
      intro: `Thank you${fullName ? ` ${fullName}` : ""}. Your order has been placed successfully.`,
      detailsHtml: `
        <p style="margin:4px 0;"><strong>Order Number:</strong> ${escapeHtml(orderNumber)}</p>
        <p style="margin:4px 0;"><strong>Total:</strong> ${formatMoney(order?.total)}</p>
        <p style="margin:4px 0;"><strong>Payment:</strong> ${escapeHtml(
          order?.paymentMethod || "N/A",
        )}</p>
        <p style="margin:10px 0 6px;"><strong>Items:</strong></p>
        ${itemsHtml || "<p style='margin:4px 0;'>Items will appear in your order details.</p>"}
      `,
      ctaLabel: "Track Order",
      ctaUrl,
    }),
  });
};

const sendVendorConversationEmail = async ({
  recipientEmail,
  conversation,
  senderName = "",
  senderRole = "",
}) =>
  sendTransactionalEmail({
    to: recipientEmail,
    subject: `New message in conversation ${conversation?.conversationNumber || ""}`,
    html: buildMailLayout({
      title: "Vendor Message Update",
      intro: `${senderName || "A user"} (${senderRole || "member"}) sent a new message.`,
      detailsHtml: `
        <p style="margin:4px 0;"><strong>Conversation:</strong> ${escapeHtml(
          conversation?.conversationNumber,
        )}</p>
        <p style="margin:4px 0;"><strong>Subject:</strong> ${escapeHtml(
          conversation?.subject ||
            conversation?.product?.title ||
            "Conversation",
        )}</p>
        ${
          conversation?.messages?.length
            ? `<p style="margin:8px 0 0;"><strong>Latest message:</strong> ${escapeHtml(
                summarizeText(
                  conversation.messages[conversation.messages.length - 1]
                    ?.message,
                ),
              )}</p>`
            : ""
        }
      `,
      ctaLabel: "Open Messages",
      ctaUrl: `${getFrontendBaseUrl()}/dashboard`,
    }),
  });

const sendVendorContactEmail = async ({
  vendorName = "",
  vendorEmail = "",
  contact,
}) =>
  sendTransactionalEmail({
    to: vendorEmail,
    subject: `New contact message for ${vendorName || "your store"}`,
    html: buildMailLayout({
      title: "New Store Contact Message",
      intro: "A customer sent a message from your store page.",
      detailsHtml: `
        <p style="margin:4px 0;"><strong>Name:</strong> ${escapeHtml(contact?.name)}</p>
        <p style="margin:4px 0;"><strong>Email:</strong> ${escapeHtml(contact?.email)}</p>
        ${contact?.phone ? `<p style="margin:4px 0;"><strong>Phone:</strong> ${escapeHtml(contact.phone)}</p>` : ""}
        <p style="margin:4px 0;"><strong>Subject:</strong> ${escapeHtml(
          contact?.subject || "No subject",
        )}</p>
        <p style="margin:8px 0 0;"><strong>Message:</strong> ${escapeHtml(
          summarizeText(contact?.message, 600),
        )}</p>
      `,
      ctaLabel: "Open Dashboard",
      ctaUrl: `${getFrontendBaseUrl()}/dashboard`,
    }),
  });

const sendVendorContactAcknowledgementEmail = async ({
  recipientEmail = "",
  vendorName = "",
  subject = "",
}) =>
  sendTransactionalEmail({
    to: recipientEmail,
    subject: `Your message was sent to ${vendorName || "vendor"}`,
    html: buildMailLayout({
      title: "Message Received",
      intro: `Your message has been sent to ${vendorName || "the vendor"} successfully.`,
      detailsHtml: `
        <p style="margin:4px 0;"><strong>Store:</strong> ${escapeHtml(vendorName || "Vendor")}</p>
        <p style="margin:4px 0;"><strong>Subject:</strong> ${escapeHtml(subject || "No subject")}</p>
      `,
      ctaLabel: "Continue Shopping",
      ctaUrl: `${getFrontendBaseUrl()}/shop`,
    }),
  });

module.exports = {
  sendOrderStatusEmail,
  sendOrderPlacedEmail,
  sendVendorConversationEmail,
  sendVendorContactEmail,
  sendVendorContactAcknowledgementEmail,
  getOrderStatusEmailTemplate,
};
