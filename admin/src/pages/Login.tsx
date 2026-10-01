import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../lib/apiClient";
import logo from "../assets/farmcraft-logo-full.png";
import productHero from "../assets/products/grain-vac-6.jpeg";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      setError("Please enter your email.");
      return;
    }

    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      await login(email.trim(), password);
      navigate("/admin/dashboard");
    } catch (err) {
      if (err instanceof ApiError) {
        // Never expose whether the email exists.
        if (err.status === 401) {
          setError("Invalid email or password.");
        } else {
          setError(err.message);
        }
      } else {
        setError(
          "Could not sign in. Please check your connection and try again."
        );
      }
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

          <p className="text-xs text-farm-mist/40"></p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex w-full flex-1 items-center justify-center px-5 py-10 sm:px-8 lg:w-1/2">
        <div className="w-full max-w-sm animate-fade-in">
          <div className="mb-8 flex flex-col items-center text-center lg:items-start lg:text-left">
            <img
              src={logo}
              alt="Farm Craft"
              className="mb-4 h-20 w-32 rounded-xl bg-white object-contain p-1 shadow-card"
            />

            <h1 className="font-display text-2xl font-bold text-farm-charcoal-deep">
              Admin Portal
            </h1>

            <p className="mt-1 text-sm text-farm-charcoal/55">
              Sign in to manage Farm Craft operations.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
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

            {/* Password */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-farm-charcoal-deep">
                Password
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
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  className="w-full rounded-xl border border-black/10 bg-white py-2.5 pl-10 pr-10 text-sm text-farm-charcoal-deep placeholder:text-farm-charcoal/30 focus:border-farm-green-600 focus:outline-none focus:ring-2 focus:ring-farm-green-100"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-farm-charcoal/40 hover:text-farm-charcoal"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff size={16} />
                  ) : (
                    <Eye size={16} />
                  )}
                </button>
              </div>

              {/* Forgot Password */}
              <div className="mt-2 text-right">
                <Link
                  to="/admin/forgot-password"
                  className="text-xs font-medium text-farm-green-700 hover:text-farm-green-800"
                >
                  Forgot Password?
                </Link>
              </div>
            </div>

            {/* Error */}
            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
                {error}
              </p>
            )}

            {/* Login */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-farm-green-700 py-2.5 text-sm font-semibold text-white shadow-card transition-colors hover:bg-farm-green-800 disabled:opacity-60"
            >
              {submitting ? "Signing in..." : "Login"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}