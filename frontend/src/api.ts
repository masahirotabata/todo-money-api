import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "https://todo-money-api.onrender.com";

export function useApi() {
  const token = localStorage.getItem("todoMoneyToken");

  return axios.create({
    baseURL: API_BASE_URL,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}
