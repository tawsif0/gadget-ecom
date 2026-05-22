import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  FiCheckCircle,
  FiClock,
  FiMail,
  FiMessageSquare,
  FiPhone,
  FiRefreshCw,
  FiSearch,
  FiUser,
} from "react-icons/fi";
import { toast } from "react-hot-toast";
import SearchableSelect from "../components/SearchableSelect";

const baseUrl = import.meta.env.VITE_API_URL;

const statusOptions = [
  { value: "all", label: "All Messages" },
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "resolved", label: "Resolved" },
];

const statusTone = {
  new: "bg-rose-100 text-rose-700",
  contacted: "bg-amber-100 text-amber-700",
  resolved: "bg-emerald-100 text-emerald-700",
};

const formatDateTime = (value) =>
  new Date(value).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

const getHeaders = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
});

const AdminContactedUsers = () => {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [savingId, setSavingId] = useState("");

  const fetchSubmissions = async (silent = false) => {
    try {
      if (silent) setRefreshing(true);
      else setLoading(true);

      const response = await axios.get(`${baseUrl}/contact-submissions`, getHeaders());
      if (!response.data?.success) {
        toast.error("Failed to load contacted users");
        return;
      }

      const nextSubmissions = response.data.submissions || [];
      setSubmissions(nextSubmissions);
      setSelectedSubmission((current) => {
        if (!current?._id) return nextSubmissions[0] || null;
        return (
          nextSubmissions.find((item) => item._id === current._id) ||
          nextSubmissions[0] ||
          null
        );
      });
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load contacted users");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSubmissions();
  }, []);

  useEffect(() => {
    if (!selectedSubmission) {
      setNotesDraft("");
      return;
    }

    setNotesDraft(selectedSubmission.adminNotes || "");
  }, [selectedSubmission]);

  const filteredSubmissions = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return submissions.filter((item) => {
      const matchesStatus = statusFilter === "all" || item.status === statusFilter;
      const matchesSearch =
        !search ||
        String(item.name || "").toLowerCase().includes(search) ||
        String(item.email || "").toLowerCase().includes(search) ||
        String(item.phone || "").toLowerCase().includes(search) ||
        String(item.subject || "").toLowerCase().includes(search) ||
        String(item.message || "").toLowerCase().includes(search);

      return matchesStatus && matchesSearch;
    });
  }, [searchTerm, statusFilter, submissions]);

  const summary = useMemo(
    () => ({
      total: submissions.length,
      fresh: submissions.filter((item) => item.status === "new").length,
      contacted: submissions.filter((item) => item.status === "contacted").length,
      resolved: submissions.filter((item) => item.status === "resolved").length,
    }),
    [submissions],
  );

  const updateSubmission = async (submissionId, updates) => {
    try {
      setSavingId(submissionId);
      const response = await axios.patch(
        `${baseUrl}/contact-submissions/${submissionId}`,
        updates,
        getHeaders(),
      );

      if (!response.data?.success) {
        toast.error("Failed to update contact message");
        return;
      }

      const nextSubmission = response.data.submission;
      setSubmissions((current) =>
        current.map((item) => (item._id === nextSubmission._id ? nextSubmission : item)),
      );
      setSelectedSubmission((current) =>
        current?._id === nextSubmission._id ? nextSubmission : current,
      );
      setNotesDraft(nextSubmission.adminNotes || "");
      toast.success("Contact message updated");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update contact message");
    } finally {
      setSavingId("");
    }
  };

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-200/70 bg-white/90 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
        <div className="animate-pulse space-y-4">
          <div className="h-10 w-1/3 rounded-2xl bg-slate-200" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-24 rounded-2xl bg-slate-200" />
            ))}
          </div>
          <div className="h-96 rounded-3xl bg-slate-200" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl border border-white/60 bg-[radial-gradient(900px_circle_at_0%_0%,rgba(14,165,233,0.24),transparent_45%),radial-gradient(800px_circle_at_100%_10%,rgba(15,23,42,0.15),transparent_45%),linear-gradient(135deg,rgba(15,23,42,0.96),rgba(30,41,59,0.92))] p-6 text-white md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-white/70">Inbox</p>
            <h2 className="mt-2 text-3xl font-semibold md:text-4xl">Contacted Users</h2>
            <p className="mt-2 max-w-2xl text-sm text-white/80">
              Review every website contact message, mark follow-up progress, and keep support requests organized in one admin view.
            </p>
          </div>
          <button
            type="button"
            onClick={() => fetchSubmissions(true)}
            className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/20"
          >
            <FiRefreshCw className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {[
          { label: "Total", value: summary.total, icon: FiMessageSquare },
          { label: "New", value: summary.fresh, icon: FiClock },
          { label: "Contacted", value: summary.contacted, icon: FiPhone },
          { label: "Resolved", value: summary.resolved, icon: FiCheckCircle },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-2xl border border-slate-200/70 bg-white/90 p-4 shadow-[0_16px_40px_rgba(15,23,42,0.08)]"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                  {item.label}
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{item.value}</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white">
                <item.icon className="h-5 w-5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl border border-slate-200/70 bg-white/90 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
          <div className="border-b border-slate-200/70 p-5">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_220px]">
              <label className="relative block">
                <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center">
                  <FiSearch className="h-[18px] w-[18px] text-gray-400" />
                </span>
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search by name, email, phone, subject"
                  className="h-[52px] w-full rounded-2xl border border-gray-200 bg-gray-50 pl-11 pr-20 text-sm text-gray-900 placeholder:text-gray-400 focus:border-black focus:bg-white focus:outline-none"
                />
                {searchTerm ? (
                  <button
                    type="button"
                    onClick={() => setSearchTerm("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full px-2 py-1 text-xs font-medium text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"
                    aria-label="Clear search"
                  >
                    Clear
                  </button>
                ) : null}
              </label>
              <SearchableSelect
                value={statusFilter}
                onChange={setStatusFilter}
                options={statusOptions}
                placeholder="Filter status"
                searchable={false}
                className="min-w-0"
                buttonClassName="min-h-[52px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:border-slate-300"
                menuClassName="rounded-2xl"
              />
            </div>
          </div>

          <div className="divide-y divide-slate-200/70">
            {filteredSubmissions.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                No contact messages match the current filters.
              </div>
            ) : (
              filteredSubmissions.map((item) => {
                const selected = selectedSubmission?._id === item._id;

                return (
                  <button
                    key={item._id}
                    type="button"
                    onClick={() => setSelectedSubmission(item)}
                    className={`w-full px-5 py-4 text-left transition ${
                      selected ? "bg-slate-900 text-white" : "bg-white hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold">{item.name}</p>
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                              selected
                                ? "bg-white/15 text-white"
                                : statusTone[item.status] || "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {item.status}
                          </span>
                        </div>
                        <p className={`mt-1 text-xs ${selected ? "text-slate-300" : "text-slate-500"}`}>
                          {item.subject}
                        </p>
                        <p className={`mt-2 line-clamp-2 text-sm ${selected ? "text-slate-200" : "text-slate-600"}`}>
                          {String(item.message || "").replace(/<[^>]*>/g, " ")}
                        </p>
                      </div>
                      <div className={`shrink-0 text-xs ${selected ? "text-slate-300" : "text-slate-500"}`}>
                        {formatDateTime(item.createdAt)}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200/70 bg-white/90 p-5 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
          {selectedSubmission ? (
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
                    Contact Details
                  </p>
                  <h3 className="mt-2 text-2xl font-semibold text-slate-900">
                    {selectedSubmission.name}
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Submitted {formatDateTime(selectedSubmission.createdAt)}
                  </p>
                </div>
                <span
                  className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                    statusTone[selectedSubmission.status] || "bg-slate-100 text-slate-700"
                  }`}
                >
                  {selectedSubmission.status}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-500">
                    <FiMail className="h-4 w-4" />
                    Email
                  </div>
                  <a
                    href={`mailto:${selectedSubmission.email}`}
                    className="mt-2 block break-all text-sm font-medium text-slate-900"
                  >
                    {selectedSubmission.email}
                  </a>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-500">
                    <FiPhone className="h-4 w-4" />
                    Phone
                  </div>
                  <a
                    href={
                      selectedSubmission.phone
                        ? `tel:${selectedSubmission.phone.replace(/\s+/g, "")}`
                        : undefined
                    }
                    className="mt-2 block text-sm font-medium text-slate-900"
                  >
                    {selectedSubmission.phone || "Not provided"}
                  </a>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-500">
                  <FiUser className="h-4 w-4" />
                  Subject
                </div>
                <p className="mt-2 text-sm font-medium text-slate-900">
                  {selectedSubmission.subject}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-500">
                  <FiMessageSquare className="h-4 w-4" />
                  Message
                </div>
                <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                  {String(selectedSubmission.message || "").replace(/<[^>]*>/g, " ")}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {[
                  { label: "Mark New", value: "new" },
                  { label: "Mark Contacted", value: "contacted" },
                  { label: "Mark Resolved", value: "resolved" },
                ].map((action) => {
                  const isActive = selectedSubmission.status === action.value;

                  return (
                    <button
                      key={action.value}
                      type="button"
                      onClick={() =>
                        updateSubmission(selectedSubmission._id, {
                          status: action.value,
                          adminNotes: notesDraft,
                        })
                      }
                      disabled={savingId === selectedSubmission._id}
                      className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                        isActive
                          ? "border-[var(--brand-theme-color)] bg-[var(--brand-theme-color)] text-[var(--brand-button-text-color)] shadow-[0_18px_32px_var(--brand-theme-shadow)]"
                          : "border-slate-200 bg-white text-slate-700 hover:border-[var(--brand-theme-color)] hover:text-[var(--brand-theme-color)]"
                      }`}
                    >
                      {action.label}
                    </button>
                  );
                })}
              </div>

              <div className="space-y-3">
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Admin Notes
                </label>
                <textarea
                  value={notesDraft}
                  onChange={(event) => setNotesDraft(event.target.value)}
                  rows={5}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-200/70"
                  placeholder="Save follow-up notes, call outcome, or next steps"
                />
                <button
                  type="button"
                  onClick={() =>
                    updateSubmission(selectedSubmission._id, {
                      status: selectedSubmission.status,
                      adminNotes: notesDraft,
                    })
                  }
                  disabled={savingId === selectedSubmission._id}
                  className="inline-flex items-center gap-2 rounded-full bg-[var(--brand-theme-color)] px-5 py-2.5 text-sm font-semibold text-[var(--brand-button-text-color)] shadow-[0_18px_32px_var(--brand-theme-shadow)] transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingId === selectedSubmission._id ? "Saving..." : "Save Notes"}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex min-h-[360px] items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50 text-center text-sm text-slate-500">
              Select a contact message to review the full details.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminContactedUsers;
