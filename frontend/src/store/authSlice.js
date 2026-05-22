import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  user: null,
  token: null,
  isLoading: true,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setAuth(state, action) {
      state.user = action.payload?.user || null;
      state.token = action.payload?.token || null;
      state.isLoading = false;
    },
    setUser(state, action) {
      state.user = action.payload || null;
    },
    clearAuth(state) {
      state.user = null;
      state.token = null;
      state.isLoading = false;
    },
    setAuthLoading(state, action) {
      state.isLoading = Boolean(action.payload);
    },
  },
});

export const { setAuth, setUser, clearAuth, setAuthLoading } = authSlice.actions;
export default authSlice.reducer;
