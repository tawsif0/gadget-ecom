/* eslint-disable no-unused-vars */
// client/src/pages/ResetPassword.jsx
import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useParams } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import { motion, AnimatePresence } from "framer-motion";
import {
  EyeIcon,
  EyeSlashIcon,
  KeyIcon,
  ArrowLeftIcon,
  CheckCircleIcon,
  LockClosedIcon,
} from "@heroicons/react/24/outline";
const baseUrl = import.meta.env.VITE_API_URL;
const ResetPassword = () => {
  const { token } = useParams();
  const [isLoading, setIsLoading] = useState(false);
  const [passwordReset, setPasswordReset] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm();

  const password = watch("password");
  const confirmPassword = watch("confirmPassword");

  const onSubmit = async (data) => {
    setIsLoading(true);
    try {
      await axios.post(`${baseUrl}/auth/reset-password/${token}`, data);
      setPasswordReset(true);
      toast.success("Password reset successfully!");
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to reset password");
    } finally {
      setIsLoading(false);
    }
  };

  if (passwordReset) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white p-4 overflow-hidden">
        {/* Decorative background elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-80 h-80 bg-linear-to-br from-emerald-50/50 to-white rounded-full mix-blend-multiply opacity-70 blur-xl animate-pulse"></div>
          <div className="absolute bottom-20 right-10 w-80 h-80 bg-linear-to-tl from-emerald-50/50 to-white rounded-full mix-blend-multiply opacity-70 blur-xl animate-pulse delay-1000"></div>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md z-10 text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring" }}
            className="inline-flex items-center justify-center h-24 w-24 rounded-full bg-emerald-50 border-4 border-emerald-100 mb-6"
          >
            <CheckCircleIcon className="h-12 w-12 text-emerald-600" />
          </motion.div>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <h1 className="text-4xl font-bold text-black mb-4 tracking-tight">
              Password Reset Successful!
            </h1>
            <p className="text-gray-600 mb-8 max-w-sm mx-auto">
              Your password has been updated successfully. You can now log in
              with your new credentials.
            </p>
          </motion.div>

          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <Link
              to="/login"
              className="inline-flex items-center px-6 py-3 border-2 border-black rounded-xl text-sm font-semibold text-black bg-white hover:bg-gray-50 focus:outline-none transition-all duration-300 group"
            >
              <ArrowLeftIcon className="h-4 w-4 mr-2 group-hover:-translate-x-1 transition-transform duration-200" />
              Return to Login
            </Link>
          </motion.div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-4 overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-10 left-10 w-72 h-72 bg-linear-to-br from-gray-50 to-white rounded-full mix-blend-multiply opacity-70 blur-xl animate-pulse"></div>
        <div className="absolute bottom-10 right-10 w-72 h-72 bg-linear-to-tr from-gray-50 to-white rounded-full mix-blend-multiply opacity-70 blur-xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-linear-to-r from-gray-50 to-white rounded-full mix-blend-multiply opacity-50 blur-xl animate-pulse delay-500"></div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md z-10"
      >
        <motion.div
          initial={{ scale: 0.95 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.3 }}
          className="text-center mb-8"
        >
          <motion.div
            initial={{ y: -10 }}
            animate={{ y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex justify-center mb-4"
          >
            <div className="h-16 w-16 rounded-full bg-gray-50 flex items-center justify-center border-2 border-gray-100">
              <LockClosedIcon className="h-10 w-10 text-gray-600" />
            </div>
          </motion.div>
          <h1 className="text-4xl font-bold text-black mb-3 tracking-tight">
            Set New Password
          </h1>
          <p className="text-gray-600 text-sm tracking-wide">
            Create a new secure password for your account
          </p>
        </motion.div>

        <motion.div
          transition={{ duration: 0.2 }}
          className="bg-white rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-gray-100 p-8 backdrop-blur-sm bg-opacity-95"
        >
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <label
                htmlFor="password"
                className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wider"
              >
                New Password
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                  <KeyIcon className="h-5 w-5 text-gray-400 transition-colors duration-200" />
                </div>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  {...register("password", {
                    required: "Password is required",
                    minLength: {
                      value: 8,
                      message: "Password must be at least 8 characters",
                    },
                  })}
                  className={`w-full pl-12 pr-12 py-3 bg-gray-50/50 border-2 ${
                    errors.password
                      ? "border-red-400 focus:border-red-500"
                      : "border-gray-200 focus:border-black"
                  } rounded-xl focus:outline-none focus:ring-0 transition-all duration-300 placeholder-gray-400 text-black`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 transition-all duration-200"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeSlashIcon className="h-5 w-5 text-gray-600" />
                  ) : (
                    <EyeIcon className="h-5 w-5 text-gray-600" />
                  )}
                </button>
              </div>
              {errors.password && (
                <motion.p
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-2 text-sm text-red-500 font-medium"
                >
                  {errors.password.message}
                </motion.p>
              )}

              {/* Password Strength Indicator */}
              {password && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="mt-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-600">
                      Password Strength
                    </span>
                    <span
                      className={`text-xs font-bold ${
                        password.length < 4
                          ? "text-red-500"
                          : password.length < 8
                            ? "text-amber-500"
                            : "text-emerald-500"
                      }`}
                    >
                      {password.length < 4
                        ? "WEAK"
                        : password.length < 8
                          ? "GOOD"
                          : "STRONG"}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    {[1, 2, 3, 4].map((level) => (
                      <div
                        key={level}
                        className={`h-1.5 rounded-full transition-all duration-500 ${
                          password.length >= level * 2
                            ? level <= 1
                              ? "bg-red-400"
                              : level <= 2
                                ? "bg-amber-400"
                                : level <= 3
                                  ? "bg-emerald-400"
                                  : "bg-emerald-500"
                            : "bg-gray-200"
                        }`}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wider"
              >
                Confirm Password
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  {...register("confirmPassword", {
                    required: "Please confirm your password",
                    validate: (value) => {
                      if (!password) {
                        return "Please fill in the password first";
                      }
                      return value === password || "Passwords don't match";
                    },
                  })}
                  className={`w-full pl-4 pr-12 py-3 bg-gray-50/50 border-2 ${
                    errors.confirmPassword
                      ? "border-red-400 focus:border-red-500"
                      : "border-gray-200 focus:border-black"
                  } rounded-xl focus:outline-none focus:ring-0 transition-all duration-300 placeholder-gray-400 text-black`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 transition-all duration-200"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeSlashIcon className="h-5 w-5 text-gray-600" />
                  ) : (
                    <EyeIcon className="h-5 w-5 text-gray-600" />
                  )}
                </button>
              </div>
              {errors.confirmPassword && (
                <motion.p
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-2 text-sm text-red-500 font-medium"
                >
                  {errors.confirmPassword.message}
                </motion.p>
              )}

              {/* Animated password match indicator */}
              {password && confirmPassword && !errors.confirmPassword && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="mt-2 flex items-center space-x-2"
                >
                  <div className="h-5 w-5 bg-emerald-100 rounded-full flex items-center justify-center">
                    <CheckCircleIcon className="h-3 w-3 text-emerald-600" />
                  </div>
                  <span className="text-sm font-medium text-emerald-600">
                    Passwords match
                  </span>
                </motion.div>
              )}
            </div>

            <motion.div
              whileTap={{ scale: 0.98 }}
              transition={{ duration: 0.2 }}
            >
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 px-4 border-2 border-black rounded-xl shadow-lg text-sm font-semibold text-white bg-black hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                <span className="flex items-center justify-center">
                  {isLoading ? (
                    <>
                      <svg
                        className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                        xmlns="http://www.w3.org/2000/svg"
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
                      Processing...
                    </>
                  ) : (
                    <>
                      Reset Password
                      <ArrowLeftIcon className="ml-2 h-5 w-5 group-hover:-translate-x-1 rotate-180 transition-transform duration-200" />
                    </>
                  )}
                </span>
              </button>
            </motion.div>
          </form>

          <div className="mt-4 pt-2 border-t border-gray-100 flex justify-center">
            <Link
              to="/login"
              className="inline-flex items-center text-sm font-medium text-gray-600 hover:text-black transition-colors duration-200 group"
            >
              <ArrowLeftIcon className="h-4 w-4 mr-2 group-hover:-translate-x-1 transition-transform duration-200" />
              Back to login
            </Link>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-8 text-center"
        >
          <p className="text-xs text-gray-500">
            Make sure your new password is strong and unique.
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default ResetPassword;
