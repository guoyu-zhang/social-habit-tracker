import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../types";
import { useAuth } from "../contexts/AuthContext";
import { supabase, BUCKETS } from "../services/supabase";
import { useHabits } from "../contexts/HabitContext";

type SettingsScreenNavigationProp = StackNavigationProp<RootStackParamList>;

const SettingsScreen: React.FC = () => {
  const navigation = useNavigation<SettingsScreenNavigationProp>();
  const { signOut, user } = useAuth();
  const { fetchHabits } = useHabits();
  const [resetting, setResetting] = React.useState(false);

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: signOut },
    ]);
  };

  const handleResetData = () => {
    Alert.alert(
      "Reset All Data",
      "Are you sure you want to delete all your habits and progress? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: performReset,
        },
      ]
    );
  };

  const performReset = async () => {
    if (!user) return;
    setResetting(true);
    try {
      // 1. Fetch user's habits to get IDs for storage cleanup
      const { data: userHabits, error: fetchError } = await supabase
        .from("habits")
        .select("id")
        .eq("user_id", user.id);

      if (fetchError) throw fetchError;

      // 2. Delete images from storage for each habit
      if (userHabits && userHabits.length > 0) {
        for (const habit of userHabits) {
          const folderPath = `${user.id}/${habit.id}`;
          const { data: files } = await supabase.storage
            .from(BUCKETS.HABIT_IMAGES)
            .list(folderPath);

          if (files && files.length > 0) {
            const pathsToDelete = files.map((f) => `${folderPath}/${f.name}`);
            await supabase.storage
              .from(BUCKETS.HABIT_IMAGES)
              .remove(pathsToDelete);
          }
        }
      }

      // 3. Delete all completions
      const { error: completionsError } = await supabase
        .from("habit_completions")
        .delete()
        .eq("user_id", user.id);

      if (completionsError) throw completionsError;

      // 4. Delete all habits
      const { error: habitsError } = await supabase
        .from("habits")
        .delete()
        .eq("user_id", user.id);

      if (habitsError) throw habitsError;

      Alert.alert("Success", "All data has been reset successfully.");
    } catch (error: any) {
      console.error("Error resetting data:", error);
      Alert.alert("Error", error.message || "Failed to reset data");
    } finally {
      setResetting(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>Preferences</Text>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => navigation.navigate("Notifications")}
        >
          <Ionicons name="notifications-outline" size={24} color="#333" />
          <Text style={styles.menuText}>Notifications</Text>
          <Ionicons name="chevron-forward" size={20} color="#ccc" />
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionHeader}>Support</Text>
        <TouchableOpacity style={styles.menuItem}>
          <Ionicons name="help-circle-outline" size={24} color="#333" />
          <Text style={styles.menuText}>Help & Support</Text>
          <Ionicons name="chevron-forward" size={20} color="#ccc" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <Ionicons name="information-circle-outline" size={24} color="#333" />
          <Text style={styles.menuText}>About</Text>
          <Ionicons name="chevron-forward" size={20} color="#ccc" />
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionHeader}>Data Management</Text>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={handleResetData}
          disabled={resetting}
        >
          <Ionicons name="trash-outline" size={24} color="#FF3B30" />
          <Text style={[styles.menuText, { color: "#FF3B30" }]}>
            {resetting ? "Resetting..." : "Reset All Data"}
          </Text>
          {resetting && <ActivityIndicator size="small" color="#FF3B30" />}
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={24} color="#FF3B30" />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Version 1.0.0</Text>
        <Text style={styles.footerText}>Made with ❤️ for habit tracking</Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  section: {
    backgroundColor: "#fff",
    marginTop: 20,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#e1e1e1",
  },
  sectionHeader: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    fontSize: 13,
    fontWeight: "600",
    color: "#666",
    textTransform: "uppercase",
    backgroundColor: "#f5f5f5",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    color: "#333",
    marginLeft: 16,
  },
  signOutButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    justifyContent: "center",
  },
  signOutText: {
    fontSize: 16,
    color: "#FF3B30",
    marginLeft: 16,
    fontWeight: "600",
  },
  footer: {
    alignItems: "center",
    paddingVertical: 32,
  },
  footerText: {
    fontSize: 14,
    color: "#999",
    marginBottom: 4,
  },
});

export default SettingsScreen;
