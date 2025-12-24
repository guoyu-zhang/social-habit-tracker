import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  RefreshControl,
  Dimensions,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../services/supabase";
import { Habit, HabitStats, HabitCompletion } from "../types";
import { RootStackParamList } from "../types";
import { useFocusEffect } from "@react-navigation/native";
import HabitCalendar from "../components/HabitCalendar";
import ImageModal from "../components/ImageModal";
import { useCollapsibleHeader } from "../hooks/useCollapsibleHeader";

type HabitsScreenNavigationProp = StackNavigationProp<RootStackParamList>;

const HEADER_HEIGHT = 120;

interface HabitWithStats extends Habit {
  stats: HabitStats;
  completedToday: boolean;
  completions: HabitCompletion[];
}

const HabitsScreen: React.FC = () => {
  const [habits, setHabits] = useState<HabitWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedCompletion, setSelectedCompletion] =
    useState<HabitCompletion | null>(null);
  const { user } = useAuth();
  const navigation = useNavigation<HabitsScreenNavigationProp>();
  const { scrollY, translateY, handleScroll } =
    useCollapsibleHeader(HEADER_HEIGHT);

  // useEffect(() => {
  //   if (user) {
  //     fetchHabits();
  //   }
  // }, [user]);

  useFocusEffect(
    React.useCallback(() => {
      if (user) {
        fetchHabits();
      }
    }, [user])
  );

  const fetchHabits = async () => {
    try {
      if (!user) return;

      const { data: habitsData, error: habitsError } = await supabase
        .from("habits")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (habitsError) throw habitsError;

      // Fetch all completions for the user
      const { data: completions, error: completionsError } = await supabase
        .from("habit_completions")
        .select("*")
        .eq("user_id", user.id)
        .order("completed_at", { ascending: false });

      if (completionsError) throw completionsError;

      // Fetch stats and today's completions for each habit
      const habitsWithStats = await Promise.all(
        (habitsData || []).map(async (habit) => {
          const stats = await fetchHabitStats(habit.id);
          const completedToday = await checkCompletedToday(habit.id);
          const habitCompletions = (completions || []).filter(
            (completion) => completion.habit_id === habit.id
          );
          return {
            ...habit,
            stats,
            completedToday,
            completions: habitCompletions,
          };
        })
      );

      setHabits(habitsWithStats);
    } catch (error) {
      console.error("Error fetching habits:", error);
      Alert.alert("Error", "Failed to load habits");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchHabitStats = async (habitId: string): Promise<HabitStats> => {
    try {
      const { data, error } = await supabase
        .from("habit_completions")
        .select("completed_at")
        .eq("habit_id", habitId)
        .order("completed_at", { ascending: false });

      if (error) throw error;

      const completions = data || [];
      const totalCompletions = completions.length;

      // Calculate current streak
      let currentStreak = 0;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (completions.length > 0) {
        // Check if the most recent completion is today or yesterday
        const mostRecentDate = new Date(completions[0].completed_at);
        mostRecentDate.setHours(0, 0, 0, 0);

        const daysSinceLastCompletion = Math.floor(
          (today.getTime() - mostRecentDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        // If the last completion was more than 1 day ago, streak is broken
        if (daysSinceLastCompletion <= 1) {
          // Start counting streak from the most recent completion
          let expectedDate = new Date(mostRecentDate);

          for (let i = 0; i < completions.length; i++) {
            const completionDate = new Date(completions[i].completed_at);
            completionDate.setHours(0, 0, 0, 0);

            // Check if this completion matches the expected date
            if (completionDate.getTime() === expectedDate.getTime()) {
              currentStreak++;
              // Move expected date back by one day for next iteration
              expectedDate.setDate(expectedDate.getDate() - 1);
            } else {
              // Gap found, streak is broken
              break;
            }
          }
        }
      }

      // Calculate longest streak by analyzing all completion history
      let longestStreak = 0;
      if (completions.length > 0) {
        let tempStreak = 1;
        longestStreak = 1;

        for (let i = 1; i < completions.length; i++) {
          const currentDate = new Date(completions[i - 1].completed_at);
          const previousDate = new Date(completions[i].completed_at);
          currentDate.setHours(0, 0, 0, 0);
          previousDate.setHours(0, 0, 0, 0);

          const daysDiff = Math.floor(
            (currentDate.getTime() - previousDate.getTime()) /
              (1000 * 60 * 60 * 24)
          );

          if (daysDiff === 1) {
            // Consecutive days
            tempStreak++;
            longestStreak = Math.max(longestStreak, tempStreak);
          } else {
            // Gap found, reset streak
            tempStreak = 1;
          }
        }
      }

      return {
        habit_id: habitId,
        current_streak: currentStreak,
        longest_streak: longestStreak,
        total_completions: totalCompletions,
        completion_rate: 0, // Simplified for now
        last_completed: completions[0]?.completed_at || null,
      };
    } catch (error) {
      console.error("Error fetching habit stats:", error);
      return {
        habit_id: habitId,
        current_streak: 0,
        longest_streak: 0,
        total_completions: 0,
        completion_rate: 0,
        last_completed: null,
      };
    }
  };

  const checkCompletedToday = async (habitId: string): Promise<boolean> => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const { data, error } = await supabase
        .from("habit_completions")
        .select("id")
        .eq("habit_id", habitId)
        .gte("completed_at", today.toISOString())
        .lt("completed_at", tomorrow.toISOString());

      if (error) throw error;
      return (data || []).length > 0;
    } catch (error) {
      console.error("Error checking today completion:", error);
      return false;
    }
  };

  const handleTogglePrivacy = async (habit: HabitWithStats) => {
    try {
      const newIsPublic = !habit.is_public;

      const { error } = await supabase
        .from("habits")
        .update({ is_public: newIsPublic })
        .eq("id", habit.id);

      if (error) throw error;

      // Update local state
      setHabits(
        habits.map((h) =>
          h.id === habit.id ? { ...h, is_public: newIsPublic } : h
        )
      );

      Alert.alert(
        "Privacy Updated",
        `"${habit.title}" is now ${newIsPublic ? "public" : "private"}. ${
          newIsPublic
            ? "Others can see your progress in the feed."
            : "Your progress is now private."
        }`
      );
    } catch (error) {
      console.error("Error updating privacy:", error);
      Alert.alert(
        "Error",
        "Failed to update privacy setting. Please try again."
      );
    }
  };

  const handleCompleteHabit = (habit: HabitWithStats) => {
    if (habit.completedToday) {
      Alert.alert(
        "Already Completed",
        "You have already completed this habit today!"
      );
      return;
    }

    // Navigate directly to dual camera
    navigation.navigate("DualCamera", { habitId: habit.id });
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchHabits();
  };

  const handleCompletionPress = (completion: HabitCompletion) => {
    setSelectedCompletion(completion);
    setModalVisible(true);
  };

  const handleCloseModal = () => {
    setModalVisible(false);
    setSelectedCompletion(null);
  };

  const renderHabitItem = ({ item }: { item: HabitWithStats }) => (
    <View
      style={[
        styles.habitCard,
        { backgroundColor: "#fff", borderWidth: 1, borderColor: "#f0f0f0" },
      ]}
    >
      <TouchableOpacity
        style={styles.habitHeader}
        onPress={() => navigation.navigate("HabitDetail", { habitId: item.id })}
        activeOpacity={0.7}
      >
        <View style={styles.habitInfo}>
          <View style={styles.titleRow}>
            <Text style={styles.habitTitle}>{item.title}</Text>
            {item.stats.current_streak > 0 && (
              <Text style={styles.streakDisplay}>
                {item.stats.current_streak} 🔥
              </Text>
            )}
          </View>
          {item.description && (
            <Text style={styles.habitDescription}>{item.description}</Text>
          )}
        </View>
        <View style={styles.habitActions}>
          <TouchableOpacity
            style={[
              styles.completeButton,
              item.completedToday && styles.completedButton,
            ]}
            onPress={() => handleCompleteHabit(item)}
            disabled={item.completedToday}
          >
            <Ionicons
              name={
                item.completedToday
                  ? "checkmark-circle"
                  : "checkmark-circle-outline"
              }
              size={32}
              color={item.completedToday ? "#4CAF50" : "#007AFF"}
            />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>

      <View style={styles.calendarContainer}>
        <HabitCalendar
          habitId={item.id}
          habitTitle={item.title}
          habitColor={item.color}
          completions={item.completions}
          onCompletionPress={handleCompletionPress}
          compact={true}
          hideHeader={true}
          showMonthNavigation={false}
        />
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <Text>Loading habits...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.header,
          {
            transform: [{ translateY }],
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 10,
          },
        ]}
      >
        <Text style={styles.headerTitle}>My Habits</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate("CreateHabit")}
        >
          <Ionicons name="add" size={24} color="#000" />
        </TouchableOpacity>
      </Animated.View>

      <View style={styles.contentContainer}>
        {/* Habits Content - Full width */}
        <View style={styles.habitsContainer}>
          {habits.length === 0 ? (
            <View
              style={[styles.emptyContainer, { paddingTop: HEADER_HEIGHT }]}
            >
              <Ionicons
                name="checkmark-circle-outline"
                size={64}
                color="#ccc"
              />
              <Text style={styles.emptyTitle}>No Habits Yet</Text>
              <Text style={styles.emptySubtitle}>
                Create your first habit to get started!
              </Text>
              <TouchableOpacity
                style={styles.createButton}
                onPress={() => navigation.navigate("CreateHabit")}
              >
                <Text style={styles.createButtonText}>Create Habit</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Animated.FlatList
              data={habits}
              renderItem={renderHabitItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={[
                styles.listContainer,
                { paddingTop: HEADER_HEIGHT + 20 },
              ]}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  progressViewOffset={HEADER_HEIGHT}
                />
              }
              onScroll={handleScroll}
              scrollEventThrottle={16}
            />
          )}
        </View>
      </View>

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
    backgroundColor: "#fff",
  },
  contentContainer: {
    flex: 1,
  },
  habitsContainer: {
    width: "100%",
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: "#fff",
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: "bold",
    color: "#333",
  },
  addButton: {
    backgroundColor: "rgba(0, 0, 0, 0.05)",
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  listContainer: {
    padding: 20,
  },
  habitCard: {
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    shadowColor: "rgba(0, 0, 0, 0.1)",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  habitHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  habitInfo: {
    flex: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  streakDisplay: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  habitActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  privacyButton: {
    padding: 8,
  },
  habitTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  habitDescription: {
    fontSize: 14,
    color: "#666",
  },
  completeButton: {
    padding: 8,
  },
  completedButton: {
    opacity: 0.6,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  statItem: {
    alignItems: "center",
  },
  statNumber: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#007AFF",
  },
  statLabel: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },
  statValue: {
    fontSize: 14,
    color: "#333",
    marginTop: 2,
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
    color: "#fff",
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.8)",
    textAlign: "center",
    marginBottom: 32,
  },
  createButton: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 16,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  createButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  calendarContainer: {
    marginTop: 8,
  },
});

export default HabitsScreen;
