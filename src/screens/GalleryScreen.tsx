import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../services/supabase";
import { HabitCompletion, Habit } from "../types";
import HabitCalendar from "../components/HabitCalendar";
import ImageModal from "../components/ImageModal";

interface HabitWithCompletions {
  id: string;
  title: string;
  color: string;
  completions: HabitCompletion[];
}

const GalleryScreen: React.FC = () => {
  const [habitsWithCompletions, setHabitsWithCompletions] = useState<
    HabitWithCompletions[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedCompletion, setSelectedCompletion] =
    useState<HabitCompletion | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchGallery();
    }
  }, [user]);

  useFocusEffect(
    React.useCallback(() => {
      if (user) {
        fetchGallery();
      }
    }, [user])
  );

  const fetchGallery = async () => {
    try {
      if (!user) return;

      // First, fetch all user's habits
      const { data: habits, error: habitsError } = await supabase
        .from("habits")
        .select("id, title, color")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (habitsError) throw habitsError;

      // Then, fetch all completions with images for these habits
      const { data: completions, error: completionsError } = await supabase
        .from("habit_completions")
        .select("*")
        .eq("user_id", user.id)
        .not("image_url", "is", null)
        .order("completed_at", { ascending: false });

      if (completionsError) throw completionsError;

      // Group completions by habit
      const habitsWithCompletionsData: HabitWithCompletions[] = (habits || [])
        .map((habit) => ({
          id: habit.id,
          title: habit.title,
          color: habit.color,
          completions: (completions || []).filter(
            (completion) => completion.habit_id === habit.id
          ),
        }))
        .filter((habit) => habit.completions.length > 0); // Only show habits with image completions

      setHabitsWithCompletions(habitsWithCompletionsData);
    } catch (error) {
      console.error("Error fetching gallery:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchGallery();
  };

  const getTotalCompletions = () => {
    return habitsWithCompletions.reduce(
      (total, habit) => total + habit.completions.length,
      0
    );
  };

  const handleCompletionPress = (completion: HabitCompletion) => {
    setSelectedCompletion(completion);
    setModalVisible(true);
  };

  const handleCloseModal = () => {
    setModalVisible(false);
    setSelectedCompletion(null);
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <Text>Loading gallery...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Gallery</Text>
        <Text style={styles.headerSubtitle}>
          {getTotalCompletions()} photos
        </Text>
      </View>

      {habitsWithCompletions.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="images-outline" size={64} color="#ccc" />
          <Text style={styles.emptyTitle}>No Photos Yet</Text>
          <Text style={styles.emptySubtitle}>
            Complete habits with photos to build your gallery!
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {habitsWithCompletions.map((habit) => (
            <HabitCalendar
              key={habit.id}
              habitId={habit.id}
              habitTitle={habit.title}
              habitColor={habit.color}
              completions={habit.completions}
              onCompletionPress={handleCompletionPress}
            />
          ))}
        </ScrollView>
      )}

      <ImageModal
        visible={modalVisible}
        completion={selectedCompletion}
        onClose={handleCloseModal}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: "#fff",
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#333",
  },
  headerSubtitle: {
    fontSize: 16,
    color: "#666",
    marginTop: 4,
  },
  listContainer: {
    padding: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
  },
});

export default GalleryScreen;
