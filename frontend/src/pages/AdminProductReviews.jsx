import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { toast } from "react-hot-toast";
import {
  FiCheckCircle,
  FiClock,
  FiRefreshCw,
  FiSearch,
  FiStar,
  FiXCircle,
} from "react-icons/fi";
import SearchableSelect from "../components/SearchableSelect";
import { useAuth } from "../hooks/useAuth";

const baseUrl = import.meta.env.VITE_API_URL;

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const renderStars = (rating = 0) =>
  [...Array(5)].map((_, index) => (
    <FiStar
      key={`product-review-star-${index}`}
      className={`h-3.5 w-3.5 ${
        index < Math.round(Number(rating || 0))
          ? "fill-yellow-500 text-yellow-500"
          : "text-gray-300"
      }`}
    />
  ));

const getStatusBadgeClass = (status) => {
  switch (
    String(status || "")
      .trim()
      .toLowerCase()
  ) {
    case "approved":
      return "bg-green-100 text-green-700";
    case "rejected":
      return "bg-red-100 text-red-700";
    default:
      return "bg-amber-100 text-amber-700";
  }
};

const toLabel = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (!normalized) return "Pending";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const searchShellClass =
  "flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition focus-within:border-slate-300 focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgba(15,23,42,0.04)]";

const searchInputClass =
  "min-w-0 flex-1 appearance-none border-0 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:outline-none focus:ring-0";

const searchInputStyle = {
  appearance: "none",
  WebkitAppearance: "none",
  MozAppearance: "none",
  background: "transparent",
  border: 0,
  borderRadius: 0,
  boxShadow: "none",
  outline: "none",
  padding: 0,
  margin: 0,
  minHeight: 0,
  minWidth: 0,
  width: "100%",
};

const AdminProductReviews = () => {
  const { user } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [statusFilter, setStatusFilter] = useState("pending");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
  });

  const fetchReviews = useCallback(
    async (nextPage = 1) => {
      try {
        setLoading(true);
        const response = await axios.get(`${baseUrl}/products/admin/reviews`, {
          headers: getAuthHeaders(),
          params: {
            page: nextPage,
            limit: 20,
            status: statusFilter,
            search: search.trim() || undefined,
          },
        });

        setReviews(response.data?.reviews || []);
        setPagination(
          response.data?.pagination || {
            currentPage: 1,
            totalPages: 1,
            totalItems: 0,
          },
        );
        setPage(nextPage);
      } catch (error) {
        toast.error(
          error.response?.data?.message || "Failed to load product reviews",
        );
        setReviews([]);
      } finally {
        setLoading(false);
      }
    },
    [search, statusFilter],
  );

  useEffect(() => {
    if (user?.userType === "admin") {
      fetchReviews(1);
    }
  }, [user, fetchReviews]);

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    fetchReviews(1);
  };

  const updateStatus = async (reviewId, moderationStatus) => {
    try {
      setSavingId(reviewId);
      await axios.patch(
        `${baseUrl}/products/admin/reviews/${reviewId}/status`,
        { moderationStatus },
        { headers: getAuthHeaders() },
      );
      toast.success("Product review status updated");
      fetchReviews(page);
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Failed to update product review",
      );
    } finally {
      setSavingId("");
    }
  };

  if (user?.userType !== "admin") {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
        <h2 className="mb-2 text-xl font-semibold text-black">
          Admin Access Required
        </h2>
        <p className="text-gray-600">
          Only admins can moderate product reviews.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-linear-to-r from-slate-900 to-black p-6 text-white md:p-8">
        <h1 className="text-2xl font-bold md:text-3xl">
          Product Review Moderation
        </h1>
        <p className="mt-2 text-slate-200">
          Approve pending product reviews before they appear on the storefront.
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 md:p-6">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
          <form onSubmit={handleSearchSubmit} className="flex-1">
            <div className={searchShellClass}>
              <FiSearch className="h-4 w-4 shrink-0 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search product title, review text, reviewer or email..."
                className={searchInputClass}
                style={searchInputStyle}
              />
            </div>
          </form>

          <SearchableSelect
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: "all", label: "All" },
              { value: "pending", label: "Pending" },
              { value: "approved", label: "Approved" },
              { value: "rejected", label: "Rejected" },
            ]}
            placeholder="All"
            searchable={false}
            className="min-w-0"
            buttonClassName="rounded-lg border border-gray-200 px-3 py-2 text-sm"
            menuClassName="rounded-xl"
          />

          <button
            onClick={() => fetchReviews(page)}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm"
          >
            <FiRefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>

        {loading ? (
          <p className="text-gray-600">Loading product reviews...</p>
        ) : reviews.length === 0 ? (
          <p className="text-gray-600">No product reviews found.</p>
        ) : (
          <div className="space-y-3">
            {reviews.map((review) => (
              <div
                key={review._id}
                className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 p-4 lg:grid-cols-12"
              >
                <div className="lg:col-span-8">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-black">
                      {review.product?.title || "Product"}
                    </p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${getStatusBadgeClass(
                        review.moderationStatus,
                      )}`}
                    >
                      {toLabel(review.moderationStatus)}
                    </span>
                    {review.verifiedPurchase ? (
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                        Verified Purchase
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-1 flex items-center gap-1">
                    {renderStars(review.rating || 0)}
                  </div>

                  <p className="mt-2 text-sm text-gray-700">
                    <span className="font-medium">
                      {review.user?.name || review.reviewerName || "Customer"}:
                    </span>{" "}
                    {review.comment}
                  </p>

                  {review.title ? (
                    <p className="mt-1 text-sm text-gray-600">
                      <span className="font-medium">Title:</span> {review.title}
                    </p>
                  ) : null}

                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                    <span>
                      Email:{" "}
                      {review.user?.email || review.reviewerEmail || "N/A"}
                    </span>
                    <span>
                      Created: {new Date(review.createdAt).toLocaleString()}
                    </span>
                    {review.reviewedAt ? (
                      <span>
                        Reviewed: {new Date(review.reviewedAt).toLocaleString()}
                      </span>
                    ) : (
                      <span>Awaiting admin review</span>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-2 lg:col-span-4 lg:justify-end">
                  <button
                    onClick={() => updateStatus(review._id, "approved")}
                    disabled={savingId === review._id}
                    className="inline-flex items-center gap-1 rounded-lg border border-green-200 px-3 py-2 text-xs text-green-700 disabled:opacity-60"
                  >
                    <FiCheckCircle className="h-4 w-4" />
                    Approve
                  </button>
                  <button
                    onClick={() => updateStatus(review._id, "rejected")}
                    disabled={savingId === review._id}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-xs text-red-700 disabled:opacity-60"
                  >
                    <FiXCircle className="h-4 w-4" />
                    Reject
                  </button>
                  <button
                    onClick={() => updateStatus(review._id, "pending")}
                    disabled={savingId === review._id}
                    className="inline-flex items-center gap-1 rounded-lg border border-amber-200 px-3 py-2 text-xs text-amber-700 disabled:opacity-60"
                  >
                    <FiClock className="h-4 w-4" />
                    Pending
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
          <span>Total: {pagination.totalItems || 0}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchReviews(Math.max(1, page - 1))}
              disabled={page <= 1 || loading}
              className="rounded-lg border border-gray-200 px-3 py-1.5 disabled:opacity-40"
            >
              Prev
            </button>
            <span>
              Page {pagination.currentPage || 1} / {pagination.totalPages || 1}
            </span>
            <button
              onClick={() =>
                fetchReviews(Math.min(pagination.totalPages || 1, page + 1))
              }
              disabled={page >= (pagination.totalPages || 1) || loading}
              className="rounded-lg border border-gray-200 px-3 py-1.5 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminProductReviews;
