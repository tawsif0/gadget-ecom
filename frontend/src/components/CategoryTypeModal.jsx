import React, { useMemo, useState } from "react";
import { FiEdit2, FiPlus, FiTrash2, FiX } from "react-icons/fi";
import { useDispatch, useSelector } from "react-redux";
import toast from "react-hot-toast";
import ConfirmModal from "./ConfirmModal";
import {
  createCategoryType,
  deleteCategoryType,
  updateCategoryType,
} from "../store/categoryTypeSlice";

const normalizeName = (value) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ");

const CategoryTypeModal = ({ isOpen, onClose }) => {
  const dispatch = useDispatch();
  const { list: types, loading } = useSelector((state) => state.categoryTypes);
  const [draftName, setDraftName] = useState("");
  const [editId, setEditId] = useState("");
  const [deleteId, setDeleteId] = useState("");

  const visibleTypes = useMemo(
    () =>
      (Array.isArray(types) ? types : [])
        .map((entry) => ({
          id: String(entry?._id || entry?.id || "").trim(),
          name: String(entry?.name || "").trim(),
        }))
        .filter((entry) => entry.id && entry.name),
    [types],
  );

  if (!isOpen) return null;

  const submit = async () => {
    const name = normalizeName(draftName);
    if (!name) {
      toast.error("Type name is required");
      return;
    }

    try {
      if (editId) {
        await dispatch(updateCategoryType({ id: editId, changes: { name } })).unwrap();
        toast.success("Type updated");
      } else {
        await dispatch(createCategoryType({ name })).unwrap();
        toast.success("Type added");
      }
      setDraftName("");
      setEditId("");
    } catch (error) {
      toast.error(String(error || "Failed to save type"));
    }
  };

  const askDelete = (id) => setDeleteId(String(id || "").trim());

  const confirmDelete = async () => {
    const id = String(deleteId || "").trim();
    if (!id) return;
    try {
      await dispatch(deleteCategoryType(id)).unwrap();
      toast.success("Type deleted (reassigned to Latest)");
      setDeleteId("");
      if (editId === id) {
        setEditId("");
        setDraftName("");
      }
    } catch (error) {
      toast.error(String(error || "Failed to delete type"));
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 app-layer-modal bg-black/40 flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        onClick={onClose}
      >
        <div
          className="bg-white rounded-2xl shadow-2xl overflow-hidden w-full max-w-xl border border-gray-200"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div>
              <h3 className="text-lg font-semibold text-black">Manage Types</h3>
              <p className="text-sm text-gray-600">
                Add, rename, or delete category/product types.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 hover:text-gray-800"
              aria-label="Close"
            >
              <FiX className="h-4 w-4" />
            </button>
          </div>

          <div className="p-6">
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                placeholder={editId ? "Rename type..." : "New type name..."}
                className="flex-1 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-black outline-none focus:border-black"
              />
              <button
                type="button"
                onClick={submit}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-black px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:opacity-60"
              >
                {editId ? (
                  <>
                    <FiEdit2 className="h-4 w-4" /> Save
                  </>
                ) : (
                  <>
                    <FiPlus className="h-4 w-4" /> Add
                  </>
                )}
              </button>
              {editId ? (
                <button
                  type="button"
                  onClick={() => {
                    setEditId("");
                    setDraftName("");
                  }}
                  className="inline-flex items-center justify-center rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-semibold text-gray-800 transition hover:bg-gray-200"
                >
                  Cancel
                </button>
              ) : null}
            </div>

            <div className="mt-5 max-h-[320px] overflow-y-auto rounded-2xl border border-gray-100 bg-gray-50 p-3">
              {visibleTypes.length === 0 ? (
                <p className="px-2 py-8 text-center text-sm text-gray-600">
                  No custom types yet.
                </p>
              ) : (
                <ul className="space-y-2">
                  {visibleTypes.map((type) => (
                    <li
                      key={type.id}
                      className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2.5 border border-gray-100"
                    >
                      <span className="min-w-0 truncate text-sm font-medium text-black">
                        {type.name}
                      </span>
                      <span className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditId(type.id);
                            setDraftName(type.name);
                          }}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-blue-600 transition hover:bg-blue-50"
                          title="Edit"
                        >
                          <FiEdit2 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => askDelete(type.id)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-red-600 transition hover:bg-red-50"
                          title="Delete"
                        >
                          <FiTrash2 className="h-4 w-4" />
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 border border-amber-100">
              Deleting a type automatically reassigns any categories and products
              using it back to <span className="font-semibold">Latest</span>.
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={Boolean(deleteId)}
        title="Delete type?"
        message="Any categories/products using this type will be reassigned to Latest."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        isDanger
        isLoading={loading}
        onCancel={() => setDeleteId("")}
        onConfirm={confirmDelete}
      />
    </>
  );
};

export default CategoryTypeModal;

