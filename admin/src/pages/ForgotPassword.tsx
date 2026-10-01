import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Eye, EyeOff, Lock, Mail } from "lucide-react";
import logo from "../assets/farmcraft-logo-full.png";
import productHero from "../assets/products/grain-vac-6.jpeg";
import { ApiError } from "../lib/apiClient";
import {
  forgotAdminPassword,
  verifyAdminResetCode,
  resetAdminPassword,
} from "../lib/authApi";

type Step = "email" | "code" | "password";

export default function ForgotPassword() {
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const getError = (err: unknown) => {
    if (err instanceof ApiError) {
      return err.message;
    }

    return "Something went wrong. Please try again.";
  };

  const handleSendCode = async (e: FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      setError("Please enter your email.");
      return;
    }

    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      await forgotAdminPassword(email.trim());

      setMessage(
        "If this email is registered, a password reset code has been sent."
      );

      setStep("code");
    } catch (err) {
      setError(getError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyCode = async (e: FormEvent) => {
    e.preventDefault();

    if (!/^\d{6}$/.test(code)) {
      setError("Please enter the 6-digit reset code.");
      return;
    }

    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      await verifyAdminResetCode(email.trim(), code);

      setMessage("Code verified. You can now create a new password.");
      setStep("password");
    } catch (err) {
      setError(getError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (e: FormEvent) => {
    e.preventDefault();

    if (password.length < 8) {
      setError("Password must contain at least 8 characters.");
      return;
    }

    if (!/[A-Z]/.test(password)) {
      setError("Password must contain at least one uppercase letter.");
      return;
    }

    if (!/[a-z]/.test(password)) {
      setError("Password must contain at least one lowercase letter.");
      return;
    }

    if (!/[0-9]/.test(password)) {
      setError("Password must contain at least one number.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      await resetAdminPassword(email.trim(), password);

      setMessage(
        "Password reset successful. You can now sign in with your new password."
      );

      setTimeout(() => {
        navigate("/admin/login");
      }, 1200);
    } catch (err) {
      setError(getError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-farm-cream">
      {/* Left visual panel */}
      <div className="relative hidden w-1/2 overflow-hidden bg-farm-charcoal-deep lg:block">
        <img
          src={productHero}
          alt="Farm Craft agricultural machinery"
          className="h-full w-full object-cover opacity-40"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-farm-charcoal-deep via-farm-charcoal-deep/60 to-farm-green-900/40" />

        <div className="absolute inset-0 flex flex-col justify-between p-12">
          <div className="flex items-center gap-3">
            <img
              src={logo}
              alt="Farm Craft"
              className="h-11 w-28 shrink-0 rounded-lg bg-white object-contain p-1"
            />

            <span className="font-display text-xl font-bold tracking-tight text-white">
              FARM CRAFT
            </span>
          </div>

          <div>
            <h2 className="font-display text-3xl font-bold leading-tight text-white xl:text-4xl">
              Manage your agricultural
              <br />
              equipment business, end to end.
            </h2>

            <p className="mt-4 max-w-md text-sm text-farm-mist/70">
              Products, orders, customers and offers — all in one premium admin
              workspace built for the Farm Craft team.
            </p>
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex w-full flex-1 items-center justify-center px-5 py-10 sm:px-8 lg:w-1/2">
        <div className="w-full max-w-sm animate-fade-in">
          <div className="mb-8 flex flex-col items-center text-center lg:items-start lg:text-left">
            <img
              src={logo}
              alt="Farm Craft"
              className="mb-4 h-20 w-32 rounded-xl bg-white object-contain p-1 shadow-card"
            />

            <h1 className="font-display text-2xl font-bold text-farm-charcoal-deep">
              Forgot Password?
            </h1>

            <p className="mt-1 text-sm text-farm-charcoal/55">
              {step === "email" &&
                "Enter your registered admin email."}

              {step === "code" &&
                "Enter the reset code sent to your email."}

              {step === "password" &&
                "Create a new password for your admin account."}
            </p>
          </div>

          {step === "email" && (
            <form onSubmit={handleSendCode} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-farm-charcoal-deep">
                  Email
                </label>

                <div className="relative">
                  <Mail
                    size={16}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-farm-charcoal/40"
                  />

                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    autoComplete="email"
                    className="w-full rounded-xl border border-black/10 bg-white py-2.5 pl-10 pr-3 text-sm text-farm-charcoal-deep placeholder:text-farm-charcoal/30 focus:border-farm-green-600 focus:outline-none focus:ring-2 focus:ring-farm-green-100"
                  />
                </div>
              </div>

              {error && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-farm-green-700 py-2.5 text-sm font-semibold text-white shadow-card transition-colors hover:bg-farm-green-800 disabled:opacity-60"
              >
                {submitting ? "Sending..." : "Send Reset Code"}
              </button>
            </form>
          )}

          {step === "code" && (
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-farm-charcoal-deep">
                  Reset Code
                </label>

                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  value={code}
                  onChange={(e) =>
                    setCode(e.target.value.replace(/\D/g, ""))
                  }
                  placeholder="Enter 6-digit code"
                  className="w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-center text-sm tracking-[0.35em] text-farm-charcoal-deep placeholder:text-farm-charcoal/30 placeholder:tracking-normal focus:border-farm-green-600 focus:outline-none focus:ring-2 focus:ring-farm-green-100"
                />
              </div>

              {message && (
                <p className="rounded-lg bg-farm-green-50 px-3 py-2 text-xs text-farm-green-700">
                  {message}
                </p>
              )}

              {error && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-farm-green-700 py-2.5 text-sm font-semibold text-white shadow-card transition-colors hover:bg-farm-green-800 disabled:opacity-60"
              >
                {submitting ? "Verifying..." : "Verify Reset Code"}
              </button>
            </form>
          )}

          {step === "password" && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              {/* New Password */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-farm-charcoal-deep">
                  New Password
                </label>

                <div className="relative">
                  <Lock
                    size={16}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-farm-charcoal/40"
                  />

                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter new password"
                    autoComplete="new-password"
                    className="w-full rounded-xl border border-black/10 bg-white py-2.5 pl-10 pr-10 text-sm text-farm-charcoal-deep placeholder:text-farm-charcoal/30 focus:border-farm-green-600 focus:outline-none focus:ring-2 focus:ring-farm-green-100"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-farm-charcoal/40 hover:text-farm-charcoal"
                  >
                    {showPassword ? (
                      <EyeOff size={16} />
                    ) : (
                      <Eye size={16} />
                    )}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-farm-charcoal-deep">
                  Confirm New Password
                </label>

                <div className="relative">
                  <Lock
                    size={16}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-farm-charcoal/40"
                  />

                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    autoComplete="new-password"
                    className="w-full rounded-xl border border-black/10 bg-white py-2.5 pl-10 pr-10 text-sm text-farm-charcoal-deep placeholder:text-farm-charcoal/30 focus:border-farm-green-600 focus:outline-none focus:ring-2 focus:ring-farm-green-100"
                  />

                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-farm-charcoal/40 hover:text-farm-charcoal"
                  >
                    {showConfirmPassword ? (
                      <EyeOff size={16} />
                    ) : (
                      <Eye size={16} />
                    )}
                  </button>
                </div>
              </div>

              <div className="rounded-lg bg-farm-green-50 px-3 py-2 text-xs text-farm-charcoal/60">
                Password must contain at least 8 characters, one uppercase
                letter, one lowercase letter, and one number.
              </div>

              {message && (
                <p className="rounded-lg bg-farm-green-50 px-3 py-2 text-xs text-farm-green-700">
                  {message}
                </p>
              )}

              {error && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-farm-green-700 py-2.5 text-sm font-semibold text-white shadow-card transition-colors hover:bg-farm-green-800 disabled:opacity-60"
              >
                {submitting ? "Updating..." : "Reset Password"}
              </button>
            </form>
          )}

          <div className="mt-5 text-center">
            <Link
              to="/admin/login"
              className="inline-flex items-center gap-2 text-xs font-medium text-farm-green-700 hover:text-farm-green-800"
            >
              <ArrowLeft size={14} />
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}