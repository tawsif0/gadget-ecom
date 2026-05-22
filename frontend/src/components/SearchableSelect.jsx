import React, { useEffect, useMemo, useRef, useState } from "react";
import { FiCheck, FiChevronDown, FiSearch, FiX } from "react-icons/fi";

const SearchableSelect = ({
  value = "",
  onChange,
  options = [],
  placeholder = "Select",
  searchPlaceholder = "Search...",
  emptyLabel = "No options found",
  className = "",
  buttonClassName = "",
  menuClassName = "",
  optionClassName = "",
  searchable = true,
  clearable = false,
}) => {
  const shellRef = useRef(null);
  const searchRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");

  const normalizedOptions = useMemo(
    () =>
      (Array.isArray(options) ? options : []).map((option) => ({
        value: String(option?.value || "").trim(),
        label: String(option?.label || option?.value || "").trim(),
        description: String(option?.description || "").trim(),
      })),
    [options],
  );

  const selectedOption = normalizedOptions.find(
    (option) => option.value === String(value || "").trim(),
  );

  const filteredOptions = useMemo(() => {
    const normalizedQuery = String(query || "")
      .trim()
      .toLowerCase();
    if (!normalizedQuery) return normalizedOptions;
    return normalizedOptions.filter((option) =>
      `${option.label} ${option.description}`
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [normalizedOptions, query]);

  const searchInputStyle = {
    appearance: "none",
    WebkitAppearance: "none",
    MozAppearance: "none",
    background: "transparent",
    border: 0,
    boxShadow: "none",
    outline: "none",
    padding: 0,
    margin: 0,
    minHeight: 0,
    minWidth: 0,
    width: "100%",
  };

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleClickOutside = (event) => {
      if (!shellRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      return;
    }

    if (!searchable) return;

    window.setTimeout(() => searchRef.current?.focus(), 0);
  }, [isOpen, searchable]);

  return (
    <div ref={shellRef} className={`relative ${className}`.trim()}>
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className={`flex min-h-[46px] w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-left text-sm text-black transition hover:border-black ${buttonClassName}`.trim()}
      >
        <span
          className={
            selectedOption || String(value || "").trim()
              ? "text-black"
              : "text-gray-400"
          }
        >
          {selectedOption?.label || String(value || "").trim() || placeholder}
        </span>
        <FiChevronDown
          className={`ml-3 h-4 w-4 text-gray-500 transition ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {clearable && String(value || "").trim() ? (
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onChange?.("");
            setIsOpen(false);
          }}
          className="absolute right-9 top-1/2 z-10 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
          aria-label="Clear selection"
        >
          <FiX className="h-3.5 w-3.5" />
        </button>
      ) : null}

      {isOpen ? (
        <div
          className={`absolute z-[120] mt-2 w-full rounded-xl border border-gray-200 bg-white p-2 shadow-xl ${menuClassName}`.trim()}
        >
          {searchable ? (
            <div className="mb-2 flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50/70 px-3 py-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition focus-within:border-slate-300 focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgba(15,23,42,0.04)]">
              <FiSearch className="h-4 w-4 shrink-0 text-gray-400" />
              <input
                ref={searchRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={searchPlaceholder}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                className="searchable-select-search flex-1 min-w-0 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:outline-none focus:ring-0"
                style={searchInputStyle}
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="shrink-0 text-gray-400 transition hover:text-slate-700"
                >
                  <FiX className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          ) : null}

          <div className="max-h-64 space-y-1 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="rounded-lg px-3 py-2 text-sm text-gray-500">
                {emptyLabel}
              </div>
            ) : (
              filteredOptions.map((option) => {
                const active = option.value === String(value || "").trim();
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      onChange?.(option.value);
                      setIsOpen(false);
                    }}
                    className={`flex w-full items-start justify-between gap-3 rounded-lg px-3 py-2 text-left transition ${
                      active
                        ? "bg-black text-white"
                        : "hover:bg-gray-50 text-black"
                    } ${optionClassName}`.trim()}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {option.label}
                      </p>
                      {option.description ? (
                        <p
                          className={`mt-0.5 text-xs ${active ? "text-white/70" : "text-gray-500"}`}
                        >
                          {option.description}
                        </p>
                      ) : null}
                    </div>
                    {active ? (
                      <FiCheck className="mt-0.5 h-4 w-4 shrink-0" />
                    ) : null}
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default SearchableSelect;
