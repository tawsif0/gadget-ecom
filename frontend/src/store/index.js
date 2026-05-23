// src/store/index.js
import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./authSlice";
import cartReducer from "./cartSlice";
import notificationsReducer from "./notificationsSlice";
import publicSettingsReducer from "./publicSettingsSlice";
import recentlyViewedReducer from "./recentlyViewedSlice";
import wishlistReducer from "./wishlistSlice";
import customCategoryReducer from "./customCategorySlice";
import categoryTypeReducer from "./categoryTypeSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    cart: cartReducer,
    notifications: notificationsReducer,
    publicSettings: publicSettingsReducer,
    recentlyViewed: recentlyViewedReducer,
    wishlist: wishlistReducer,
    customCategories: customCategoryReducer,
    categoryTypes: categoryTypeReducer,
  },
});

export default store;

