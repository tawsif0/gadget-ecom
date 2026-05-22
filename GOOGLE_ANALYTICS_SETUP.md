# Google Analytics Setup

This guide shows exactly what data you need from Google Analytics and where to put it in this project.

## What You Need

| Data                | Where to get it                           | Needed?           |
| ------------------- | ----------------------------------------- | ----------------- |
| Google account      | Sign in to Google                         | Yes               |
| GA4 property name   | You choose it while creating the property | Yes               |
| Web stream URL      | Your storefront URL                       | Yes               |
| Measurement ID      | Web stream details in Google Analytics    | Yes               |
| Stream ID           | Web stream details                        | No                |
| Google Analytics ID | Older Universal Analytics only            | No                |
| GTM ID              | Google Tag Manager                        | Optional          |
| `VITE_API_URL`      | `frontend/.env`                           | Yes for local/dev |

## Important First

The only Google Analytics value this project really needs is the **GA4 Measurement ID**.

It looks like this:

```text
G-XXXXXXXXXX
```

Do not confuse it with:

- Stream ID
- Property ID
- Account ID

Those are different. For this project, copy the **GA4 Measurement ID** only.

## What You Have In The Screenshot

From the screen you showed, you already have these things:

- Tag name: `Arbeit-Ecommerce`
- Google tag ID: `GT-WK5C2QL8`
- GA4 destination / Measurement ID: `G-ODXP76BJ2N`
- Destination name: `Arbeit-Ecommerce`
- Duplicate-instance protection: turned on

What each one means:

- The tag name is only a label inside Google.
- The `GT-...` value is the Google tag ID.
- The `G-...` value is the GA4 Measurement ID.
- The `G-...` value is the one this project needs.

If you only want to set up this project, use the `G-...` value from the Google Analytics destination or web stream details.
The `GT-...` value is only needed if you are managing the Google tag itself or using a separate tag workflow.

## Step By Step

### 1. Sign in or create a Google account

1. Open Google and sign in.
2. If you do not have an account, create one first.
3. Use that same account to manage analytics for this store.

### 2. Open Google Analytics

1. Go to Google Analytics.
2. Open the Admin area.
3. In the Account column, choose an account or create a new one.

### 3. Create the GA4 property

1. Click to create a new property.
2. Give it a name that matches your store.
3. Choose the correct time zone.
4. Choose the correct currency.
5. Finish creating the property.

Use GA4. That is the version this project expects.

### 4. Create the Web data stream

1. Open Data Streams.
2. Click Web.
3. Enter your storefront URL.
4. Create the stream.

The storefront URL is the address shoppers use, not the backend API URL.

### 5. Find and copy the Measurement ID

1. Open the web stream details.
2. Look for the section labeled Measurement ID.
3. Copy the value.

That copied value is what you will paste into this project.

If you are on the Google tag screen, the `G-...` value under the destination is the one you want.
Ignore the `GT-...` value unless you are using Google Tag Manager or tag-level setup.

### 6. Set the frontend API URL

This project loads the analytics settings from the backend API.

For local development, the frontend environment file uses:

```dotenv
VITE_API_URL=http://localhost:5000/api
```

If you deploy the project, change that to your live backend API URL.

### 7. Open the analytics settings in this project

1. Log in as an admin.
2. Open the dashboard.
3. Go to the SEO and Tracking area.
4. Select the Analytics card type.

That is where Google Analytics is configured in this project.

### 8. Enter the GA4 ID

1. Choose Global scope.
2. Paste the GA4 Measurement ID into the GA4 field.
3. Leave Legacy Google Analytics ID empty unless you still use an old `UA-...` property.
4. Leave Google Tag Manager ID empty unless you actually created a GTM container.
5. Save the settings.

### 9. What to put in each field

In the admin panel form:

- GA4 Measurement ID: paste the `G-...` value
- Legacy Google Analytics ID: usually leave blank
- Google Tag Manager ID: paste only if you have a real `GTM-...` container ID

Do not put the Google tag ID `GT-...` into the GTM field.
Do not put the Stream ID into any field.

### 10. What will be tracked

After saving, the storefront can send these events automatically:

- `page_view`
- `view_item`
- `add_to_cart`
- `initiate_checkout`
- `purchase`

It also sends shop catalog list data when the category, brand, or collection changes.

### 11. Test it

1. Open the storefront in a browser.
2. Open DevTools.
3. Check the Network tab for the Google Analytics script.
4. Refresh the page.
5. Visit a product page.
6. Add an item to cart.
7. Try checkout if possible.
8. Check Google Analytics Realtime or DebugView.

## Where To Find Each Value

### Measurement ID

Find it in Google Analytics:

1. Admin.
2. Data Streams.
3. Select your Web stream.
4. Copy Measurement ID.

If you are using the Google tag screen, open the destination linked to the tag and copy the `G-...` value from there.

### Web stream URL

This is your storefront URL, for example:

```text
https://your-store.com
```

### `VITE_API_URL`

Find it in `frontend/.env`.

For local work it should point to your backend API, for example:

```dotenv
VITE_API_URL=http://localhost:5000/api
```

### GA4 field in this project

Paste the Measurement ID into the GA4 Measurement ID field in the SEO and Tracking admin page.

### Open Graph Image URL

This field is for the image that appears when someone shares your page on Facebook, WhatsApp, LinkedIn, or X.

You can get it like this:

1. Upload an image in your admin panel or use an image that is already public on your site.
2. Copy the public image URL.
3. Paste that URL into the Open Graph Image URL field.

Good image choices are:

- Your store banner
- Your store logo
- A featured product image
- A branded social share image

Good size to use:

- 1200 x 630 pixels

Important rules:

- The image must be publicly accessible.
- Do not use a file path from your computer.
- A full URL like `https://...` is safest.
- A relative path like `/uploads/...` can also work in this project if the image is already served by the backend.

If you do not have an image yet, upload one first in the admin area that handles banners, logos, or media, then copy the public link.

## If You Want More Tracking

If you want extra tracking for shop list views, category filters, or brand filters, use Google Tag Manager later and forward the data layer events through GTM.

## Troubleshooting

- If nothing shows up in Google Analytics, confirm the Measurement ID is saved in the project.
- If the frontend cannot load settings, check `VITE_API_URL`.
- If you only set a page-based card, other pages will not use it.
- If you use an ad blocker, test in an incognito window.
- If the GA script does not appear, make sure the analytics card is saved as Global.
