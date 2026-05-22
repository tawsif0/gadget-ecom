import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  cartItems: [],
  cartCount: 0,
  isLoading: false,
  isLoggedIn: false,
};

const normalizeItems = (items) => (Array.isArray(items) ? items : []);

const cartSlice = createSlice({
  name: "cart",
  initialState,
  reducers: {
    setCartItems(state, action) {
      const items = normalizeItems(action.payload);
      state.cartItems = items;
      state.cartCount = items.length;
    },
    setCartLoading(state, action) {
      state.isLoading = Boolean(action.payload);
    },
    setCartLoggedIn(state, action) {
      state.isLoggedIn = Boolean(action.payload);
    },
    clearCartState(state) {
      state.cartItems = [];
      state.cartCount = 0;
      state.isLoading = false;
    },
  },
});

export const { setCartItems, setCartLoading, setCartLoggedIn, clearCartState } =
  cartSlice.actions;
export default cartSlice.reducer;
