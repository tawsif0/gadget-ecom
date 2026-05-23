import axios from "axios";

const baseUrl = import.meta.env.VITE_API_URL;

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const categoryTypeService = {
  getAll: async () => {
    const response = await axios.get(`${baseUrl}/category-types`, {
      headers: getAuthHeaders(),
    });
    return response.data;
  },
  create: async (payload) => {
    const response = await axios.post(`${baseUrl}/category-types`, payload, {
      headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
    });
    return response.data;
  },
  update: async (id, changes) => {
    const response = await axios.put(`${baseUrl}/category-types/${id}`, changes, {
      headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
    });
    return response.data;
  },
  remove: async (id) => {
    const response = await axios.delete(`${baseUrl}/category-types/${id}`, {
      headers: getAuthHeaders(),
    });
    return response.data;
  },
};

export default categoryTypeService;

