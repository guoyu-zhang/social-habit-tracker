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

      // Refresh habits context to clear local state
      await fetchHabits();

      Alert.alert("Success", "All data has been reset successfully.");
    } catch (error: any) {
      console.error("Error resetting data:", error);
      Alert.alert("Error", error.message || "Failed to reset data");
    } finally {
      setResetting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView}>
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Preferences</Text>
          <View style={styles.menuItem}>
            <View style={styles.menuIconContainer}>
              <Ionicons name="notifications-outline" size={22} color="#333" />
            </View>
            <Text style={styles.menuText}>Notifications</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Support</Text>
          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuIconContainer}>
              <Ionicons name="help-circle-outline" size={22} color="#333" />
            </View>
            <Text style={styles.menuText}>Help & Support</Text>
            <Ionicons name="chevron-forward" size={18} color="#ccc" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuIconContainer}>
              <Ionicons
                name="information-circle-outline"
                size={22}
                color="#333"
              />
            </View>
            <Text style={styles.menuText}>About</Text>
            <Ionicons name="chevron-forward" size={18} color="#ccc" />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Data Management</Text>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={handleResetData}
            disabled={resetting}
          >
            <View style={styles.menuIconContainer}>
              <Ionicons name="trash-outline" size={22} color="#FF3B30" />
            </View>
            <Text style={[styles.menuText, { color: "#FF3B30" }]}>
              {resetting ? "Resetting..." : "Reset All Data"}
            </Text>
            {resetting && <ActivityIndicator size="small" color="#FF3B30" />}
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <TouchableOpacity
            style={styles.signOutButton}
            onPress={handleSignOut}
          >
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Version 1.0.0</Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 24,
    backgroundColor: "#fff",
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  placeholder: {
    width: 40,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "600",
    color: "#1a1a1a",
    letterSpacing: -0.5,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    marginBottom: 40,
    paddingHorizontal: 24,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: "700",
    color: "#999",
    marginBottom: 16,
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
  },
  menuIconContainer: {
    width: 40,
    alignItems: "flex-start",
  },
  menuText: {
    flex: 1,
    fontSize: 17,
    color: "#000",
    fontWeight: "500",
    letterSpacing: -0.3,
  },
  signOutButton: {
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },
  signOutText: {
    fontSize: 17,
    color: "#FF3B30",
    fontWeight: "600",
    letterSpacing: -0.3,
  },
  footer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  footerText: {
    fontSize: 13,
    color: "#C7C7CC",
    fontWeight: "500",
  },
});

export default SettingsScreen;
