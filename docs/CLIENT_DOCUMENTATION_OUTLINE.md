# E-Commerce Single Store — Client Documentation (Outline)

## 1. Introduction
- Product summary (single-store e-commerce)
- Who this document is for (Owner/Admin/Operations)
- Environments (Local / Staging / Production)

## 2. What’s Included (High-Level)
- Storefront (customer-facing website)
- Admin panel (dashboard)
- Backend API (Node.js/Express)
- Database (MongoDB)
- Media storage (Cloudinary + local uploads)

## 3. Customer Features (Storefront)
- Browse products, categories, brands
- Product details, images, reviews
- Cart + checkout
- Shipping calculation (shipping zones)
- Coupons/discounts
- Order placement + confirmation
- Order tracking
- User account: login/register, addresses, orders, wishlist
- Contact page / contact submissions
- Landing pages by slug
- Policies pages

## 4. Admin Features (Dashboard)
- Dashboard overview + notifications
- Website setup (branding/theme, pages, policies, landing pages)
- Products (create/modify), categories, brands, banners
- Orders (list, view, update, add manual order)
- Payments (payment methods management)
- Shipping zones management
- Coupons management
- Courier settings + consignment/label/tracking sync (where enabled)
- Inventory center
- Business reports
- SEO & analytics (incl. Google Analytics integration)
- Abandoned orders
- Customer risk + blacklist tools
- Support tickets
- Admin users & permissions (incl. super admin control)
- Contacted users/submissions list

## 5. Setup Guide (Local → Production)
- Prerequisites
- Backend setup (.env, install, run)
- Frontend setup (.env, install, run/build)
- MongoDB setup
- Cloudinary setup
- Email (SMTP/Gmail app password) setup
- Deployment notes + environment variables

## 6. Admin “First-Time Setup” Checklist
- Create the first admin account (first registered user becomes Admin + Super Admin)
- Set store identity (store name, logo, colors)
- Configure payment methods
- Configure shipping zones
- Configure courier (optional)
- Create categories/brands
- Add products + images
- Add homepage banners
- Set coupons (optional)
- Add policies + contact details
- Connect analytics (optional)
- Place test order end-to-end

## 7. Day-to-Day Operations (How to Run the Business)
- Product updates + pricing
- Order processing workflow
- Courier workflow
- Handling cancellations/returns (process)
- Managing customers & risk
- Support ticket workflow
- Reporting & SEO review cadence

## 8. Security, Backups, and Maintenance
- Admin access controls, least privilege
- JWT secret & password rules
- Database backups
- Image/media backups
- Updates & monitoring

## 9. Troubleshooting (Common Issues)
- CORS / API URL mismatches
- Email not sending
- Cloudinary upload failures
- Courier API credential errors
- MongoDB connection issues

