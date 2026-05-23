// src/services/customCategoryService.js
import axios from "axios";

const baseUrl = import.meta.env.VITE_API_URL;

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const customCategoryService = {
  getAll: async () => {
    const response = await axios.get(`${baseUrl}/custom-categories`, {
      headers: getAuthHeaders(),
    });
    return response.data;
  },
  create: async (payload) => {
    const response = await axios.post(`${baseUrl}/custom-categories`, payload, {
      headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
    });
    return response.data;
  },
  update: async (id, changes) => {
    const response = await axios.put(`${baseUrl}/custom-categories/${id}`, changes, {
      headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
    });
    return response.data;
  },
  remove: async (id) => {
    const response = await axios.delete(`${baseUrl}/custom-categories/${id}`, {
      headers: getAuthHeaders(),
    });
    return response.data;
  },
};

export default customCategoryService;
