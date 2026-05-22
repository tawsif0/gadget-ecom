/* eslint-disable no-unused-vars */
import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import {
  ArrowLeftIcon,
  EnvelopeIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";
const baseUrl = import.meta.env.VITE_API_URL;
const ForgotPassword = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm();

  const onSubmit = async (data) => {
    setIsLoading(true);
    const loadingToast = toast.loading("Sending reset link...");

    try {
      const response = await axios.post(
        `${baseUrl}/auth/forgot-password`,
        data,
      );

      toast.dismiss(loadingToast);

      if (response.data.success) {
        setEmailSent(true);
        reset();

        toast.success(
          <div className="flex items-center space-x-2">
            <CheckCircleIcon className="h-5 w-5 text-green-500" />
            <span>{response.data.message}</span>
          </div>,
          {
            duration: 5000,
          },
        );
      }
    } catch (error) {
      toast.dismiss(loadingToast);

      const errorMessage =
        error.response?.data?.error || "Failed to send reset link";
      toast.error(errorMessage, { duration: 4000 });

      console.error("Forgot password error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const goToLogin = () => {
    navigate("/login");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <button
            onClick={goToLogin}
            className="inline-flex items-center text-gray-600 hover:text-black mb-6"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Back to Login
          </button>

          <h1 className="text-3xl font-bold text-black mb-2">
            Forgot Password?
          </h1>
          <p className="text-gray-600">
            Enter your email address to reset your password
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-gray-100 p-8">
          {emailSent ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-8"
            >
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                <CheckCircleIcon className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-black mb-2">
                Check Your Email
              </h3>
              <p className="text-gray-600 mb-6">
                We've sent a password reset link to your email address. Please
                check your inbox and follow the instructions.
              </p>
              <p className="text-sm text-gray-500 mb-6">
                The link will expire in 30 minutes.
              </p>
              <button
                onClick={goToLogin}
                className="w-full py-3 px-4 bg-black text-white rounded-xl font-medium hover:bg-gray-800 transition-colors"
              >
                Return to Login
              </button>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                    <EnvelopeIcon className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="email"
                    {...register("email", {
                      required: "Email is required",
                      pattern: {
                        value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                        message: "Invalid email address",
                      },
                    })}
                    className={`w-full pl-12 pr-4 py-3 bg-gray-50 border-2 rounded-xl focus:outline-none focus:ring-0 transition-all ${
                      errors.email
                        ? "border-red-400 focus:border-red-500"
                        : "border-gray-200 focus:border-black"
                    }`}
                    placeholder="you@example.com"
                  />
                </div>
                {errors.email && (
                  <p className="mt-2 text-sm text-red-500">
                    {errors.email.message}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 px-4 border-2 border-black rounded-xl text-sm font-semibold text-white bg-black hover:bg-gray-900 focus:outline-none transition-all duration-300 disabled:opacity-50"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center">
                    <svg
                      className="animate-spin h-5 w-5 mr-3 text-white"
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
                    Sending Reset Link...
                  </div>
                ) : (
                  "Send Reset Link"
                )}
              </button>

              <div className="text-center">
                <p className="text-sm text-gray-600">
                  Remember your password?{" "}
                  <Link
                    to="/login"
                    className="font-medium text-black hover:underline"
                  >
                    Sign in
                  </Link>
                </p>
              </div>
            </form>
          )}
        </div>

        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            Need help? Contact our support team at{" "}
            <a
              href="mailto:support@example.com"
              className="text-black font-medium hover:underline"
            >
              support@example.com
            </a>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default ForgotPassword;
