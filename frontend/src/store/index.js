import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./authSlice";
import cartReducer from "./cartSlice";
import compareReducer from "./compareSlice";
import notificationsReducer from "./notificationsSlice";
import publicSettingsReducer from "./publicSettingsSlice";
import recentlyViewedReducer from "./recentlyViewedSlice";
import wishlistReducer from "./wishlistSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    cart: cartReducer,
    compare: compareReducer,
    notifications: notificationsReducer,
    publicSettings: publicSettingsReducer,
    recentlyViewed: recentlyViewedReducer,
    wishlist: wishlistReducer,
  },
});

export default store;
