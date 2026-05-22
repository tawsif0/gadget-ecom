import React from "react";
import { FiMenu } from "react-icons/fi";
import { isSuperAdminUser, resolveUserRole } from "../../utils/dashboardAccess";

const ROLE_TITLES = {
  admin: "Admin Console",
  user: "Customer Console",
};

const MobileHeader = ({ toggleSidebar, user, pageMeta }) => {
  const role = resolveUserRole(user);
  const isSuperAdmin = isSuperAdminUser(user);
  const consoleTitle =
    role === "admin" && isSuperAdmin
      ? "Super Admin Console"
      : ROLE_TITLES[role] || ROLE_TITLES.user;
  const title = pageMeta?.title || consoleTitle;
  const subtitle = pageMeta?.section || consoleTitle;

  return (
    <div className="fixed left-0 right-0 top-0 z-50 flex h-14 items-center justify-between border-b border-black/10 bg-white/88 px-4 shadow-[0_18px_36px_rgba(15,23,42,0.08)] backdrop-blur-xl md:hidden">
      <button
        onClick={toggleSidebar}
        className="rounded-xl border border-black/10 bg-white px-2.5 py-2 text-gray-700 transition-all duration-200 hover:bg-gray-100 hover:text-black"
      >
        <FiMenu className="w-6 h-6" />
      </button>
      <div className="flex flex-col items-center">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-gray-400">
          {subtitle}
        </p>
        <h1 className="text-base font-bold text-black">{title}</h1>
      </div>
      <div className="w-10"></div>
    </div>
  );
};

export default MobileHeader;
