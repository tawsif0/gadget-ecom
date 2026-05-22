const DHAKA_DISTRICT_OPTION = "Dhaka";
const OUTSIDE_DHAKA_SHIPPING_OPTION = "Outside Dhaka";
const OUTSIDE_DHAKA_COVERAGE_KEY = "outside_dhaka";

const BANGLADESH_DISTRICT_OPTIONS = [
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

const normalizeName = (value) =>
  String(value || "")
    .trim()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();

const BANGLADESH_NON_DHAKA_DISTRICT_OPTIONS =
  BANGLADESH_DISTRICT_OPTIONS.filter(
    (district) => normalizeName(district) !== "dhaka",
  );

const DISTRICT_BY_KEY = new Map(
  BANGLADESH_DISTRICT_OPTIONS.map((district) => [
    normalizeName(district),
    district,
  ]),
);

const isDhakaDistrict = (value) => normalizeName(value) === "dhaka";

const isOutsideDhakaShippingOption = (value) => {
  const normalized = normalizeName(value);
  return (
    normalized === "outside dhaka" || normalized === "global outside dhaka"
  );
};

const getDistrictKey = (value) => normalizeName(value);

const normalizeDistrictOption = (value) => {
  if (isOutsideDhakaShippingOption(value)) return OUTSIDE_DHAKA_SHIPPING_OPTION;
  return DISTRICT_BY_KEY.get(normalizeName(value)) || String(value || "").trim();
};

const isBangladeshDistrict = (value) => DISTRICT_BY_KEY.has(getDistrictKey(value));

const isAllowedShippingDistrict = (value) =>
  isBangladeshDistrict(value) || isOutsideDhakaShippingOption(value);

const getDistrictCoverageKeys = (districts = []) => {
  const source = Array.isArray(districts) ? districts : [districts];
  const keys = new Set();

  source.forEach((district) => {
    if (isOutsideDhakaShippingOption(district)) {
      keys.add(OUTSIDE_DHAKA_COVERAGE_KEY);
      return;
    }

    const normalized = normalizeDistrictOption(district);
    if (isBangladeshDistrict(normalized)) {
      keys.add(getDistrictKey(normalized));
    }
  });

  return [...keys];
};

const getDistrictNameFromKey = (key) => {
  if (normalizeName(key) === OUTSIDE_DHAKA_COVERAGE_KEY) {
    return OUTSIDE_DHAKA_SHIPPING_OPTION;
  }

  return DISTRICT_BY_KEY.get(normalizeName(key)) || String(key || "").trim();
};

module.exports = {
  BANGLADESH_DISTRICT_OPTIONS,
  BANGLADESH_NON_DHAKA_DISTRICT_OPTIONS,
  DHAKA_DISTRICT_OPTION,
  OUTSIDE_DHAKA_COVERAGE_KEY,
  OUTSIDE_DHAKA_SHIPPING_OPTION,
  getDistrictCoverageKeys,
  getDistrictKey,
  getDistrictNameFromKey,
  isAllowedShippingDistrict,
  isBangladeshDistrict,
  isDhakaDistrict,
  isOutsideDhakaShippingOption,
  normalizeDistrictOption,
  normalizeName,
};
