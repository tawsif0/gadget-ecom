export const DHAKA_DISTRICT_OPTION = "Dhaka";
export const OUTSIDE_DHAKA_SHIPPING_OPTION = "Outside Dhaka";
export const OUTSIDE_DHAKA_COVERAGE_KEY = "outside_dhaka";

export const BANGLADESH_DISTRICT_OPTIONS = [
  "Bagerhat",
  "Bandarban",
  "Barguna",
  "Barishal",
  "Bhola",
  "Bogura",
  "Brahmanbaria",
  "Chandpur",
  "Chapainawabganj",
  "Chattogram",
  "Chuadanga",
  "Cox's Bazar",
  "Cumilla",
  "Dhaka",
  "Dinajpur",
  "Faridpur",
  "Feni",
  "Gaibandha",
  "Gazipur",
  "Gopalganj",
  "Habiganj",
  "Jamalpur",
  "Jashore",
  "Jhalokati",
  "Jhenaidah",
  "Joypurhat",
  "Khagrachhari",
  "Khulna",
  "Kishoreganj",
  "Kurigram",
  "Kushtia",
  "Lakshmipur",
  "Lalmonirhat",
  "Madaripur",
  "Magura",
  "Manikganj",
  "Meherpur",
  "Moulvibazar",
  "Munshiganj",
  "Mymensingh",
  "Naogaon",
  "Narail",
  "Narayanganj",
  "Narsingdi",
  "Natore",
  "Netrokona",
  "Nilphamari",
  "Noakhali",
  "Pabna",
  "Panchagarh",
  "Patuakhali",
  "Pirojpur",
  "Rajbari",
  "Rajshahi",
  "Rangamati",
  "Rangpur",
  "Satkhira",
  "Shariatpur",
  "Sherpur",
  "Sirajganj",
  "Sunamganj",
  "Sylhet",
  "Tangail",
  "Thakurgaon",
];

export const BANGLADESH_NON_DHAKA_DISTRICT_OPTIONS =
  BANGLADESH_DISTRICT_OPTIONS.filter(
    (district) => district !== DHAKA_DISTRICT_OPTION,
  );

export const normalizeName = (value) =>
  String(value || "")
    .trim()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();

export const isDhakaDistrict = (value) => normalizeName(value) === "dhaka";

export const isOutsideDhakaShippingOption = (value) => {
  const normalized = normalizeName(value);
  return (
    normalized === "outside dhaka" || normalized === "global outside dhaka"
  );
};

const DISTRICT_BY_KEY = new Map(
  BANGLADESH_DISTRICT_OPTIONS.map((district) => [
    normalizeName(district),
    district,
  ]),
);

export const getDistrictKey = (value) => normalizeName(value);

export const normalizeDistrictOption = (value) => {
  if (isOutsideDhakaShippingOption(value)) return OUTSIDE_DHAKA_SHIPPING_OPTION;
  return DISTRICT_BY_KEY.get(normalizeName(value)) || String(value || "").trim();
};

export const getDistrictCoverageKeys = (districts = []) => {
  const source = Array.isArray(districts) ? districts : [districts];
  const keys = new Set();

  source.forEach((district) => {
    if (isOutsideDhakaShippingOption(district)) {
      keys.add(OUTSIDE_DHAKA_COVERAGE_KEY);
      return;
    }

    const normalized = normalizeDistrictOption(district);
    if (DISTRICT_BY_KEY.has(getDistrictKey(normalized))) {
      keys.add(getDistrictKey(normalized));
    }
  });

  return [...keys];
};
