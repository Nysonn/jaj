import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit"

interface AuthState {
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  user: {
    id?: number;
    username?: string;
    email?: string;
  } | null;
}

const initialState: AuthState = {
  isAuthenticated: false,
  loading: false,
  error: null,
  user: null,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    loginStart(state) {
      state.loading = true;
      state.error = null;
    },
    loginSuccess(state, action: PayloadAction<{ message: string }>) {
      state.loading = false;
      state.isAuthenticated = true;
      state.error = null;
    },
    loginFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.isAuthenticated = false;
      state.error = action.payload;
    },
    setUser(state, action: PayloadAction<{ id: number; username: string; email: string }>) {
      state.user = action.payload;
      state.isAuthenticated = true;
    },
    logout(state) {
      state.isAuthenticated = false;
      state.loading = false;
      state.error = null;
      state.user = null;
    },
    clearError(state) {
      state.error = null;
    },
  },
});

export const { 
  loginStart, 
  loginSuccess, 
  loginFailure, 
  logout, 
  setUser, 
  clearError 
} = authSlice.actions;

export default authSlice.reducer;