import React, { useState } from "react";
import { useForm } from "react-hook-form";
import axios from "axios";
import toast from "react-hot-toast";
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from "framer-motion";
import {
  FiEye,
  FiEyeOff,
  FiUser,
  FiMail,
  FiPhone,
  FiLock,
  FiSave,
  FiCheck,
  FiAlertCircle,
} from "react-icons/fi";
import { useAuth } from "../../hooks/useAuth";

const Settings = ({ user }) => {
  const {
    register: registerProfile,
    handleSubmit: handleSubmitProfile,
    formState: { errors: profileErrors },
  } = useForm({
    defaultValues: {
      name: user?.name || "",
      email: user?.email || "",
      phone: user?.phone || "",
    },
  });

  const {
    register: registerPassword,
    handleSubmit: handleSubmitPassword,
    formState: { errors: passwordErrors },
    reset: resetPasswordForm,
    watch,
  } = useForm();

  const [isLoading, setIsLoading] = useState(false);
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const { logout, updateUser } = useAuth();
  const baseUrl = import.meta.env.VITE_API_URL;
  const onSubmitProfile = async (data) => {
    setIsLoading(true);
    try {
      const response = await axios.put(`${baseUrl}/auth/profile`, data, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      const updatedUser = response.data;
      updateUser(updatedUser);

      toast.success("Profile updated successfully!");
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to update profile");
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmitPassword = async (data) => {
    setIsPasswordLoading(true);
    const loadingToast = toast.loading("Changing password...");

    try {
      await axios.put(`${baseUrl}/auth/change-password`, data, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      toast.dismiss(loadingToast);
      toast.success("Password changed successfully! Please login again.");

      resetPasswordForm();
      setTimeout(() => {
        logout();
      }, 2000);
    } catch (error) {
      toast.dismiss(loadingToast);
      toast.error(error.response?.data?.error || "Failed to change password");
    } finally {
      setIsPasswordLoading(false);
    }
  };

  // Watch password values for validation
  const newPassword = watch("newPassword");
  const currentPassword = watch("currentPassword");

  return (
    <div className="space-y-6">
      {/* Profile Settings Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="app-panel overflow-hidden"
      >
        <div className="border-b border-black/8 bg-slate-50 px-8 py-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-black">
              <FiUser className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-black">Profile Settings</h3>
              <p className="text-sm text-gray-600">
                Update your personal information
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmitProfile(onSubmitProfile)} className="p-8">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Name Field */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                <span className="flex items-center">
                  <FiUser className="w-4 h-4 mr-2 text-gray-600" />
                  Full Name
                </span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  id="name"
                  {...registerProfile("name", {
                    required: "Name is required",
                    minLength: {
                      value: 2,
                      message: "Name must be at least 2 characters",
                    },
                  })}
                  className={`w-full pl-12 pr-4 py-3 bg-gray-50 border-2 rounded-lg focus:outline-none focus:ring-0 transition-all duration-300 ${
                    profileErrors.name
                      ? "border-red-500 focus:border-red-600"
                      : "border-gray-300 focus:border-black"
                  }`}
                  placeholder="John Doe"
                />
                <FiUser className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500" />
              </div>
              <AnimatePresence>
                {profileErrors.name && (
                  <motion.p
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="mt-2 text-sm text-red-600 flex items-center"
                  >
                    <FiAlertCircle className="w-4 h-4 mr-1" />
                    {profileErrors.name.message}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            {/* Email Field */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                <span className="flex items-center">
                  <FiMail className="w-4 h-4 mr-2 text-gray-600" />
                  Email Address
                </span>
              </label>
              <div className="relative">
                <input
                  type="email"
                  id="email"
                  {...registerProfile("email", {
                    required: "Email is required",
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: "Invalid email address",
                    },
                  })}
                  className={`w-full pl-12 pr-4 py-3 bg-gray-50 border-2 rounded-lg focus:outline-none focus:ring-0 transition-all duration-300 ${
                    profileErrors.email
                      ? "border-red-500 focus:border-red-600"
                      : "border-gray-300 focus:border-black"
                  }`}
                  placeholder="john@example.com"
                />
                <FiMail className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500" />
              </div>
              <AnimatePresence>
                {profileErrors.email && (
                  <motion.p
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="mt-2 text-sm text-red-600 flex items-center"
                  >
                    <FiAlertCircle className="w-4 h-4 mr-1" />
                    {profileErrors.email.message}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            {/* Phone Field */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                <span className="flex items-center">
                  <FiPhone className="w-4 h-4 mr-2 text-gray-600" />
                  Phone Number
                </span>
              </label>
              <div className="relative">
                <input
                  type="tel"
                  id="phone"
                  {...registerProfile("phone")}
                  className="w-full pl-12 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent text-gray-900 placeholder-gray-500 transition-all"
                  placeholder="Enter your phone number"
                />
                <FiPhone className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500" />
              </div>
              {profileErrors.phone && (
                <motion.p
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mt-2 text-sm text-red-600 flex items-center"
                >
                  <FiAlertCircle className="w-4 h-4 mr-1" />
                  {profileErrors.phone.message}
                </motion.p>
              )}
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-300">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={isLoading}
              className="inline-flex items-center px-6 py-3 bg-black text-white font-semibold rounded-lg hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Saving...
                </>
              ) : (
                <>
                  <FiSave className="w-5 h-5 mr-2" />
                  Save Profile Changes
                </>
              )}
            </motion.button>
          </div>
        </form>
      </motion.div>

      {/* Password Settings Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="app-panel overflow-hidden"
      >
        <div className="border-b border-black/8 bg-slate-50 px-8 py-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-black">
              <FiLock className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-black">Change Password</h3>
              <p className="text-sm text-gray-600">
                Update your password security
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmitPassword(onSubmitPassword)} className="p-8">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Current Password */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                <span className="flex items-center">
                  <FiLock className="w-4 h-4 mr-2 text-gray-600" />
                  Current Password
                </span>
              </label>
              <div className="relative">
                <input
                  type={showCurrentPassword ? "text" : "password"}
                  id="currentPassword"
                  {...registerPassword("currentPassword", {
                    required: "Current password is required",
                  })}
                  className={`w-full pl-12 pr-12 py-3 bg-gray-50 border-2 rounded-lg focus:outline-none focus:ring-0 transition-all duration-300 ${
                    passwordErrors.currentPassword
                      ? "border-red-500 focus:border-red-600"
                      : "border-gray-300 focus:border-black"
                  }`}
                  placeholder="••••••••"
                />
                <FiLock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500" />
                <button
                  type="button"
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 p-1.5 rounded-md bg-gray-100 hover:bg-gray-200 transition-colors duration-200"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                >
                  {showCurrentPassword ? (
                    <FiEyeOff className="w-5 h-5 text-gray-600" />
                  ) : (
                    <FiEye className="w-5 h-5 text-gray-600" />
                  )}
                </button>
              </div>
              <AnimatePresence>
                {passwordErrors.currentPassword && (
                  <motion.p
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="mt-2 text-sm text-red-600 flex items-center"
                  >
                    <FiAlertCircle className="w-4 h-4 mr-1" />
                    {passwordErrors.currentPassword.message}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            {/* New Password */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                <span className="flex items-center">
                  <FiLock className="w-4 h-4 mr-2 text-gray-600" />
                  New Password
                </span>
              </label>
              <div className="relative">
                <input
                  type={showNewPassword ? "text" : "password"}
                  id="newPassword"
                  {...registerPassword("newPassword", {
                    required: "New password is required",
                    minLength: {
                      value: 8,
                      message: "Password must be at least 8 characters",
                    },
                    validate: (value) => {
                      if (currentPassword && value === currentPassword) {
                        return "New password must be different from current password";
                      }
                      return true;
                    },
                  })}
                  className={`w-full pl-12 pr-12 py-3 bg-gray-50 border-2 rounded-lg focus:outline-none focus:ring-0 transition-all duration-300 ${
                    passwordErrors.newPassword
                      ? "border-red-500 focus:border-red-600"
                      : "border-gray-300 focus:border-black"
                  }`}
                  placeholder="••••••••"
                />
                <FiLock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500" />
                <button
                  type="button"
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 p-1.5 rounded-md bg-gray-100 hover:bg-gray-200 transition-colors duration-200"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? (
                    <FiEyeOff className="w-5 h-5 text-gray-600" />
                  ) : (
                    <FiEye className="w-5 h-5 text-gray-600" />
                  )}
                </button>
              </div>
              <AnimatePresence>
                {passwordErrors.newPassword && (
                  <motion.p
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="mt-2 text-sm text-red-600 flex items-center"
                  >
                    <FiAlertCircle className="w-4 h-4 mr-1" />
                    {passwordErrors.newPassword.message}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Password Strength Indicator */}
          {newPassword && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-300"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-gray-900">
                  Password Strength
                </span>
                <span
                  className={`text-sm font-bold ${
                    newPassword.length < 4
                      ? "text-red-600"
                      : newPassword.length < 8
                        ? "text-amber-600"
                        : "text-green-600"
                  }`}
                >
                  {newPassword.length < 4
                    ? "Weak"
                    : newPassword.length < 8
                      ? "Fair"
                      : "Strong"}
                </span>
              </div>

              <div className="grid grid-cols-4 gap-1.5">
                {[1, 2, 3, 4].map((level) => (
                  <div
                    key={level}
                    className={`h-2 rounded-full transition-all duration-500 ${
                      newPassword.length >= level * 2
                        ? level <= 1
                          ? "bg-red-500"
                          : level <= 2
                            ? "bg-amber-500"
                            : level <= 3
                              ? "bg-green-500"
                              : "bg-green-600"
                        : "bg-gray-300"
                    }`}
                  />
                ))}
              </div>

              <div className="mt-3 text-xs text-gray-600 space-y-1">
                {newPassword.length < 8 ? (
                  <div className="flex items-center">
                    <FiAlertCircle className="w-3 h-3 mr-2" />
                    Add {8 - newPassword.length} more characters for a strong
                    password
                  </div>
                ) : (
                  <div className="flex items-center text-green-600">
                    <FiCheck className="w-3 h-3 mr-2" />
                    Your password meets security requirements
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Validation Warnings */}
          {currentPassword &&
            newPassword &&
            newPassword === currentPassword && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg"
              >
                <div className="flex items-start">
                  <FiAlertCircle className="w-5 h-5 text-red-600 mr-2 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">
                    New password must be different from your current password.
                    Please choose a different password.
                  </p>
                </div>
              </motion.div>
            )}

          <div className="mt-8 pt-6 border-t border-gray-300">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={
                isPasswordLoading ||
                !currentPassword ||
                !newPassword ||
                newPassword === currentPassword
              }
              className="inline-flex items-center px-6 py-3 bg-black text-white font-semibold rounded-lg hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPasswordLoading ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Changing Password...
                </>
              ) : (
                <>
                  <FiLock className="w-5 h-5 mr-2" />
                  Change Password
                </>
              )}
            </motion.button>

            <p className="mt-3 text-xs text-gray-500">
              Note: After changing your password, you'll be automatically logged
              out and need to log in again.
            </p>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default Settings;
