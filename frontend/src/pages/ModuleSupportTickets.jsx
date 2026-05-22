import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "react-hot-toast";
import { FiRefreshCw } from "react-icons/fi";
import SearchableSelect from "../components/SearchableSelect";
import { useAuth } from "../hooks/useAuth";

const baseUrl = import.meta.env.VITE_API_URL;

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const statusOptions = ["open", "in_progress", "resolved", "closed"];

const statusLabelMap = {
  open: "Open",
  in_progress: "In Progress",
  resolved: "Resolved",
  closed: "Closed",
};

const statusBadgeClassMap = {
  open: "bg-blue-50 text-blue-700 border-blue-200",
  in_progress: "bg-amber-50 text-amber-700 border-amber-200",
  resolved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  closed: "bg-gray-100 text-gray-700 border-gray-200",
};

const priorityBadgeClassMap = {
  low: "bg-gray-100 text-gray-700 border-gray-200",
  medium: "bg-sky-50 text-sky-700 border-sky-200",
  high: "bg-orange-50 text-orange-700 border-orange-200",
  urgent: "bg-red-50 text-red-700 border-red-200",
};

const getStatusLabel = (status) =>
  statusLabelMap[String(status || "").toLowerCase()] ||
  String(status || "open");

const initialCreateForm = {
  subject: "",
  category: "general",
  priority: "medium",
  message: "",
};

const ModuleSupportTickets = () => {
  const { user } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [createForm, setCreateForm] = useState(initialCreateForm);
  const [replyMessage, setReplyMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [replying, setReplying] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [updatingStatusValue, setUpdatingStatusValue] = useState("");
  const [openingTicketId, setOpeningTicketId] = useState("");

  const isAdmin = user?.userType === "admin";
  const canCreateTicket = user?.userType === "user";

  const sortedMessages = useMemo(() => {
    if (!selectedTicket?.messages) return [];
    return [...selectedTicket.messages].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  }, [selectedTicket]);

  const filteredTickets = useMemo(() => {
    const normalizedSearch = String(searchText || "")
      .trim()
      .toLowerCase();
    return tickets.filter((ticket) => {
      const matchesStatus =
        statusFilter === "all"
          ? true
          : String(ticket.status || "") === statusFilter;

      const matchesSearch =
        !normalizedSearch ||
        String(ticket.subject || "")
          .toLowerCase()
          .includes(normalizedSearch) ||
        String(ticket.ticketNo || "")
          .toLowerCase()
          .includes(normalizedSearch);

      return matchesStatus && matchesSearch;
    });
  }, [tickets, statusFilter, searchText]);

  const fetchTicketDetails = useCallback(async (ticketId) => {
    const normalizedId = String(ticketId || "");
    if (!normalizedId) return;

    try {
      setOpeningTicketId(normalizedId);
      const response = await axios.get(
        `${baseUrl}/support-tickets/${ticketId}`,
        {
          headers: getAuthHeaders(),
        },
      );
      setSelectedTicket(response.data?.ticket || null);
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Failed to load ticket details",
      );
    } finally {
      setOpeningTicketId((prev) => (prev === normalizedId ? "" : prev));
    }
  }, []);

  const fetchTickets = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${baseUrl}/support-tickets`, {
        headers: getAuthHeaders(),
      });
      const list = response.data?.tickets || [];
      setTickets(list);

      if (list.length === 0) {
        setSelectedTicket(null);
        return;
      }

      const selectedId = selectedTicket?._id;
      const hasSelected = selectedId
        ? list.some((ticket) => String(ticket._id) === String(selectedId))
        : false;

      if (!hasSelected) {
        await fetchTicketDetails(list[0]._id);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load tickets");
    } finally {
      setLoading(false);
    }
  }, [fetchTicketDetails, selectedTicket?._id]);

  useEffect(() => {
    if (!user) return;
    fetchTickets();
  }, [user, fetchTickets]);

  const handleCreateInput = (event) => {
    const { name, value } = event.target;
    setCreateForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const createTicket = async (event) => {
    event.preventDefault();

    if (!canCreateTicket) {
      toast.error("Only customer accounts can create tickets");
      return;
    }

    if (!createForm.subject.trim() || !createForm.message.trim()) {
      toast.error("Subject and message are required");
      return;
    }

    try {
      setCreating(true);
      const response = await axios.post(
        `${baseUrl}/support-tickets`,
        {
          subject: createForm.subject.trim(),
          category: createForm.category,
          priority: createForm.priority,
          message: createForm.message.trim(),
        },
        { headers: getAuthHeaders() },
      );

      toast.success("Ticket created");
      setCreateForm(initialCreateForm);
      const createdTicket = response.data?.ticket;
      await fetchTickets();
      if (createdTicket?._id) {
        await fetchTicketDetails(createdTicket._id);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to create ticket");
    } finally {
      setCreating(false);
    }
  };

  const sendReply = async () => {
    if (!selectedTicket?._id) return;
    if (!replyMessage.trim()) {
      toast.error("Reply message is required");
      return;
    }

    try {
      setReplying(true);
      await axios.post(
        `${baseUrl}/support-tickets/${selectedTicket._id}/reply`,
        { message: replyMessage.trim() },
        { headers: getAuthHeaders() },
      );
      toast.success("Reply sent");
      setReplyMessage("");
      await Promise.all([
        fetchTicketDetails(selectedTicket._id),
        fetchTickets(),
      ]);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to send reply");
    } finally {
      setReplying(false);
    }
  };

  const updateStatus = async (status) => {
    if (!selectedTicket?._id) return;
    if (String(selectedTicket.status || "") === String(status || "")) return;

    try {
      setUpdatingStatus(true);
      setUpdatingStatusValue(String(status || ""));
      await axios.patch(
        `${baseUrl}/support-tickets/${selectedTicket._id}/status`,
        { status },
        { headers: getAuthHeaders() },
      );
      toast.success("Ticket status updated");
      await Promise.all([
        fetchTicketDetails(selectedTicket._id),
        fetchTickets(),
      ]);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update status");
    } finally {
      setUpdatingStatus(false);
      setUpdatingStatusValue("");
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-linear-to-r from-zinc-900 to-black rounded-xl p-6 md:p-8 text-white">
        <h1 className="text-2xl font-bold">Support Ticket System</h1>
        <p className="text-zinc-200 mt-1">
          {canCreateTicket
            ? "Create and track customer support conversations."
            : "Review incoming tickets, reply, and manage status."}
        </p>
      </div>

      {canCreateTicket ? (
        <form
          onSubmit={createTicket}
          className="bg-white border border-gray-200 rounded-xl p-5 md:p-6"
        >
          <h2 className="text-lg font-semibold text-black mb-4">
            Create Ticket
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <input
              name="subject"
              value={createForm.subject}
              onChange={handleCreateInput}
              placeholder="Subject"
              className="px-3 py-2.5 border border-gray-200 rounded-lg"
            />
            <SearchableSelect
              value={createForm.category}
              onChange={(value) =>
                handleCreateInput({ target: { name: "category", value } })
              }
              options={[
                { value: "general", label: "General" },
                { value: "order", label: "Order" },
                { value: "payment", label: "Payment" },
                { value: "technical", label: "Technical" },
                { value: "account", label: "Account" },
              ]}
              placeholder="Category"
              searchable={false}
              className="min-w-0"
              buttonClassName="px-3 py-2.5 border border-gray-200 rounded-lg"
            />
            <SearchableSelect
              value={createForm.priority}
              onChange={(value) =>
                handleCreateInput({ target: { name: "priority", value } })
              }
              options={[
                { value: "low", label: "Low" },
                { value: "medium", label: "Medium" },
                { value: "high", label: "High" },
                { value: "urgent", label: "Urgent" },
              ]}
              placeholder="Priority"
              searchable={false}
              className="min-w-0"
              buttonClassName="px-3 py-2.5 border border-gray-200 rounded-lg"
            />
            <button
              type="submit"
              disabled={creating}
              className="h-[42px] px-5 py-2.5 bg-black text-white rounded-lg font-medium disabled:opacity-60"
            >
              {creating ? "Creating..." : "Create Ticket"}
            </button>
          </div>
          <textarea
            name="message"
            value={createForm.message}
            onChange={handleCreateInput}
            rows={3}
            placeholder="Message"
            className="mt-4 w-full px-3 py-2.5 border border-gray-200 rounded-lg"
          />
        </form>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl p-5 md:p-6">
          <h2 className="text-lg font-semibold text-black">
            Ticket Creation Disabled
          </h2>
          <p className="text-sm text-gray-600 mt-2">
            Admin can manage existing tickets and send replies. Ticket creation
            is available only for customer accounts.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <div className="xl:col-span-4 bg-white border border-gray-200 rounded-xl p-5 md:p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-black">
              Tickets ({filteredTickets.length}/{tickets.length})
            </h3>
            <button
              onClick={fetchTickets}
              className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm"
            >
              <FiRefreshCw
                className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
          </div>

          <div className="space-y-2 mb-3">
            <input
              type="text"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search subject or ticket no"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
            />
            <SearchableSelect
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: "all", label: "All Statuses" },
                ...statusOptions.map((status) => ({
                  value: status,
                  label: status,
                })),
              ]}
              placeholder="All Statuses"
              searchable={false}
              className="min-w-0"
              buttonClassName="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              menuClassName="rounded-xl"
            />
          </div>

          {loading ? (
            <p className="text-gray-600">Loading...</p>
          ) : filteredTickets.length === 0 ? (
            <p className="text-gray-600">No tickets available.</p>
          ) : (
            <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
              {filteredTickets.map((ticket) => (
                <button
                  key={ticket._id}
                  onClick={() => fetchTicketDetails(ticket._id)}
                  className={`w-full text-left border rounded-lg p-3 transition-colors ${
                    selectedTicket?._id === ticket._id
                      ? "border-black bg-gray-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <p className="font-medium text-black text-sm">
                    {ticket.subject}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    {ticket.ticketNo}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full border text-[11px] font-medium ${
                        statusBadgeClassMap[
                          String(ticket.status || "").toLowerCase()
                        ] || "bg-gray-100 text-gray-700 border-gray-200"
                      }`}
                    >
                      {getStatusLabel(ticket.status)}
                    </span>
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full border text-[11px] font-medium ${
                        priorityBadgeClassMap[
                          String(ticket.priority || "").toLowerCase()
                        ] || "bg-gray-100 text-gray-700 border-gray-200"
                      }`}
                    >
                      {String(ticket.priority || "medium")}
                    </span>
                    {openingTicketId === String(ticket._id) && (
                      <span className="text-[11px] text-gray-500">
                        Opening...
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">
                    Updated:{" "}
                    {ticket.updatedAt
                      ? new Date(ticket.updatedAt).toLocaleString()
                      : "N/A"}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="xl:col-span-8 bg-white border border-gray-200 rounded-xl p-5 md:p-6">
          {!selectedTicket ? (
            <p className="text-gray-600">Select a ticket to view details.</p>
          ) : (
            <div className="space-y-4">
              <div className="border-b border-gray-100 pb-3">
                <h3 className="font-semibold text-black break-words">
                  {selectedTicket.subject}
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  {selectedTicket.ticketNo} | Category:{" "}
                  {selectedTicket.category}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Created by: {selectedTicket.createdBy?.name || "User"}
                </p>
                {selectedTicket.assignedAdmin?.name && (
                  <p className="text-xs text-gray-500 mt-1">
                    Assigned Admin: {selectedTicket.assignedAdmin.name}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex px-3 py-1 rounded-full border text-sm font-medium ${
                      statusBadgeClassMap[
                        String(selectedTicket.status || "").toLowerCase()
                      ] || "bg-gray-100 text-gray-700 border-gray-200"
                    }`}
                  >
                    {getStatusLabel(selectedTicket.status)}
                  </span>
                  <span
                    className={`inline-flex px-3 py-1 rounded-full border text-sm font-medium ${
                      priorityBadgeClassMap[
                        String(selectedTicket.priority || "").toLowerCase()
                      ] || "bg-gray-100 text-gray-700 border-gray-200"
                    }`}
                  >
                    Priority: {String(selectedTicket.priority || "medium")}
                  </span>
                  <span className="inline-flex px-3 py-1 rounded-full bg-gray-100 text-sm text-gray-700">
                    {sortedMessages.length} Message
                    {sortedMessages.length === 1 ? "" : "s"}
                  </span>
                </div>
                {isAdmin && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {statusOptions.map((status) => {
                      const isActive =
                        String(selectedTicket.status || "") === String(status);
                      return (
                        <button
                          key={status}
                          type="button"
                          onClick={() => updateStatus(status)}
                          disabled={updatingStatus || isActive}
                          className={`px-3 h-9 rounded-lg border text-sm font-medium transition-colors disabled:opacity-60 ${
                            isActive
                              ? "bg-black text-white border-black"
                              : "bg-white text-gray-700 border-gray-200 hover:border-gray-300"
                          }`}
                        >
                          {updatingStatus && updatingStatusValue === status ? (
                            <>
                              <FiRefreshCw className="w-3.5 h-3.5 animate-spin" />
                              Updating...
                            </>
                          ) : (
                            getStatusLabel(status)
                          )}
                        </button>
                      );
                    })}
                    {updatingStatus && (
                      <span className="text-xs text-gray-500">
                        Updating status...
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2 max-h-[340px] overflow-auto pr-1">
                {sortedMessages.length === 0 ? (
                  <p className="text-sm text-gray-500">No messages yet.</p>
                ) : (
                  sortedMessages.map((message, index) => (
                    <div
                      key={`${message.createdAt}-${index}`}
                      className="border border-gray-200 rounded-lg p-3"
                    >
                      <p className="text-sm text-black break-words">
                        {message.message}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {message.senderRole} - {message.sender?.name || "User"}{" "}
                        - {new Date(message.createdAt).toLocaleString()}
                      </p>
                    </div>
                  ))
                )}
              </div>

              <div>
                <textarea
                  value={replyMessage}
                  onChange={(event) => setReplyMessage(event.target.value)}
                  disabled={replying}
                  rows={3}
                  placeholder="Write a reply"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg disabled:bg-gray-50"
                />
                <button
                  onClick={sendReply}
                  disabled={replying || !replyMessage.trim()}
                  className="mt-2 px-5 py-2.5 bg-black text-white rounded-lg font-medium disabled:opacity-60"
                >
                  {replying ? "Sending..." : "Send Reply"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ModuleSupportTickets;
