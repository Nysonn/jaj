import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./slices/authSlice";
import uiReducer from "./slices/uiSlice"; // Import your UI slice

const store = configureStore({
  reducer: {
    auth: authReducer,
    ui: uiReducer, // Add UI reducer
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export default store;