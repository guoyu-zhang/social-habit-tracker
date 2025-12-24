import React from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "./src/contexts/AuthContext";
import { UploadProvider } from "./src/contexts/UploadContext";
import { HabitProvider } from "./src/contexts/HabitContext";
import { Navigation } from "./src/components/Navigation";

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <UploadProvider>
          <HabitProvider>
            <Navigation />
            <StatusBar style="auto" />
          </HabitProvider>
        </UploadProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
