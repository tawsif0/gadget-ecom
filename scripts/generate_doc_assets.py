from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Tuple

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
ASSETS_DIR = ROOT / "docs" / "assets"


def _load_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    # Prefer a readable default font. Fall back to PIL built-in if unavailable.
    candidates = [
        r"C:\Windows\Fonts\segoeui.ttf",
        r"C:\Windows\Fonts\arial.ttf",
    ]
    for path in candidates:
        if os.path.exists(path):
            return ImageFont.truetype(path, size=size)
    return ImageFont.load_default()


@dataclass(frozen=True)
class Box:
    xy: Tuple[int, int, int, int]
    title: str
    subtitle: str = ""
    fill: Tuple[int, int, int] = (245, 247, 250)
    outline: Tuple[int, int, int] = (30, 41, 59)


def _centered_text(draw: ImageDraw.ImageDraw, xy: Tuple[int, int, int, int], text: str, font, fill):
    x1, y1, x2, y2 = xy
    w = x2 - x1
    h = y2 - y1
    bbox = draw.multiline_textbbox((0, 0), text, font=font, align="center")
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    draw.multiline_text(
        (x1 + (w - tw) / 2, y1 + (h - th) / 2),
        text,
        font=font,
        fill=fill,
        align="center",
        spacing=4,
    )


def _draw_box(draw: ImageDraw.ImageDraw, box: Box, title_font, subtitle_font):
    draw.rounded_rectangle(box.xy, radius=16, fill=box.fill, outline=box.outline, width=3)
    x1, y1, x2, y2 = box.xy
    pad = 18
    title_area = (x1 + pad, y1 + pad, x2 - pad, y1 + 70)
    _centered_text(draw, title_area, box.title, font=title_font, fill=(15, 23, 42))
    if box.subtitle:
        subtitle_area = (x1 + pad, y1 + 78, x2 - pad, y2 - pad)
        _centered_text(draw, subtitle_area, box.subtitle, font=subtitle_font, fill=(51, 65, 85))


def _arrow(draw: ImageDraw.ImageDraw, start: Tuple[int, int], end: Tuple[int, int], color=(37, 99, 235), width=5):
    draw.line([start, end], fill=color, width=width)
    # Arrow head
    ex, ey = end
    sx, sy = start
    dx = ex - sx
    dy = ey - sy
    length = max((dx * dx + dy * dy) ** 0.5, 1.0)
    ux, uy = dx / length, dy / length
    # perpendicular
    px, py = -uy, ux
    size = 14
    p1 = (ex - int(ux * size) + int(px * size / 2), ey - int(uy * size) + int(py * size / 2))
    p2 = (ex - int(ux * size) - int(px * size / 2), ey - int(uy * size) - int(py * size / 2))
    draw.polygon([end, p1, p2], fill=color)


def _title(draw: ImageDraw.ImageDraw, text: str, width: int):
    font = _load_font(34)
    draw.text((40, 24), text, font=font, fill=(15, 23, 42))
    draw.line([(40, 68), (width - 40, 68)], fill=(226, 232, 240), width=3)


def generate_architecture_diagram(out_path: Path) -> None:
    w, h = 1400, 820
    img = Image.new("RGB", (w, h), (255, 255, 255))
    draw = ImageDraw.Draw(img)
    _title(draw, "System Architecture (Single Store)", w)

    title_font = _load_font(26)
    subtitle_font = _load_font(18)

    boxes = [
        Box((80, 140, 480, 320), "Customer Website", "React + Vite\nStorefront pages\nCart / Checkout"),
        Box((80, 360, 480, 540), "Admin Panel", "Dashboard modules\nOrders / Products\nWebsite Setup"),
        Box((540, 220, 980, 460), "Backend API", "Node.js + Express\nAuthentication (JWT)\nBusiness logic"),
        Box((1040, 150, 1330, 300), "MongoDB", "Products / Orders\nUsers / Settings\nReports"),
        Box((1040, 330, 1330, 480), "Cloudinary", "Product images\nBanners (optional)"),
        Box((1040, 510, 1330, 660), "Email (SMTP)", "Password reset\nNotifications"),
        Box((540, 520, 980, 700), "3rd-Party Integrations", "Courier (optional)\nAnalytics / SEO"),
    ]
    for b in boxes:
        _draw_box(draw, b, title_font, subtitle_font)

    # Arrows
    _arrow(draw, (480, 230), (540, 300))  # website -> API
    _arrow(draw, (480, 430), (540, 360))  # admin -> API
    _arrow(draw, (980, 280), (1040, 220))  # API -> Mongo
    _arrow(draw, (980, 360), (1040, 400))  # API -> Cloudinary
    _arrow(draw, (980, 410), (1040, 580))  # API -> Email
    _arrow(draw, (760, 460), (760, 520))   # API -> integrations

    out_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(out_path, format="PNG", optimize=True)


def generate_order_workflow(out_path: Path) -> None:
    w, h = 1400, 900
    img = Image.new("RGB", (w, h), (255, 255, 255))
    draw = ImageDraw.Draw(img)
    _title(draw, "Order Lifecycle (Typical)", w)

    title_font = _load_font(24)
    subtitle_font = _load_font(16)

    steps = [
        Box((70, 170, 380, 300), "1) Customer Checkout", "Cart → Checkout\nShipping + Coupon\nPlace Order"),
        Box((410, 170, 720, 300), "2) Payment Method", "COD / Manual\n(or gateway if enabled)"),
        Box((750, 170, 1060, 300), "3) Admin Reviews", "Orders → View\nVerify details\nUpdate status"),
        Box((1090, 170, 1330, 300), "4) Courier (Optional)", "Generate consignment\nPrint label\nSync tracking"),
        Box((410, 350, 720, 480), "5) Fulfillment", "Pack items\nShip\nTrack progress"),
        Box((750, 350, 1060, 480), "6) Delivered", "Complete order\nClose support"),
    ]
    for b in steps:
        _draw_box(draw, b, title_font, subtitle_font)

    _arrow(draw, (380, 235), (410, 235))
    _arrow(draw, (720, 235), (750, 235))
    _arrow(draw, (1060, 235), (1090, 235))
    _arrow(draw, (565, 300), (565, 350))
    _arrow(draw, (720, 415), (750, 415))

    note_font = _load_font(18)
    draw.rounded_rectangle((70, 540, 1330, 820), radius=16, fill=(248, 250, 252), outline=(226, 232, 240), width=3)
    draw.text(
        (100, 565),
        "Notes:\n"
        "- Actual statuses and steps may vary by store policy.\n"
        "- Courier features require configuring credentials in Admin → Courier Settings.\n"
        "- Shipping costs are controlled by Admin → Shipping Zones.",
        font=note_font,
        fill=(51, 65, 85),
        spacing=8,
    )

    out_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(out_path, format="PNG", optimize=True)


def generate_admin_modules_overview(out_path: Path) -> None:
    w, h = 1400, 820
    img = Image.new("RGB", (w, h), (255, 255, 255))
    draw = ImageDraw.Draw(img)
    _title(draw, "Admin Panel Modules (Overview)", w)

    font = _load_font(22)
    small = _load_font(18)

    # Sidebar mock
    draw.rounded_rectangle((60, 120, 420, 760), radius=18, fill=(15, 23, 42))
    draw.text((95, 150), "Dashboard", font=_load_font(26), fill=(255, 255, 255))

    items = [
        "Website Setup",
        "Products",
        "Categories",
        "Brands",
        "Banners",
        "Orders",
        "Shipping Zones",
        "Payment Methods",
        "Coupons",
        "Courier Settings",
        "Inventory Center",
        "Business Reports",
        "SEO & Analytics",
        "Support Tickets",
        "Admin Users",
    ]
    y = 205
    for idx, item in enumerate(items[:12]):
        draw.text((95, y), f"• {item}", font=small, fill=(226, 232, 240))
        y += 36
    # Main area mock
    draw.rounded_rectangle((450, 120, 1340, 760), radius=18, fill=(248, 250, 252), outline=(226, 232, 240), width=3)
    draw.text((490, 150), "Example: Orders", font=font, fill=(15, 23, 42))
    draw.text((490, 190), "Search • Filter • Status updates • Order details • Courier panel", font=small, fill=(51, 65, 85))
    # Fake table
    table_top = 250
    draw.rounded_rectangle((480, table_top, 1310, 700), radius=12, fill=(255, 255, 255), outline=(226, 232, 240), width=2)
    draw.rectangle((480, table_top, 1310, table_top + 48), fill=(241, 245, 249))
    headers = ["Order #", "Customer", "Total", "Status", "Actions"]
    hx = [510, 670, 900, 1030, 1160]
    for i, htxt in enumerate(headers):
        draw.text((hx[i], table_top + 14), htxt, font=_load_font(18), fill=(30, 41, 59))
    row_y = table_top + 62
    for r in range(6):
        draw.line([(500, row_y - 8), (1290, row_y - 8)], fill=(241, 245, 249), width=2)
        draw.text((510, row_y), f"#10{r}27", font=_load_font(18), fill=(51, 65, 85))
        draw.text((670, row_y), f"Customer {r+1}", font=_load_font(18), fill=(51, 65, 85))
        draw.text((900, row_y), f"৳ {1200 + r*250}", font=_load_font(18), fill=(51, 65, 85))
        draw.text((1030, row_y), "Processing", font=_load_font(18), fill=(37, 99, 235))
        draw.rounded_rectangle((1160, row_y - 2, 1275, row_y + 28), radius=10, fill=(37, 99, 235))
        draw.text((1184, row_y + 3), "View", font=_load_font(18), fill=(255, 255, 255))
        row_y += 56

    caption = "Illustration (for documentation). Actual UI may differ based on theme settings."
    draw.text((60, 780), caption, font=_load_font(14), fill=(100, 116, 139))

    out_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(out_path, format="PNG", optimize=True)


def main() -> None:
    ASSETS_DIR.mkdir(parents=True, exist_ok=True)
    generate_architecture_diagram(ASSETS_DIR / "architecture.png")
    generate_order_workflow(ASSETS_DIR / "order-lifecycle.png")
    generate_admin_modules_overview(ASSETS_DIR / "admin-modules.png")
    print(f"Generated assets in: {ASSETS_DIR}")


if __name__ == "__main__":
    main()

