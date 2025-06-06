import { createSlice} from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit"

interface UIState {
  darkMode: boolean;
  sidebarOpen: boolean;
}

const initialState: UIState = {
  darkMode: false,
  sidebarOpen: false,
};

const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    toggleDarkMode: (state) => {
      state.darkMode = !state.darkMode;
    },
    setSidebarOpen: (state, action: PayloadAction<boolean>) => {
      state.sidebarOpen = action.payload;
    },
  },
});

export const { toggleDarkMode, setSidebarOpen } = uiSlice.actions;
export default uiSlice.reducer;
