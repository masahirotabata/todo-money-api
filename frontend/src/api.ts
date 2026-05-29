import axios, { AxiosError } from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "https://todo-money-api.onrender.com";

const TOKEN_KEY = "todoMoneyToken";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function toUserFriendlyError(error: unknown): Error {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;

    if (status === 401 || status === 403) {
      clearToken();
      return new Error("ログインの有効期限が切れました。再度ログインしてください。");
    }

    if (status && status >= 500) {
      return new Error("通信に失敗しました。時間をおいて再度お試しください。");
    }

    if (status === 404) {
      return new Error("データが見つかりませんでした。");
    }

    const data = error.response?.data as any;
    const message =
      typeof data === "string"
        ? data
        : data?.message || data?.error || error.message;

    return new Error(message || "通信に失敗しました。");
  }

  return new Error("予期しないエラーが発生しました。");
}

const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = getToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => Promise.reject(toUserFriendlyError(error))
);

export function useApi() {
  return api;
}

export async function guestLogin(deviceId: string) {
  const res = await api.post("/api/auth/guest", { deviceId });
  return res.data;
}

/* =========================
 * Inbox
 * ========================= */

export type InboxStatus = "INBOX" | "PROCESSED";

export interface InboxItem {
  id: number;
  userId: number;
  title: string;
  memo?: string;
  targetDate?: string;
  status: InboxStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateInboxRequest {
  userId: number;
  title: string;
  memo?: string;
  targetDate?: string;
}

export interface UpdateInboxRequest {
  title?: string;
  memo?: string;
  targetDate?: string;
}

export async function getInboxItems(userId: number): Promise<InboxItem[]> {
  const res = await api.get("/api/inbox", {
    params: { userId },
  });

  return res.data;
}

export async function createInboxItem(
  request: CreateInboxRequest
): Promise<InboxItem> {
  const res = await api.post("/api/inbox", request);
  return res.data;
}

export async function updateInboxItem(
  id: number,
  request: UpdateInboxRequest
): Promise<InboxItem> {
  const res = await api.put(`/api/inbox/${id}`, request);
  return res.data;
}

export async function markInboxProcessed(id: number): Promise<InboxItem> {
  const res = await api.put(`/api/inbox/${id}/processed`);
  return res.data;
}

export async function deleteInboxItem(id: number): Promise<void> {
  await api.delete(`/api/inbox/${id}`);
}