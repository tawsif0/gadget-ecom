/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import {
  ArrowRightIcon,
  EyeIcon,
  EyeSlashIcon,
  KeyIcon,
  EnvelopeIcon,
  PhoneIcon,
  HomeIcon,
} from "@heroicons/react/24/outline";
import { useAuth } from "../hooks/useAuth";
import usePublicSettings from "../hooks/usePublicSettings";
import { useThemeColors } from "../hooks/useThemeColors";
const baseUrl = import.meta.env.VITE_API_URL;
const Login = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [socialProviders, setSocialProviders] = useState({
    google: false,
    facebook: false,
  });
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();
  const { settings } = usePublicSettings();
  const { themeColor, buttonTextColor } = useThemeColors();

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm();

  // Load saved credentials if "Remember Me" was checked
  useEffect(() => {
    const savedLoginId = localStorage.getItem("rememberedLoginId");
    const savedRememberMe = localStorage.getItem("rememberMe") === "true";

    if (savedRememberMe && savedLoginId) {
      setRememberMe(true);
      setValue("loginId", savedLoginId);
    }
  }, [setValue]);

  useEffect(() => {
    setSocialProviders({
      google: Boolean(settings?.integrations?.enableGoogleLogin),
      facebook: Boolean(settings?.integrations?.enableFacebookLogin),
    });
  }, [settings]);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const socialError = query.get("socialError");
    const socialToken = query.get("token");
    const socialMode = query.get("social");

    if (!socialMode || (!socialError && !socialToken)) {
      return;
    }

    const clearSocialQuery = () => {
      navigate("/login", { replace: true });
    };

    if (socialError) {
      toast.error(socialError);
      clearSocialQuery();
      return;
    }

    const completeSocialLogin = async () => {
      try {
        setIsLoading(true);
        const response = await axios.get(`${baseUrl}/auth/profile`, {
          headers: { Authorization: `Bearer ${socialToken}` },
        });

        await login(response.data, socialToken);
        navigate("/dashboard", { replace: true });
      } catch (error) {
        toast.error(error.response?.data?.error || "Social login failed");
        clearSocialQuery();
      } finally {
        setIsLoading(false);
      }
    };

    completeSocialLogin();
  }, [login, navigate]);

  const loginId = watch("loginId");

  // Determine which icon to show based on input
  const getLoginIcon = () => {
    if (!loginId)
      return (
        <EnvelopeIcon className="h-5 w-5 text-gray-400 transition-colors duration-200" />
      );

    if (loginId.includes("@")) {
      return (
        <EnvelopeIcon className="h-5 w-5 text-gray-400 transition-colors duration-200" />
      );
    }

    // Check if it looks like a phone number
    const phoneRegex = /^[0-9+\-\s()]+$/;
    if (phoneRegex.test(loginId.replace(/\s/g, ""))) {
      return (
        <PhoneIcon className="h-5 w-5 text-gray-400 transition-colors duration-200" />
      );
    }

    return (
      <EnvelopeIcon className="h-5 w-5 text-gray-400 transition-colors duration-200" />
    );
  };

  const getPlaceholder = () => {
    if (!loginId) return "Email or phone number";
    if (loginId.includes("@")) return "Email address";
    return "Phone number (01XXXXXXXXX)";
  };

  const getHelperText = () => {
    if (!loginId) return "Enter your registered email or phone number";
    if (loginId.includes("@")) return "Enter your registered email address";
    return "Enter your registered phone number";
  };

  const onSubmit = async (data) => {
    setIsLoading(true);

    try {
      const payload = {
        loginId: data.loginId,
        password: data.password,
      };

      const response = await axios.post(`${baseUrl}/auth/login`, payload);

      // Save loginId if "Remember Me" is checked
      if (rememberMe) {
        localStorage.setItem("rememberedLoginId", data.loginId);
        localStorage.setItem("rememberMe", "true");
      } else {
        localStorage.removeItem("rememberedLoginId");
        localStorage.removeItem("rememberMe");
      }

      // Use the login function from useAuth to update the state
      login(response.data.user, response.data.token);

      // Navigate after toast is shown
      // setTimeout(() => {
      //   navigate("/dashboard");
      // }, 1000);
    } catch (error) {
      const errorMessage =
        error.response?.data?.error || "Failed to login. Please try again.";

      toast.error(errorMessage);

      console.error("Login error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const goToRegister = () => {
    navigate("/register");
    toast.success("Let's create your account!");
  };
  const goToHome = () => {
    navigate("/");
  };

  const startSocialLogin = (provider) => {
    const normalized = String(provider || "").toLowerCase();
    if (!["google", "facebook"].includes(normalized)) return;
    window.location.href = `${baseUrl}/auth/social/${normalized}`;
  };
  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-4 overflow-hidden">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md z-10"
      >
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.4, ease: "easeOut" }}
          className="mb-6 pt-4"
        >
          <motion.button
            whileHover={{
              scale: 1.02,
              y: -2,
              transition: { duration: 0.2, ease: "easeOut" },
            }}
            whileTap={{
              scale: 0.98,
              transition: { duration: 0.1 },
            }}
            onClick={goToHome}
            className="mx-auto flex items-center gap-2 px-4 py-1.5 text-xs font-semibold text-black tracking-wide group cursor-pointer select-none transition-all duration-300 rounded-xl hover:bg-gray-50/80 active:bg-gray-100 shadow-sm hover:shadow-md border border-gray-200/50 hover:border-gray-300 backdrop-blur-sm"
          >
            <motion.div
              className="shrink-0 w-4 h-4 rounded-full bg-linear-to-r from-gray-300 to-gray-400 group-hover:bg-linear-to-r group-hover:from-black group-hover:to-gray-900 shadow-sm"
              animate={{
                scale: [1, 1.1, 1],
                backgroundColor: ["#d1d5db", "#d1d5db", "#111827"],
              }}
              transition={{
                scale: {
                  duration: 0.6,
                  repeat: Infinity,
                  repeatType: "reverse",
                  ease: "easeInOut",
                },
                backgroundColor: {
                  duration: 2,
                  repeat: Infinity,
                  repeatType: "reverse",
                },
              }}
              whileHover={{ scale: 1.15 }}
            >
              <HomeIcon className="w-4 h-4 m-auto text-white/90" />
            </motion.div>
            <span className="leading-none relative">
              Return Home
              <motion.div
                className="absolute -bottom-1 left-0 w-0 h-0.5 bg-black rounded-full"
                initial={{ width: 0 }}
                whileHover={{ width: "100%" }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              />
            </span>
          </motion.button>
        </motion.div>
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
          >
            <h1 className="text-4xl font-bold text-black mb-3 tracking-tight">
              Welcome Back
            </h1>
          </motion.div>
          <p className="text-gray-600 text-sm tracking-wide">
            Sign in with your Email or Phone Number
          </p>
        </motion.div>

        <motion.div
          transition={{ duration: 0.2 }}
          className="bg-white rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-gray-100 p-8 backdrop-blur-sm bg-opacity-95"
        >
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <label
                htmlFor="loginId"
                className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wider"
              >
                Email or Phone Number
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                  {getLoginIcon()}
                </div>
                <input
                  id="loginId"
                  type="text"
                  {...register("loginId", {
                    required: "Email or phone number is required",
                    validate: (value) => {
                      if (!value) return true;

                      const trimmedValue = value.trim();
                      if (trimmedValue.includes("@")) {
                        const emailRegex =
                          /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
                        if (!emailRegex.test(trimmedValue)) {
                          return "Please enter a valid email address";
                        }
                        return true;
                      }

                      const phoneRegex = /^[0-9+\-\s()]{10,}$/;
                      const cleanPhone = trimmedValue.replace(/\s/g, "");
                      if (!phoneRegex.test(cleanPhone)) {
                        return "Please enter a valid phone number";
                      }

                      // Optional: Add specific length validation for phone
                      if (cleanPhone.length < 10 || cleanPhone.length > 15) {
                        return "Phone number should be between 10-15 digits";
                      }

                      return true;
                    },
                  })}
                  className={`w-full pl-12 pr-4 py-3 bg-gray-50/50 border-2 ${
                    errors.loginId
                      ? "border-red-400 focus:border-red-500"
                      : "border-gray-200 focus:border-black"
                  } rounded-xl focus:outline-none focus:ring-0 transition-all duration-300 placeholder-gray-400 text-black`}
                  placeholder={getPlaceholder()}
                />
              </div>
              {errors.loginId && (
                <motion.p
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-2 text-sm text-red-500 font-medium"
                >
                  {errors.loginId.message}
                </motion.p>
              )}
              <p className="text-xs text-gray-500 mt-2">{getHelperText()}</p>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wider"
              >
                Password
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
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center space-x-3">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={rememberMe}
                    aria-label="Remember me"
                    onClick={() => setRememberMe(!rememberMe)}
                    className={`app-toggle-switch focus:outline-none ${rememberMe ? "is-on" : ""}`}
                    style={{
                      backgroundColor: rememberMe
                        ? themeColor
                        : "rgba(226, 232, 240, 1)",
                      borderColor: rememberMe
                        ? themeColor
                        : "rgba(203, 213, 225, 1)",
                    }}
                  >
                    <span
                      className="app-toggle-switch__knob"
                      style={{
                        backgroundColor: rememberMe
                          ? buttonTextColor
                          : "#ffffff",
                      }}
                    />
                  </button>
                  <span className="text-sm font-medium text-gray-700">
                    Remember me
                  </span>
                </div>
              </div>

              <div>
                <Link
                  to="/forgot-password"
                  className="text-sm font-medium text-gray-600 hover:text-black transition-colors duration-200 border-b border-transparent hover:border-black"
                  onClick={() =>
                    toast.loading("Redirecting to password reset...", {
                      duration: 1000,
                    })
                  }
                >
                  Forgot password?
                </Link>
              </div>
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
                        xmlns="http://www.w3.org2000/svg"
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
                      Signing in...
                    </>
                  ) : (
                    <>
                      Sign In
                      <ArrowRightIcon className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform duration-200" />
                    </>
                  )}
                </span>
              </button>
            </motion.div>

            {(socialProviders.google || socialProviders.facebook) && (
              <div className="space-y-2 pt-1">
                {socialProviders.google && (
                  <button
                    type="button"
                    onClick={() => startSocialLogin("google")}
                    className="w-full py-3 px-4 border-2 border-gray-300 rounded-xl text-sm font-semibold text-black bg-white hover:bg-gray-50 hover:border-black transition-all duration-300"
                  >
                    Continue with Google
                  </button>
                )}
                {socialProviders.facebook && (
                  <button
                    type="button"
                    onClick={() => startSocialLogin("facebook")}
                    className="w-full py-3 px-4 border-2 border-gray-300 rounded-xl text-sm font-semibold text-black bg-white hover:bg-gray-50 hover:border-black transition-all duration-300"
                  >
                    Continue with Facebook
                  </button>
                )}
              </div>
            )}
          </form>

          <div className="mt-8">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <div className="relative flex justify-center">
                <span className="px-4 bg-white text-xs font-medium text-gray-500 uppercase tracking-wider">
                  New to us?
                </span>
              </div>
            </div>

            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="mt-6"
            >
              <button
                onClick={goToRegister}
                type="button"
                className="w-full py-3 px-4 border-2 border-gray-300 rounded-xl text-sm font-semibold text-black bg-white hover:bg-gray-50 hover:border-black focus:outline-none transition-all duration-300 group"
              >
                <span className="flex items-center justify-center">
                  Create New Account
                  <ArrowRightIcon className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform duration-200" />
                </span>
              </button>
            </motion.div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default Login;
