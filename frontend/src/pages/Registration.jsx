import React, { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import { useDispatch } from "react-redux";
import {
  ArrowRightIcon,
  EyeIcon,
  EyeSlashIcon,
  EnvelopeIcon,
  HomeIcon,
  KeyIcon,
  PhoneIcon,
  UserIcon,
} from "@heroicons/react/24/outline";
import usePublicSettings from "../hooks/usePublicSettings";
import { loadPublicSettings } from "../store/publicSettingsSlice";

const baseUrl = import.meta.env.VITE_API_URL;
const EMAIL_PATTERN = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

const STEP_TITLES = ["Basic Info", "Security"];

const Field = ({ label, icon: Icon, error, rightElement, children }) => (
  <div className="space-y-2">
    <label className="block text-[15px] font-semibold text-slate-700">
      {label}
    </label>
    <div className="relative">
      {Icon ? (
        <Icon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
      ) : null}
      {children}
      {rightElement ? (
        <div className="absolute right-4 top-1/2 -translate-y-1/2">
          {rightElement}
        </div>
      ) : null}
    </div>
    {error ? <p className="text-sm text-red-500">{error.message}</p> : null}
  </div>
);

const isValidEmailFormat = (value) =>
  EMAIL_PATTERN.test(String(value || "").trim());

const normalizeBangladeshiPhone = (value) => {
  const clean = String(value || "").replace(/[^0-9]/g, "");

  if (!clean) return "";
  if (clean.startsWith("880")) return clean.slice(3);
  if (clean.startsWith("88")) return clean.slice(2);
  if (clean.startsWith("0")) return clean;
  return `0${clean}`;
};

const isValidBangladeshiPhone = (value) =>
  /^0[1-9][3-9]\d{8}$/.test(normalizeBangladeshiPhone(value));

const Register = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { settings, loaded } = usePublicSettings();

  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [isInitialSetup, setIsInitialSetup] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const availabilityControllersRef = useRef({ email: null, phone: null });

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    setError,
    trigger,
    watch,
  } = useForm({
    mode: "onChange",
    reValidateMode: "onChange",
    shouldUnregister: false,
  });

  const password = watch("password");
  const totalSteps = STEP_TITLES.length;
  const isFinalStep = currentStep === totalSteps;
  const stepTitle =
    STEP_TITLES[currentStep - 1] || STEP_TITLES[STEP_TITLES.length - 1];

  useEffect(() => {
    if (!loaded) {
      setIsInitialSetup(false);
      setCurrentStep(1);
      return;
    }

    const initialSetupMode = Boolean(settings?.isInitialSetup);
    setIsInitialSetup(initialSetupMode);
    setCurrentStep(1);
  }, [loaded, settings]);

  useEffect(() => {
    dispatch(loadPublicSettings({ force: true }));
  }, [dispatch]);

  useEffect(
    () => () => {
      availabilityControllersRef.current.email?.abort?.();
      availabilityControllersRef.current.phone?.abort?.();
    },
    [],
  );

  const checkAvailability = async ({ field, value }) => {
    const trimmedValue = String(value || "").trim();

    if (!trimmedValue) {
      return true;
    }

    if (field === "email" && !isValidEmailFormat(trimmedValue)) {
      return true;
    }

    if (field === "phone" && !isValidBangladeshiPhone(trimmedValue)) {
      return true;
    }

    availabilityControllersRef.current[field]?.abort?.();
    const controller = new AbortController();
    availabilityControllersRef.current[field] = controller;

    try {
      const response = await axios.get(
        `${baseUrl}/auth/register/availability`,
        {
          params:
            field === "email"
              ? { email: trimmedValue }
              : { phone: trimmedValue },
          signal: controller.signal,
        },
      );

      if (field === "email") {
        return response.data?.emailExists ? "Email already in use" : true;
      }

      return response.data?.phoneExists ? "Phone number already in use" : true;
    } catch (error) {
      if (error?.code === "ERR_CANCELED" || error?.name === "CanceledError") {
        return true;
      }

      return (
        error.response?.data?.error || "Unable to verify this value right now"
      );
    }
  };

  const handleGoHome = () => {
    navigate("/");
  };

  const validateCurrentStep = async () => {
    if (currentStep === 1) {
      return trigger(["name", "email", "phone"]);
    }

    if (isFinalStep) {
      return trigger(["password", "confirmPassword"]);
    }

    return true;
  };

  const handleNextStep = async () => {
    if (isFinalStep) {
      return;
    }

    const canProceed = await validateCurrentStep();
    if (!canProceed) {
      return;
    }

    setCurrentStep((previous) => Math.min(previous + 1, totalSteps));
  };

  const handleBackStep = () => {
    setCurrentStep((previous) => Math.max(previous - 1, 1));
  };

  const onSubmit = async (data) => {
    setIsLoading(true);

    try {
      const payload = {
        name: data.name,
        email: data.email,
        phone: data.phone,
        password: data.password,
        accountType: "user",
      };

      const response = await axios.post(`${baseUrl}/auth/register`, payload);

      if (response?.data?.user?.adminSettings?.isSuperAdmin) {
        toast.success("Super Admin account created successfully.");
      } else {
        toast.success("Account created successfully.");
      }

      dispatch(loadPublicSettings({ force: true }));
      navigate("/login", { replace: true });
    } catch (error) {
      const message =
        error.response?.data?.error || "Failed to register. Please try again.";

      if (/email already in use/i.test(message)) {
        setError("email", { type: "server", message: "Email already in use" });
        setCurrentStep(1);
      } else if (/phone number already in use/i.test(message)) {
        setError("phone", {
          type: "server",
          message: "Phone number already in use",
        });
        setCurrentStep(1);
      } else {
        toast.error(message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const buttonText =
    currentStep === 1
      ? "Continue to Step 2"
      : isInitialSetup
        ? "Create Super Admin"
        : "Create Account";

  const primaryDisabled = isLoading || !isValid;

  const renderSecurityStep = () => (
    <div className="space-y-6">
      <div className="space-y-6">
        <Field
          label="Password"
          icon={KeyIcon}
          error={errors.password}
          rightElement={
            <button
              type="button"
              onClick={() => setShowPassword((previous) => !previous)}
              className="text-slate-500"
            >
              {showPassword ? (
                <EyeSlashIcon className="h-5 w-5" />
              ) : (
                <EyeIcon className="h-5 w-5" />
              )}
            </button>
          }
        >
          <input
            type={showPassword ? "text" : "password"}
            {...register("password", {
              required: "Password is required",
              minLength: {
                value: 8,
                message: "Password must be at least 8 characters",
              },
            })}
            className="h-16 w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-4 pl-12 pr-12 text-[15px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:bg-white focus:shadow-[0_0_0_4px_rgba(15,23,42,0.04)]"
            placeholder="********"
          />
        </Field>

        <Field
          label="Confirm Password"
          icon={KeyIcon}
          error={errors.confirmPassword}
          rightElement={
            <button
              type="button"
              onClick={() => setShowConfirmPassword((previous) => !previous)}
              className="text-slate-500"
            >
              {showConfirmPassword ? (
                <EyeSlashIcon className="h-5 w-5" />
              ) : (
                <EyeIcon className="h-5 w-5" />
              )}
            </button>
          }
        >
          <input
            type={showConfirmPassword ? "text" : "password"}
            {...register("confirmPassword", {
              required: "Please confirm your password",
              validate: (value) =>
                value === password || "Passwords do not match",
            })}
            className="h-16 w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-4 pl-12 pr-12 text-[15px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:bg-white focus:shadow-[0_0_0_4px_rgba(15,23,42,0.04)]"
            placeholder="********"
          />
        </Field>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-white px-4 py-8">
      <div className="mx-auto flex w-full max-w-md flex-col items-center">
        <button
          type="button"
          onClick={handleGoHome}
          className="mx-auto inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-slate-500">
            <HomeIcon className="h-3.5 w-3.5" />
          </span>
          Return Home
        </button>

        <div className="mt-8 text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-950 md:text-[46px]">
            {isInitialSetup ? "Super Admin Account Creation" : "Create Account"}
          </h1>
          <p className="mt-3 text-[15px] text-slate-500">
            Fill in your details to get started
          </p>
        </div>

        <div className="mt-8 w-full rounded-[30px] border border-slate-100 bg-white p-8 shadow-[0_24px_80px_rgba(15,23,42,0.10)]">
          <div className="flex items-center justify-between text-sm font-semibold text-slate-600">
            <span>
              Step {currentStep} of {totalSteps}
            </span>
            <span>{stepTitle}</span>
          </div>

          <div className="mt-3 h-1.75 rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-black transition-all duration-300"
              style={{ width: `${(currentStep / totalSteps) * 100}%` }}
            />
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-7">
            {currentStep === 1 ? (
              <div className="space-y-6">
                <Field label="Full Name" icon={UserIcon} error={errors.name}>
                  <input
                    type="text"
                    {...register("name", {
                      required: "Name is required",
                      minLength: {
                        value: 3,
                        message: "Name must be at least 3 characters",
                      },
                    })}
                    className="h-16 w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-4 pl-12 text-[15px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:bg-white focus:shadow-[0_0_0_4px_rgba(15,23,42,0.04)]"
                    placeholder="John Doe"
                  />
                </Field>

                <Field
                  label="Email Address"
                  icon={EnvelopeIcon}
                  error={errors.email}
                >
                  <input
                    type="email"
                    {...register("email", {
                      required: "Email is required",
                      pattern: {
                        value: EMAIL_PATTERN,
                        message: "Invalid email address",
                      },
                      validate: {
                        unique: async (value) =>
                          checkAvailability({ field: "email", value }),
                      },
                    })}
                    className={`h-16 w-full rounded-2xl border px-4 py-4 pl-12 text-[15px] text-slate-900 outline-none transition placeholder:text-slate-400 ${
                      errors.email
                        ? "border-red-500 bg-red-50 focus:border-red-500 focus:bg-white focus:shadow-[0_0_0_4px_rgba(239,68,68,0.10)]"
                        : "border-slate-200 bg-slate-50/70 focus:border-slate-300 focus:bg-white focus:shadow-[0_0_0_4px_rgba(15,23,42,0.04)]"
                    }`}
                    placeholder="you@example.com"
                  />
                </Field>

                <Field
                  label="Phone Number"
                  icon={PhoneIcon}
                  error={errors.phone}
                >
                  <input
                    type="tel"
                    {...register("phone", {
                      required: "Phone number is required",
                      validate: {
                        validBangladeshi: (value) =>
                          isValidBangladeshiPhone(value) ||
                          "Enter a valid phone number",
                        unique: async (value) =>
                          checkAvailability({ field: "phone", value }),
                      },
                    })}
                    className={`h-16 w-full rounded-2xl border px-4 py-4 pl-12 text-[15px] text-slate-900 outline-none transition placeholder:text-slate-400 ${
                      errors.phone
                        ? "border-red-500 bg-red-50 focus:border-red-500 focus:bg-white focus:shadow-[0_0_0_4px_rgba(239,68,68,0.10)]"
                        : "border-slate-200 bg-slate-50/70 focus:border-slate-300 focus:bg-white focus:shadow-[0_0_0_4px_rgba(15,23,42,0.04)]"
                    }`}
                    placeholder="01XXXXXXXXX or +8801XXXXXXXXX"
                  />
                </Field>
              </div>
            ) : null}

            {isFinalStep ? renderSecurityStep() : null}

            <div className="space-y-4 pt-1">
              <button
                type={isFinalStep ? "submit" : "button"}
                onClick={isFinalStep ? undefined : handleNextStep}
                disabled={primaryDisabled}
                className="flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-[#8d8d8d] px-5 text-[15px] font-semibold text-white shadow-sm transition enabled:bg-black enabled:hover:bg-slate-900 disabled:cursor-not-allowed disabled:bg-[#8d8d8d] disabled:text-white"
              >
                <span>{buttonText}</span>
                <ArrowRightIcon className="h-5 w-5" />
              </button>

              {currentStep > 1 ? (
                <div className="flex justify-center pt-1">
                  <button
                    type="button"
                    onClick={handleBackStep}
                    className="rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-500 shadow-sm transition hover:bg-slate-50 hover:text-slate-800"
                  >
                    Back
                  </button>
                </div>
              ) : null}
            </div>

            <div className="border-t border-slate-100 pt-5">
              <p className="text-center text-[15px] text-slate-500">
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => navigate("/login")}
                  className="inline-flex items-center gap-1.5 font-semibold text-slate-950"
                >
                  Sign In
                  <ArrowRightIcon className="h-4 w-4" />
                </button>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Register;
