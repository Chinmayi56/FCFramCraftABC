// Admin authentication against the real FastAPI backend.

import { apiRequest } from "./apiClient";

export interface AdminUser {
  name: string;
  email: string;
  role: string;
}

interface UserOut {
  id: string;
  name: string | null;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

interface TokenResponse {
  access_token: string;
  token_type: string;
  user: UserOut;
}

function toAdminUser(user: UserOut): AdminUser {
  return {
    name: user.name ?? user.email,
    email: user.email,
    role: user.role,
  };
}

export async function adminLogin(
  email: string,
  password: string
): Promise<{ token: string; admin: AdminUser }> {
  const data = await apiRequest<TokenResponse>("/api/auth/admin/login", {
    method: "POST",
    auth: false,
    body: {
      email,
      password,
    },
  });

  return {
    token: data.access_token,
    admin: toAdminUser(data.user),
  };
}

/**
 * Start admin password reset.
 */
export async function forgotAdminPassword(email: string): Promise<void> {
  await apiRequest<void>("/api/auth/admin/forgot-password", {
    method: "POST",
    auth: false,
    body: {
      email,
    },
  });
}

/**
 * Verify the password-reset code.
 */
export async function verifyAdminResetCode(
  email: string,
  code: string
): Promise<void> {
  await apiRequest<void>("/api/auth/admin/verify-reset", {
    method: "POST",
    auth: false,
    body: {
      email,
      code,
    },
  });
}

/**
 * Reset password after the reset code has been verified.
 */
export async function resetAdminPassword(
  email: string,
  newPassword: string
): Promise<void> {
  await apiRequest<void>("/api/auth/admin/reset-password", {
    method: "POST",
    auth: false,
    body: {
      email,
      new_password: newPassword,
    },
  });
}

/** PATCH /api/auth/me */
export async function updateAdminProfile(input: {
  name?: string;
  email?: string;
}): Promise<AdminUser> {
  const data = await apiRequest<UserOut>("/api/auth/me", {
    method: "PATCH",
    body: input,
  });

  return toAdminUser(data);
}

export async function adminLogout(): Promise<void> {
  try {
    await apiRequest<void>("/api/auth/logout", {
      method: "POST",
    });
  } catch {
    // Logout remains a client-side action.
  }
}