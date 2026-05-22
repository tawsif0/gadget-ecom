export const dashboardFormSurfaceClass =
  "dashboard-form-surface rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_44px_rgba(15,23,42,0.04)] md:p-6";

export const dashboardFormSectionClass =
  "rounded-[24px] border border-slate-200 bg-slate-50/80 p-4 shadow-[0_12px_30px_rgba(15,23,42,0.03)] md:p-5";

export const dashboardFieldClass =
  "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 transition placeholder:text-slate-400 focus:border-slate-900 focus:bg-white focus:outline-none";

export const dashboardLabelClass =
  "dashboard-form-label mb-2 block text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500";

export const dashboardInlineToggleClass = (active = false) =>
  `inline-flex items-center justify-center rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] transition ${
    active
      ? "!border-[var(--brand-theme-color)] !bg-[var(--brand-theme-color)] !text-[var(--brand-button-text-color)] shadow-[0_8px_20px_var(--brand-theme-shadow)]"
      : "border-slate-300 bg-white text-slate-700 hover:!border-[var(--brand-theme-color)] hover:!text-[var(--brand-theme-color)]"
  }`;

export const dashboardPrimaryButtonClass =
  "inline-flex items-center justify-center rounded-full bg-[linear-gradient(135deg,#081744_0%,#202d5a_100%)] px-6 py-3 text-sm font-bold text-white shadow-lg shadow-slate-900/15 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60";

export const dashboardSecondaryButtonClass =
  "inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-900 hover:text-black";
