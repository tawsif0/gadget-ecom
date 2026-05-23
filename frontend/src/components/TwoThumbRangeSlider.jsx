import React from "react";

const clampNumber = (value, min, max) => Math.min(Math.max(value, min), max);

const formatMoney = (value) => {
  const safe = Number(value);
  const amount = Number.isFinite(safe) ? safe : 0;
  return `Tk ${Math.round(amount)}`;
};

const TwoThumbRangeSlider = ({
  min = 0,
  max = 10000,
  step = 1,
  value = [0, 10000],
  onChange,
  className = "",
}) => {
  const resolvedMin = Number.isFinite(Number(min)) ? Number(min) : 0;
  const resolvedMax = Number.isFinite(Number(max)) ? Number(max) : 10000;
  const safeMin = Math.min(resolvedMin, resolvedMax);
  const safeMax = Math.max(resolvedMin, resolvedMax);

  const rawLow = Array.isArray(value) ? Number(value[0]) : safeMin;
  const rawHigh = Array.isArray(value) ? Number(value[1]) : safeMax;
  const lowValue = clampNumber(Number.isFinite(rawLow) ? rawLow : safeMin, safeMin, safeMax);
  const highValue = clampNumber(
    Number.isFinite(rawHigh) ? rawHigh : safeMax,
    safeMin,
    safeMax,
  );

  const low = Math.min(lowValue, highValue);
  const high = Math.max(lowValue, highValue);

  const range = Math.max(1, safeMax - safeMin);
  const lowPercent = ((low - safeMin) / range) * 100;
  const highPercent = ((high - safeMin) / range) * 100;

  const emitChange = (nextLow, nextHigh) => {
    if (typeof onChange !== "function") return;
    const normalizedLow = clampNumber(nextLow, safeMin, safeMax);
    const normalizedHigh = clampNumber(nextHigh, safeMin, safeMax);
    onChange([Math.min(normalizedLow, normalizedHigh), Math.max(normalizedLow, normalizedHigh)]);
  };

  return (
    <div className={className}>
      <div className="two-thumb-range relative w-full">
        <div className="absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-black/15" />
        <div
          className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-black"
          style={{
            left: `${lowPercent}%`,
            right: `${100 - highPercent}%`,
          }}
        />

        <input
          type="range"
          min={safeMin}
          max={safeMax}
          step={step}
          value={low}
          aria-label="Minimum price"
          onChange={(event) => {
            const next = Number(event.target.value);
            emitChange(Math.min(next, high - step), high);
          }}
          className="two-thumb-range__input"
        />
        <input
          type="range"
          min={safeMin}
          max={safeMax}
          step={step}
          value={high}
          aria-label="Maximum price"
          onChange={(event) => {
            const next = Number(event.target.value);
            emitChange(low, Math.max(next, low + step));
          }}
          className="two-thumb-range__input"
        />
      </div>

      <div className="mt-2 flex items-center justify-between text-sm text-gray-700">
        <span>
          {formatMoney(low)}
        </span>
        <span>
          {formatMoney(high)}
        </span>
      </div>
    </div>
  );
};

export default TwoThumbRangeSlider;
