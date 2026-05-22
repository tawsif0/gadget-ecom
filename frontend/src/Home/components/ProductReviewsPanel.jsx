import React, { useMemo, useState } from "react";
import { FaChevronDown, FaShareAlt, FaStar } from "react-icons/fa";
import { toast } from "react-hot-toast";
import SearchableSelect from "../../components/SearchableSelect";

const reviewFieldClassName =
  "w-full rounded-2xl border border-zinc-200/80 bg-white px-4 py-3.5 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-black focus:ring-2 focus:ring-black/5 sm:px-4 sm:py-4";

const renderStars = (rating = 0, className = "h-4 w-4") =>
  Array.from({ length: 5 }).map((_, index) => (
    <FaStar
      key={`review-star-${index}`}
      className={`${className} ${
        index < Math.round(Number(rating || 0))
          ? "fill-zinc-950 text-zinc-950"
          : "text-zinc-300"
      }`}
    />
  ));

const getReviewerDisplayName = (review = {}) =>
  String(review?.user?.name || review?.reviewerName || "Customer").trim() ||
  "Customer";

const getReviewerInitials = (review = {}) => {
  const displayName = getReviewerDisplayName(review);
  const parts = displayName.split(/\s+/).filter(Boolean);
  if (!parts.length) return "CU";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
};

const ProductReviewsPanel = ({
  isLoggedIn = false,
  myReview = null,
  productTitle = "",
  reviewSummary = {},
  reviews = [],
  reviewsLoading = false,
  reviewForm = {},
  hoverRating = null,
  reviewSubmitting = false,
  reviewDeleting = false,
  user = null,
  onLoginNavigate,
  onFieldChange,
  onHoverRatingChange,
  onRatingChange,
  onSubmitReview,
  onDeleteReview,
  onEditReview,
}) => {
  const [reviewSortOrder, setReviewSortOrder] = useState("recent");

  const sortedReviews = useMemo(() => {
    const nextReviews = [...(Array.isArray(reviews) ? reviews : [])];

    if (reviewSortOrder === "highest") {
      return nextReviews.sort((a, b) => {
        const ratingDiff = Number(b?.rating || 0) - Number(a?.rating || 0);
        if (ratingDiff !== 0) return ratingDiff;
        return (
          new Date(b?.createdAt || 0).getTime() -
          new Date(a?.createdAt || 0).getTime()
        );
      });
    }

    if (reviewSortOrder === "lengthy") {
      return nextReviews.sort((a, b) => {
        const commentDiff =
          String(b?.comment || "").trim().length -
          String(a?.comment || "").trim().length;
        if (commentDiff !== 0) return commentDiff;
        return (
          new Date(b?.createdAt || 0).getTime() -
          new Date(a?.createdAt || 0).getTime()
        );
      });
    }

    return nextReviews.sort(
      (a, b) =>
        new Date(b?.createdAt || 0).getTime() -
        new Date(a?.createdAt || 0).getTime(),
    );
  }, [reviewSortOrder, reviews]);

  const normalizedReviewSummary = useMemo(() => {
    const reviewList = Array.isArray(reviews) ? reviews : [];
    const explicitAverage = Number(reviewSummary?.ratingAverage);
    const explicitCount = Number(reviewSummary?.ratingCount);
    const fallbackCount = reviewList.length;
    const fallbackAverage =
      fallbackCount > 0
        ? reviewList.reduce(
            (sum, review) => sum + Number(review?.rating || 0),
            0,
          ) / fallbackCount
        : 0;

    return {
      ratingAverage:
        Number.isFinite(explicitAverage) && explicitAverage >= 0
          ? explicitAverage
          : fallbackAverage,
      ratingCount:
        Number.isFinite(explicitCount) && explicitCount >= 0
          ? explicitCount
          : fallbackCount,
    };
  }, [reviewSummary, reviews]);

  const handleShareReview = async (review = {}) => {
    const shareUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}${window.location.pathname}#reviews`
        : "";
    const shareTitle = String(
      review?.title || productTitle || "Product review",
    ).trim();

    try {
      if (navigator.share) {
        await navigator.share({
          title: shareTitle,
          text: String(review?.comment || "")
            .trim()
            .slice(0, 180),
          url: shareUrl,
        });
        return;
      }

      if (navigator.clipboard?.writeText && shareUrl) {
        await navigator.clipboard.writeText(shareUrl);
        toast.success("Review link copied");
      }
    } catch {
      // ignore dismissed share events
    }
  };

  return (
    <div className="w-full overflow-hidden pb-4 pt-1 sm:pt-2">
      <header className="mb-8 flex flex-col gap-5 md:mb-12 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-zinc-400">
            Product Narrative
          </p>
          <h2 className="font-headline text-3xl font-extrabold tracking-tight text-zinc-950 sm:text-4xl md:text-5xl">
            Product Reviews
          </h2>
          <p className="max-w-2xl text-sm leading-7 text-zinc-500 sm:text-base md:text-lg">
            Read approved customer feedback and share your own experience with
            this product.
          </p>
        </div>

        <div className="flex w-full items-center justify-center gap-4 rounded-[1.5rem] border border-zinc-200/70 bg-white px-4 py-4 shadow-[0_18px_50px_rgba(15,23,42,0.07)] sm:w-auto sm:gap-5 sm:px-5 sm:py-5">
          <div className="min-w-0 text-center">
            <span className="block text-3xl font-extrabold text-zinc-950 sm:text-4xl">
              {Number(normalizedReviewSummary.ratingAverage || 0).toFixed(1)}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-zinc-500">
              Average Rating
            </span>
          </div>
          <div className="h-10 w-px shrink-0 bg-zinc-200" />
          <div className="min-w-0 text-center">
            <span className="block text-3xl font-extrabold text-zinc-950 sm:text-4xl">
              {Number(normalizedReviewSummary.ratingCount || 0)}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-zinc-500">
              Total Reviews
            </span>
          </div>
        </div>
      </header>

      <section
        id="review-form"
        className="mb-12 rounded-[1.75rem] border border-zinc-200/70 bg-[#f5f6f7] p-4 shadow-[0_22px_60px_rgba(15,23,42,0.06)] sm:mb-16 sm:p-6 md:p-8 lg:p-10"
      >
        <div className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-400">
              Compose Your Perspective
            </p>
            <h3 className="mt-2 text-xl font-bold text-zinc-950 sm:text-2xl md:text-3xl">
              {myReview ? "Update Your Review" : "Write a Review"}
            </h3>
          </div>
        </div>

        {myReview ? <></> : null}

        <form
          onSubmit={onSubmitReview}
          className="grid grid-cols-1 gap-6 sm:gap-8 lg:grid-cols-12 lg:gap-12"
        >
          <div className="space-y-6 lg:col-span-4">
            <div>
              <label className="mb-4 block text-[11px] font-bold uppercase tracking-[0.24em] text-zinc-500">
                Quality Score
              </label>
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5].map((star) => {
                  const currentRating = Number(
                    hoverRating ?? reviewForm.rating ?? 0,
                  );
                  const active = currentRating >= star;
                  return (
                    <button
                      key={star}
                      type="button"
                      onMouseEnter={() => onHoverRatingChange?.(star)}
                      onMouseLeave={() => onHoverRatingChange?.(null)}
                      onClick={() => onRatingChange?.(star)}
                      className={`rounded-full transition ${
                        active ? "text-[--brand-theme-color]" : "text-zinc-300"
                      }`}
                      style={{
                        color: active ? "var(--brand-theme-color)" : "#d4d4d8",
                      }}
                      aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
                    >
                      <FaStar
                        className={`h-8 w-8 sm:h-9 sm:w-9 ${
                          active ? "fill-current" : "text-zinc-300"
                        }`}
                        style={{
                          color: active
                            ? "var(--brand-theme-color)"
                            : "#d4d4d8",
                        }}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="space-y-5 lg:col-span-8">
            {!isLoggedIn ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="block text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-500">
                    Your Name
                  </label>
                  <input
                    type="text"
                    value={reviewForm.reviewerName || ""}
                    onChange={(event) =>
                      onFieldChange?.("reviewerName", event.target.value)
                    }
                    className={reviewFieldClassName}
                    placeholder="Write your full name"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-500">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={reviewForm.reviewerEmail || ""}
                    onChange={(event) =>
                      onFieldChange?.("reviewerEmail", event.target.value)
                    }
                    className={reviewFieldClassName}
                    placeholder="you@example.com"
                  />
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              <label className="block text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-500">
                Review Title
              </label>
              <input
                type="text"
                value={reviewForm.title || ""}
                onChange={(event) =>
                  onFieldChange?.("title", event.target.value)
                }
                className={reviewFieldClassName}
                placeholder="The focal point of your experience..."
              />
            </div>

            <div className="space-y-2">
              <label className="block text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-500">
                Detailed Narrative
              </label>
              <textarea
                rows={5}
                value={reviewForm.comment || ""}
                onChange={(event) =>
                  onFieldChange?.("comment", event.target.value)
                }
                className={`${reviewFieldClassName} resize-none`}
                placeholder="Describe the performance, comfort, finish, and the overall feel of the product..."
              />
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
              {myReview ? (
                <button
                  type="button"
                  onClick={onDeleteReview}
                  disabled={reviewDeleting}
                  className="rounded-xl border border-rose-200 bg-white px-5 py-3 text-sm font-bold uppercase tracking-[0.2em] text-rose-600 transition hover:border-rose-400 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {reviewDeleting ? "Deleting..." : "Delete Review"}
                </button>
              ) : null}
              <button
                type="submit"
                disabled={reviewSubmitting}
                className="app-btn-primary rounded-xl px-8 py-3.5 text-sm font-bold uppercase tracking-[0.22em] shadow-lg transition disabled:cursor-not-allowed disabled:opacity-60"
                style={{
                  boxShadow: "var(--brand-theme-shadow)",
                }}
              >
                {reviewSubmitting
                  ? myReview
                    ? "Updating..."
                    : "Submitting..."
                  : myReview
                    ? "Update Review"
                    : "Publish Review"}
              </button>
            </div>
          </div>
        </form>
      </section>

      <div className="mb-6 flex flex-col gap-4 sm:mb-8 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-xl font-bold text-zinc-950 sm:text-2xl">
            Review Feed
          </h3>
          <p className="mt-2 text-sm text-zinc-500">
            {reviewsLoading
              ? "Loading approved reviews..."
              : `${sortedReviews.length} approved review${sortedReviews.length === 1 ? "" : "s"} are currently visible.`}
          </p>
        </div>
        <div className="relative inline-flex w-full items-center md:w-auto">
          <SearchableSelect
            value={reviewSortOrder}
            onChange={setReviewSortOrder}
            options={[
              { value: "recent", label: "Most Recent" },
              { value: "highest", label: "Highest Rated" },
              { value: "lengthy", label: "Lengthy Descriptions" },
            ]}
            placeholder="Sort reviews"
            searchable={false}
            className="min-w-[220px]"
            buttonClassName="w-full cursor-pointer appearance-none rounded-2xl border border-zinc-200 bg-white px-5 py-3 pr-12 text-sm font-semibold text-zinc-700 shadow-sm outline-none transition hover:border-zinc-400 focus:border-black md:min-w-[220px]"
            menuClassName="rounded-2xl"
          />
        </div>
      </div>

      <div className="space-y-8">
        {reviewsLoading ? (
          <div className="rounded-[2rem] border border-zinc-200/70 bg-white p-8 text-sm text-zinc-500 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
            Loading reviews...
          </div>
        ) : sortedReviews.length === 0 ? (
          <div className="rounded-[2rem] border border-dashed border-zinc-300 bg-white px-8 py-10 text-center text-sm text-zinc-500">
            No approved reviews yet. Be the first to submit one for admin
            approval.
          </div>
        ) : (
          sortedReviews.map((review) => {
            const belongsToCurrentUser =
              user &&
              String(review.user?._id || review.user || review.userId || "") ===
                String(user._id || user.id || "");

            return (
              <article
                key={review._id}
                className="rounded-[1.75rem] border border-zinc-200/70 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)] transition duration-500 hover:-translate-y-1 sm:p-6 md:p-8"
              >
                <div className="flex flex-col gap-5 md:flex-row md:items-start md:gap-6">
                  <div className="flex shrink-0 items-center gap-4 md:flex-col md:items-center md:gap-3">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-zinc-200 bg-zinc-100 text-sm font-bold text-zinc-700 sm:h-16 sm:w-16 sm:text-base">
                      {getReviewerInitials(review)}
                    </div>
                    {review.verifiedPurchase ? (
                      <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-400">
                        Verified
                      </span>
                    ) : null}
                  </div>

                  <div className="flex-1 space-y-5">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div>
                        <h4 className="text-lg font-extrabold text-zinc-950 sm:text-xl">
                          {review.title || "Customer Perspective"}
                        </h4>
                        <p className="mt-1 text-sm font-semibold text-zinc-600">
                          {getReviewerDisplayName(review)}
                          <span className="mx-2 text-zinc-300">&middot;</span>
                          <span className="font-normal text-zinc-400">
                            {new Date(review.createdAt).toLocaleDateString()}
                          </span>
                        </p>
                      </div>

                      <div className="flex items-center gap-1">
                        {renderStars(review.rating || 0)}
                      </div>
                    </div>

                    <p className="text-sm leading-7 text-zinc-600 sm:text-base sm:leading-8">
                      {review.comment}
                    </p>

                    <div className="flex flex-wrap items-center gap-3 pt-2 sm:gap-4">
                      {review.verifiedPurchase ? (
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700">
                          Verified Purchase
                        </span>
                      ) : null}

                      {belongsToCurrentUser ? (
                        <>
                          <button
                            type="button"
                            onClick={() => onEditReview?.(review)}
                            className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500 transition hover:text-black"
                          >
                            Edit Review
                          </button>
                          <button
                            type="button"
                            onClick={onDeleteReview}
                            className="text-[11px] font-bold uppercase tracking-[0.18em] text-rose-600 transition hover:text-rose-700"
                          >
                            Delete
                          </button>
                        </>
                      ) : null}

                      <button
                        type="button"
                        onClick={() => handleShareReview(review)}
                        className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-700 shadow-sm transition hover:-translate-y-0.5 hover:border-black hover:bg-black hover:text-white"
                      >
                        <FaShareAlt className="h-3.5 w-3.5" />
                        Share Review
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ProductReviewsPanel;
