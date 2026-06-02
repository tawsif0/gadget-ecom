import React, { useEffect, useMemo, useState } from "react";
import { FiSettings } from "react-icons/fi";
import { useDispatch, useSelector } from "react-redux";
import SearchableSelect from "./SearchableSelect";
import CategoryTypeModal from "./CategoryTypeModal";
import { fetchCategoryTypes } from "../store/categoryTypeSlice";

const CategoryTypeSelect = ({
  value = "",
  onChange,
  placeholder = "Select category name",
  buttonClassName = "",
  includeAllOption = false,
  allLabel = "All category names",
  showManageButton = true,
}) => {
  const dispatch = useDispatch();
  const { list: types, loading } = useSelector((state) => state.categoryTypes);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    dispatch(fetchCategoryTypes()).catch(() => undefined);
  }, [dispatch]);

  const options = useMemo(() => {
    const rows = (Array.isArray(types) ? types : [])
      .map((entry) => ({
        value: String(entry?.name || "").trim(),
        label: String(entry?.name || "").trim(),
      }))
      .filter((entry) => (includeAllOption ? true : entry.value));

    const deduped = Array.from(
      new Map(rows.map((row) => [row.value.toLowerCase(), row])).values(),
    ).sort((a, b) => a.label.localeCompare(b.label));

    if (!deduped.some((row) => row.value.toLowerCase() === "latest")) {
      deduped.unshift({ value: "Latest", label: "Latest" });
    }

    if (includeAllOption) {
      deduped.unshift({ value: "", label: allLabel });
    }

    return deduped;
  }, [types, includeAllOption, allLabel]);

  return (
    <div className="flex items-stretch gap-2">
      <SearchableSelect
        value={value}
        onChange={onChange}
        options={options}
        placeholder={placeholder}
        searchable={true}
        className="flex-1 min-w-0"
        buttonClassName={buttonClassName}
        emptyLabel={loading ? "Loading..." : "No category names found"}
      />
      {showManageButton ? (
        <>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex w-12 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-800 transition hover:border-black hover:bg-gray-50"
            title="Manage category names"
            aria-label="Manage category names"
          >
            <FiSettings className="h-4 w-4" />
          </button>
          <CategoryTypeModal isOpen={open} onClose={() => setOpen(false)} />
        </>
      ) : null}
    </div>
  );
};

export default CategoryTypeSelect;
