import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { toast } from "react-hot-toast";
import { FiCheckCircle, FiRefreshCw, FiXCircle } from "react-icons/fi";
import { useAuth } from "../hooks/useAuth";

const baseUrl = import.meta.env.VITE_API_URL;

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const AdminProductApprovals = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [savingStatus, setSavingStatus] = useState("");
  const [rejectionReason, setRejectionReason] = useState({});

  const fetchPendingProducts = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${baseUrl}/products`, {
        headers: getAuthHeaders(),
      });
      const allProducts = response.data?.products || [];
      const pending = allProducts.filter(
        (product) => (product.approvalStatus || "approved") === "pending",
      );
      setProducts(pending);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load products");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.userType === "admin") {
      fetchPendingProducts();
    }
  }, [user?.userType, fetchPendingProducts]);

  const handleStatusChange = async (productId, status) => {
    try {
      setSavingId(productId);
      setSavingStatus(status);
      await axios.patch(
        `${baseUrl}/products/${productId}/approval-status`,
        {
          status,
          rejectionReason: rejectionReason[productId] || "",
        },
        {
          headers: getAuthHeaders(),
        },
      );
      toast.success(`Product ${status}`);
      await fetchPendingProducts();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update product");
    } finally {
      setSavingId("");
      setSavingStatus("");
    }
  };

  if (user?.userType !== "admin") {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
        <h2 className="text-xl font-semibold text-black mb-2">Admin Access Required</h2>
        <p className="text-gray-600">Only admins can review submitted products.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-linear-to-r from-sky-900 to-black rounded-xl p-6 md:p-8 text-white">
        <h1 className="text-2xl md:text-3xl font-bold">Product Approval Queue</h1>
        <p className="text-sky-100 mt-2">Approve or reject submitted products.</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-black">
            Pending Products ({products.length})
          </h2>
          <button
            onClick={fetchPendingProducts}
            className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm"
          >
            <FiRefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {loading ? (
          <p className="text-gray-600">Loading pending products...</p>
        ) : products.length === 0 ? (
          <p className="text-gray-600">No pending product approvals.</p>
        ) : (
          <div className="space-y-3">
            {products.map((product) => (
              <div
                key={product._id}
                className="border border-gray-200 rounded-lg p-4 grid grid-cols-1 lg:grid-cols-12 gap-3"
              >
                <div className="lg:col-span-5">
                  <p className="font-semibold text-black">{product.title}</p>
                  <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                    {product.description}
                  </p>
                </div>

                <div className="lg:col-span-2 text-sm text-gray-700">
                  <p>Price</p>
                  <p className="font-semibold">{Number(product.price || 0).toFixed(2)} Tk</p>
                </div>

                <div className="lg:col-span-3">
                  <input
                    value={rejectionReason[product._id] || ""}
                    onChange={(e) =>
                      setRejectionReason((prev) => ({
                        ...prev,
                        [product._id]: e.target.value,
                      }))
                    }
                    placeholder="Rejection reason (optional)"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    disabled={savingId === product._id}
                  />
                </div>

                <div className="lg:col-span-2 flex items-center gap-2">
                  <button
                    onClick={() => handleStatusChange(product._id, "approved")}
                    disabled={savingId === product._id}
                    className="inline-flex items-center gap-1 px-2.5 py-2 text-xs rounded-lg border border-green-200 text-green-700"
                  >
                    {savingId === product._id && savingStatus === "approved" ? (
                      <FiRefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <FiCheckCircle className="w-4 h-4" />
                    )}
                    {savingId === product._id && savingStatus === "approved"
                      ? "Approving..."
                      : "Approve"}
                  </button>
                  <button
                    onClick={() => handleStatusChange(product._id, "rejected")}
                    disabled={savingId === product._id}
                    className="inline-flex items-center gap-1 px-2.5 py-2 text-xs rounded-lg border border-red-200 text-red-700"
                  >
                    {savingId === product._id && savingStatus === "rejected" ? (
                      <FiRefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <FiXCircle className="w-4 h-4" />
                    )}
                    {savingId === product._id && savingStatus === "rejected"
                      ? "Rejecting..."
                      : "Reject"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminProductApprovals;
