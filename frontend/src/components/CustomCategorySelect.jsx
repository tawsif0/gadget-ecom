import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchCustomCategories, deleteCustomCategory } from '../store/customCategorySlice';
import { FiPlus, FiEdit, FiTrash2 } from 'react-icons/fi';
import CustomCategoryModal from './CustomCategoryModal';

/**
 * CustomCategorySelect - Replaces the generic SearchableSelect for categories.
 * Renders a dropdown of custom categories with an Add button.
 * Supports inline edit/delete actions via a modal.
 */
const CustomCategorySelect = ({ value, onChange }) => {
  const dispatch = useDispatch();
  const { list: categories, loading, error } = useSelector((state) => state.customCategories);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editCategory, setEditCategory] = useState(null);

  useEffect(() => {
    dispatch(fetchCustomCategories());
  }, [dispatch]);

  const handleSelect = (e) => {
    onChange(e.target.value);
  };

  const openAddModal = () => {
    setEditCategory(null);
    setIsModalOpen(true);
  };

  const openEditModal = (cat) => {
    setEditCategory(cat);
    setIsModalOpen(true);
  };

  const handleDelete = async (catId) => {
    if (window.confirm('Delete this category? This action cannot be undone.')) {
      await dispatch(deleteCustomCategory(catId));
    }
  };

  return (
    <div className="flex flex-col space-y-2">
      <label className="flex items-center text-sm font-medium text-gray-700 mb-1">
        <FiEdit className="mr-2" /> Category
      </label>
      <div className="flex items-center space-x-2">
        <select
          className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-1 focus:border-gray-500"
          value={value}
          onChange={handleSelect}
          disabled={loading}
        >
          <option value="">Select category</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={openAddModal}
          className="p-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
          title="Add new category"
        >
          <FiPlus size={18} />
        </button>
      </div>
      {/* Inline edit/delete list for quick actions */}
      {categories.length > 0 && (
        <ul className="grid grid-cols-1 gap-1 mt-2">
          {categories.map((cat) => (
            <li key={cat.id} className="flex items-center justify-between text-sm bg-gray-50 p-1 rounded">
              <span>{cat.name}</span>
              <span className="flex space-x-1">
                <button
                  type="button"
                  onClick={() => openEditModal(cat)}
                  className="text-blue-600 hover:text-blue-800"
                  title="Edit"
                >
                  <FiEdit />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(cat.id)}
                  className="text-red-600 hover:text-red-800"
                  title="Delete"
                >
                  <FiTrash2 />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {isModalOpen && (
        <CustomCategoryModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          existingCategory={editCategory}
        />
      )}
    </div>
  );
};

export default CustomCategorySelect;
