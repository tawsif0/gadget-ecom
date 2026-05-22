/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "react-hot-toast";
import { motion } from "framer-motion";
import ConfirmModal from "../../components/ConfirmModal";
import RichTextEditor from "../../components/RichTextEditor";
import { stripHtml } from "../../utils/richText";
import { useThemeColors } from "../../hooks/useThemeColors";
import {
  dashboardFieldClass,
  dashboardFormSurfaceClass,
  dashboardLabelClass,
  dashboardSecondaryButtonClass,
} from "../../utils/dashboardFormStyles";
import {
  FiEdit2,
  FiTrash2,
  FiImage,
  FiRefreshCw,
  FiArrowLeft,
  FiType,
  FiFileText,
  FiX,
  FiPlus,
} from "react-icons/fi";

function ModifyBanner() {
  const baseUrl = import.meta.env.VITE_API_URL;
  const { themeColor, buttonTextColor } = useThemeColors();

  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [thumbFile, setThumbFile] = useState(null);
  const [currentImage, setCurrentImage] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form state
  const [form, setForm] = useState({
    title: "",
    description: "",
    buttonLabel: "",
    buttonLink: "",
  });

  const getToken = () => {
    return localStorage.getItem("token");
  };

  const getAuthHeaders = () => {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const getFullImageUrl = (imagePath) => {
    if (!imagePath) return null;

    if (
      imagePath.startsWith("http://") ||
      imagePath.startsWith("https://") ||
      imagePath.startsWith("data:")
    ) {
      return imagePath;
    }

    if (imagePath.startsWith("/")) {
      return baseUrl ? `${baseUrl}${imagePath}` : imagePath;
    }

    if (imagePath && !imagePath.startsWith("/")) {
      return baseUrl
        ? `${baseUrl}/uploads/banners/${imagePath}`
        : `/uploads/banners/${imagePath}`;
    }

    return null;
  };

  const FallbackImage = ({ className, alt }) => (
    <div
      className={`${className} bg-gray-200 flex items-center justify-center rounded-lg`}
    >
      <FiImage className="text-gray-400 text-2xl" />
      <span className="sr-only">{alt || "No image available"}</span>
    </div>
  );

  const BannerImage = ({ src, alt, className }) => {
    const [imgSrc, setImgSrc] = useState(getFullImageUrl(src));
    const [hasError, setHasError] = useState(false);

    useEffect(() => {
      setImgSrc(getFullImageUrl(src));
      setHasError(false);
    }, [src]);

    const handleError = () => {
      setHasError(true);
      if (src && src.startsWith("/uploads/banners/")) {
        const altUrl = `${baseUrl}${src}`;
        if (altUrl !== imgSrc) {
          setImgSrc(altUrl);
          setHasError(false);
        }
      }
    };

    if (hasError || !imgSrc) {
      return <FallbackImage className={className} alt={alt} />;
    }

    return (
      <img
        src={imgSrc}
        alt={alt}
        className={className}
        onError={handleError}
        crossOrigin={
          imgSrc?.startsWith("http://") || imgSrc?.startsWith("https://")
            ? "anonymous"
            : undefined
        }
      />
    );
  };

  const fetchBanners = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${baseUrl}/banners`, {
        headers: getAuthHeaders(),
      });

      let bannersData = [];
      if (response.data.success) {
        bannersData = response.data.banners || [];
      } else if (Array.isArray(response.data)) {
        bannersData = response.data;
      } else if (response.data && Array.isArray(response.data.data)) {
        bannersData = response.data.data;
      }

      setBanners(bannersData);
    } catch (err) {
      toast.error(
        err.response?.data?.message || err.message || "Failed to load banners"
      );

      if (err.response?.status === 401) {
        toast.error("Please login again");
        setTimeout(() => {
          window.location.href = "/login";
        }, 2000);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = getToken();
    if (!token) {
      toast.error("Please login first");
      setTimeout(() => {
        window.location.href = "/login";
      }, 2000);
      return;
    }

    fetchBanners();

    const handleBannerCreated = () => {
      fetchBanners();
    };

    window.addEventListener("bannerCreated", handleBannerCreated);
    return () => {
      window.removeEventListener("bannerCreated", handleBannerCreated);
    };
  }, []);

  const handleDelete = (banner) => {
    setDeleteConfirm(banner);
  };

  const confirmDeleteBanner = async () => {
    if (!deleteConfirm) return;
    setIsDeleting(true);
    const toastId = toast.loading("Deleting banner...");
    try {
      await axios.delete(`${baseUrl}/banners/${deleteConfirm._id}`, {
        headers: getAuthHeaders(),
      });
      toast.success("Banner deleted successfully", { id: toastId });
      fetchBanners();
    } catch (err) {
      toast.error(
        err.response?.data?.message || err.message || "Failed to delete banner",
        { id: toastId }
      );
    } finally {
      setIsDeleting(false);
      setDeleteConfirm(null);
    }
  };

  const handleRefresh = () => {
    setLoading(true);
    fetchBanners();
    toast.success("Banners refreshed!");
  };

  const resetForm = () => {
    setForm({
      title: "",
      description: "",
      buttonLabel: "",
      buttonLink: "",
    });
    setImageFile(null);
    setImagePreview("");
    setThumbFile(null);
    setCurrentImage("");
    setEditingId(null);
  };

  const startCreating = () => {
    resetForm();
    setShowForm(true);
  };

  const startEditing = async (id) => {
    setLoading(true);
    try {
      const response = await axios.get(`${baseUrl}/banners/${id}`, {
        headers: getAuthHeaders(),
      });

      const bannerData =
        response.data.banner || response.data.data || response.data;

      // Set form data
      setForm({
        title: bannerData.title || "",
        description: bannerData.description || "",
        buttonLabel: bannerData.buttonLabel || "",
        buttonLink: bannerData.buttonLink || "",
      });

      if (bannerData.image || bannerData.thumb) {
        const imageUrl =
          getFullImageUrl(bannerData.image) ||
          getFullImageUrl(bannerData.thumb) ||
          bannerData.image ||
          bannerData.thumb;
        setCurrentImage(imageUrl);
      } else {
        setCurrentImage("");
      }

      setImageFile(null);
      setImagePreview("");
      setEditingId(id);
      setShowForm(true);
    } catch (err) {
      toast.error("Failed to load banner data");
    } finally {
      setLoading(false);
    }
  };

  const cancelForm = () => {
    resetForm();
    setShowForm(false);
  };

  const compressImage = (file, options = {}) => {
    const {
      maxWidth = 1600,
      maxHeight = 900,
      quality = 0.85,
      mimeType = "image/jpeg",
    } = options;

    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const canvas = document.createElement("canvas");
        let { width, height } = img;

        const widthRatio = maxWidth / width;
        const heightRatio = maxHeight / height;
        const ratio = Math.min(widthRatio, heightRatio, 1);

        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error("Image compression failed"));
            const compressedFile = new File([blob], file.name, {
              type: blob.type,
            });
            resolve(compressedFile);
          },
          mimeType,
          quality,
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Image load failed"));
      };
      img.src = url;
    });
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const validTypes = [
      "image/jpeg",
      "image/png",
      "image/jpg",
      "image/webp",
      "image/gif",
    ];

    if (!validTypes.includes(file.type)) {
      toast.error("Invalid file type. Only JPG, PNG, WebP, GIF allowed.");
      return;
    }

    Promise.all([
      compressImage(file, {
        maxWidth: 1600,
        maxHeight: 900,
        quality: 0.85,
        mimeType: "image/jpeg",
      }),
      compressImage(file, {
        maxWidth: 800,
        maxHeight: 450,
        quality: 0.7,
        mimeType: "image/jpeg",
      }),
    ])
      .then(([compressed, thumb]) => {
        setImageFile(compressed);
        setThumbFile(thumb);
        const reader = new FileReader();
        reader.onloadend = () => {
          setImagePreview(reader.result);
        };
        reader.readAsDataURL(compressed);
      })
      .catch(() => {
        toast.error("Failed to process image. Please try another.");
      });
  };

  const removeImage = () => {
    if (imagePreview) {
      setImageFile(null);
      setImagePreview("");
      setThumbFile(null);
    } else if (currentImage) {
      setCurrentImage("");
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setIsSubmitting(true);
    const toastId = toast.loading(
      editingId ? "Updating banner..." : "Creating banner..."
    );

    try {
      const token = getToken();
      if (!token) {
        toast.error("Authentication required. Please login again.", {
          id: toastId,
        });
        setIsSubmitting(false);
        return;
      }

      const formData = new FormData();

      formData.append("title", form.title.trim());
      formData.append("description", form.description.trim());
      formData.append("buttonLabel", form.buttonLabel.trim());
      formData.append("buttonLink", form.buttonLink.trim());

      // Append new image if exists
      if (imageFile) {
        formData.append("image", imageFile);
      }
      if (thumbFile) {
        formData.append("thumb", thumbFile);
      }

      if (editingId) {
        await axios.put(`${baseUrl}/banners/${editingId}`, formData, {
          headers: {
            ...getAuthHeaders(),
            "Content-Type": "multipart/form-data",
          },
        });

        toast.success("Banner updated successfully!", { id: toastId });
      } else {
        await axios.post(`${baseUrl}/banners`, formData, {
          headers: {
            ...getAuthHeaders(),
            "Content-Type": "multipart/form-data",
          },
        });

        toast.success("Banner created successfully!", { id: toastId });
      }

      cancelForm();
      fetchBanners();
      window.dispatchEvent(new CustomEvent("bannerCreated"));
    } catch (err) {
      let errorMessage = editingId
        ? "Failed to update banner"
        : "Failed to create banner";

      if (err.response?.status === 401) {
        errorMessage = "Authentication failed. Please login again.";
      } else if (err.response?.status === 413) {
        errorMessage = "Image upload failed (file too large)";
      } else if (err.response?.status === 415) {
        errorMessage = "Unsupported file type";
      } else if (err.response?.data?.message) {
        errorMessage = Array.isArray(err.response.data.message)
          ? err.response.data.message.join(", ")
          : err.response.data.message;
      }

      toast.error(errorMessage, { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading && !showForm) {
    return (
      <div className="flex justify-center items-center min-h-[60vh] w-full">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 border-2 border-gray-200 border-t-2 border-t-black rounded-full animate-spin"></div>
          <p className="mt-4 text-gray-600">Loading banners...</p>
        </div>
      </div>
    );
  }

  if (showForm) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="w-full"
    >
        <div className="w-full">
        <div className="mb-4">
          <button
            onClick={cancelForm}
            className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            <FiArrowLeft className="h-4 w-4" />
            Back to banners
          </button>
        </div>

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8">
              {/* Left Column - Form */}
              <div>
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                  className={dashboardFormSurfaceClass}
                >
                  <h2 className="text-lg md:text-xl font-semibold text-gray-800 mb-4 md:mb-6 flex items-center">
                    <FiType className="mr-2" /> Banner Information
                  </h2>

                  <div className="space-y-4 md:space-y-6">
                    {/* Title */}
                    <div>
                      <label className="block">
                        <span className={dashboardLabelClass}>Title</span>
                      </label>
                      <input
                        type="text"
                        name="title"
                        value={form.title}
                        onChange={handleChange}
                        placeholder="Enter banner title"
                        className={`${dashboardFieldClass} text-sm md:text-base`}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Title will be displayed if provided
                      </p>
                    </div>

                    {/* Description */}
                    <div>
                      <label className="block">
                        <span className={dashboardLabelClass}>Description</span>
                      </label>
                      <RichTextEditor
                        value={form.description}
                        onChange={(value) => setForm((prev) => ({ ...prev, description: value }))}
                        placeholder="Enter banner description"
                        minHeight={180}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Description will be displayed if provided
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <label className="block">
                          <span className={dashboardLabelClass}>Button Label</span>
                        </label>
                        <input
                          type="text"
                          name="buttonLabel"
                          value={form.buttonLabel}
                          onChange={handleChange}
                          placeholder="Shop Now"
                          className={`${dashboardFieldClass} text-sm md:text-base`}
                        />
                        <p className="mt-1 text-xs text-gray-500">
                          Optional. Leave empty if you do not want a CTA label.
                        </p>
                      </div>

                      <div>
                        <label className="block">
                          <span className={dashboardLabelClass}>Button Link</span>
                        </label>
                        <input
                          type="text"
                          name="buttonLink"
                          value={form.buttonLink}
                          onChange={handleChange}
                          placeholder="/shop or https://example.com"
                          className={`${dashboardFieldClass} text-sm md:text-base`}
                        />
                        <p className="mt-1 text-xs text-gray-500">
                          Optional. Use an internal page path or a full link.
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Right Column - Image */}
              <div>
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  className={dashboardFormSurfaceClass}
                >
                  <h2 className="text-lg md:text-xl font-semibold text-gray-800 mb-3 md:mb-4 flex items-center">
                    <FiImage className="mr-2" /> Banner Image
                  </h2>

                  {/* Image Upload/Preview Area */}
                  <div className="mb-3 md:mb-4">
                    <label className="block">
                      <span className={dashboardLabelClass}>
                        {imagePreview
                          ? "New Image Preview"
                          : currentImage
                            ? "Current Image"
                            : "Banner Image"}
                      </span>
                    </label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-3 md:p-6 text-center hover:border-gray-500 transition-colors">
                      {imagePreview ? (
                        <div className="relative">
                          <img
                            src={imagePreview}
                            alt="New banner preview"
                            className="w-full h-48 md:h-64 object-contain rounded-lg mx-auto"
                          />
                          <button
                            type="button"
                            onClick={removeImage}
                            className="absolute top-2 right-2 bg-red-600 text-white p-1 rounded-full hover:bg-red-700"
                          >
                            <FiX size={14} />
                          </button>
                          <div className="text-xs text-gray-500 mt-2 text-center">
                            New Image Preview
                          </div>
                        </div>
                      ) : currentImage ? (
                        <div className="relative">
                          <BannerImage
                            src={currentImage}
                            alt="Current banner"
                            className="w-full h-48 md:h-64 object-contain rounded-lg mx-auto"
                          />
                          <button
                            type="button"
                            onClick={removeImage}
                            className="absolute top-2 right-2 bg-red-600 text-white p-1 rounded-full hover:bg-red-700"
                          >
                            <FiX size={14} />
                          </button>
                          <div className="text-xs text-gray-500 mt-2 text-center">
                            Current Image
                          </div>
                        </div>
                      ) : (
                        <>
                          <FiImage className="mx-auto text-gray-400 text-2xl md:text-3xl mb-2" />
                          <p className="text-gray-600 mb-2 text-sm md:text-base">
                            Click to upload banner image
                          </p>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageChange}
                            className="hidden"
                            id="banner-image-upload"
                          />
                          <label
                            htmlFor="banner-image-upload"
                          className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 md:text-base"
                          >
                            <FiImage /> Upload Image
                          </label>
                          <p className="text-xs text-gray-500 mt-2">
                            JPG, PNG, WebP, GIF (auto-optimized on upload)
                          </p>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Info Box */}
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 md:p-4 mb-4 md:mb-6">
                    <h3 className="text-sm font-medium text-gray-800 mb-1">
                      Note
                    </h3>
                    <p className="text-xs text-gray-700">
                      You can update the banner with just an image, just text,
                      or both. Remove the current image to delete it.
                    </p>
                  </div>

                  {/* Submit & Cancel Buttons */}
                  <div className="space-y-2 md:space-y-3">
                    <button
                      type="button"
                      onClick={cancelForm}
                      className={`${dashboardSecondaryButtonClass} w-full text-sm md:text-base`}
                    >
                      Cancel
                    </button>
                    <motion.button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex w-full items-center justify-center rounded-full px-6 py-3 text-sm font-bold shadow-lg shadow-slate-900/15 transition-colors duration-200 md:text-base disabled:cursor-not-allowed disabled:opacity-60"
                      style={{
                        backgroundColor: themeColor,
                        color: buttonTextColor,
                      }}
                    >
                      {isSubmitting ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          {editingId ? "Updating..." : "Creating..."}
                        </>
                      ) : editingId ? (
                        "Update Banner"
                      ) : (
                        "Create Banner"
                      )}
                    </motion.button>
                  </div>
                </motion.div>
              </div>
            </div>
          </form>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full"
    >
      <div className="w-full">
        <div className="flex items-center justify-end mb-4 gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              className="flex items-center gap-2 px-3 md:px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              title="Refresh"
            >
              <FiRefreshCw className="w-4 h-4" />
              <span className="hidden md:inline">Refresh</span>
            </button>
            <button
              onClick={startCreating}
              className="flex items-center gap-2 px-3 md:px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors"
            >
              <FiPlus className="w-4 h-4" />
              <span className="hidden md:inline">Create Banner</span>
              <span className="md:hidden">Create</span>
            </button>
          </div>
        </div>

        {/* Banners List */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className={`${dashboardFormSurfaceClass} p-4 md:p-6`}
        >
          <div className="py-1 border-b border-gray-100 mb-4 md:mb-6">
            <div className="flex items-center justify-end gap-2">
              <div className="flex items-center space-x-2">
                <span className="inline-flex items-center px-2 md:px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                  {banners.length} banners
                </span>
              </div>
            </div>
          </div>

          {banners.length === 0 ? (
            <div className="py-8 md:py-12 text-center">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <h3 className="mt-2 text-lg font-medium text-gray-900">
                No banners found
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Get started by creating a new banner.
              </p>
              <button
                onClick={startCreating}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors"
              >
                <FiPlus className="w-4 h-4" />
                Create Your First Banner
              </button>
            </div>
          ) : (
            <div className="grid gap-4 md:gap-6">
              {banners.map((banner) => (
                <motion.div
                  key={banner._id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="p-4 md:p-6">
                    <div className="flex flex-col md:flex-row gap-4 md:gap-6">
                      {/* Banner Image */}
                      <div className="shrink-0 self-center">
                        <div className="relative w-32 h-32 md:w-48 md:h-48 rounded-lg overflow-hidden bg-gray-100">
                          {banner.image ? (
                            <BannerImage
                              src={banner.thumb || banner.image}
                              alt={banner.title || "Banner"}
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <FiImage className="text-gray-400 text-2xl md:text-3xl" />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Banner Details */}
                      <div className="flex-1">
                        <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-2">
                          <div className="flex-1">
                            {banner.title && (
                              <h2 className="text-lg md:text-xl font-semibold text-gray-900 mb-2">
                                {banner.title}
                              </h2>
                            )}
                            {banner.description && (
                              <p className="text-gray-600 text-xs md:text-sm mb-3 line-clamp-2">
                                {stripHtml(banner.description)}
                              </p>
                            )}

                            <div className="mb-3">
                              <span className="text-xs text-gray-500">
                                Created:{" "}
                                {banner.createdAt
                                  ? new Date(
                                      banner.createdAt
                                    ).toLocaleDateString()
                                  : "N/A"}
                              </span>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex gap-2 self-end md:self-start">
                            <button
                              onClick={() => startEditing(banner._id)}
                              className="text-gray-600 hover:text-gray-800 p-2 rounded-full hover:bg-gray-50 transition-colors"
                              title="Edit"
                            >
                              <FiEdit2 className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleDelete(banner)}
                              className="text-red-600 hover:text-red-800 p-2 rounded-full hover:bg-red-50 transition-colors"
                              title="Delete"
                            >
                              <FiTrash2 className="w-5 h-5" />
                            </button>
                          </div>
                        </div>

                        {/* Update Date */}
                        {banner.updatedAt && (
                          <div className="mt-3 md:mt-4 pt-3 md:pt-4 border-t border-gray-100">
                            <div className="text-xs md:text-sm text-gray-500">
                              <span className="font-medium">Last Updated:</span>{" "}
                              {new Date(banner.updatedAt).toLocaleDateString()}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
          <ConfirmModal
            isOpen={Boolean(deleteConfirm)}
            title="Delete banner"
            message={
              deleteConfirm?.title
                ? `Delete "${deleteConfirm.title}" banner?`
                : "Delete this banner?"
            }
            confirmLabel="Delete"
            isDanger
            isLoading={isDeleting}
            onCancel={() => setDeleteConfirm(null)}
            onConfirm={confirmDeleteBanner}
          />
        </motion.div>
      </div>
    </motion.div>
  );
}

export default ModifyBanner;
