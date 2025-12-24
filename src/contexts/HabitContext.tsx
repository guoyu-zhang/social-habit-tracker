import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useCallback,
} from "react";
import { Alert } from "react-native";
import { supabase, BUCKETS } from "../services/supabase";
import { Habit, HabitStats, HabitCompletion } from "../types";
import { useAuth } from "./AuthContext";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface HabitWithStats extends Habit {
  stats: HabitStats;
  completedToday: boolean;
  completions: HabitCompletion[];
}

interface HabitContextType {
  habits: HabitWithStats[];
  loading: boolean;
  refreshing: boolean;
  fetchHabits: () => Promise<void>;
  addHabit: (habit: Habit) => void;
  addHabitCompletion: (habitId: string, completion: HabitCompletion) => void;
  deleteHabit: (habitId: string) => void; // Non-async return for optimistic update
  updateHabitPrivacy: (habit: HabitWithStats) => Promise<void>;
}

const HabitContext = createContext<HabitContextType | undefined>(undefined);

export const useHabits = () => {
  const context = useContext(HabitContext);
  if (!context) {
    throw new Error("useHabits must be used within a HabitProvider");
  }
  return context;
};

export const HabitProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [habits, setHabits] = useState<HabitWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useAuth();

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

  const fetchHabits = useCallback(async () => {
    try {
      if (!user) return;
      setRefreshing(true);

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
      await AsyncStorage.setItem(
        `habits_${user.id}`,
        JSON.stringify(habitsWithStats)
      );
    } catch (error) {
      console.error("Error fetching habits:", error);
      Alert.alert("Error", "Failed to load habits");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  const addHabit = (habit: Habit) => {
    const newHabitWithStats: HabitWithStats = {
      ...habit,
      stats: {
        habit_id: habit.id,
        current_streak: 0,
        longest_streak: 0,
        total_completions: 0,
        completion_rate: 0,
        last_completed: null,
      },
      completedToday: false,
      completions: [],
    };

    setHabits((prev) => [newHabitWithStats, ...prev]);
  };

  const addHabitCompletion = (habitId: string, completion: HabitCompletion) => {
    setHabits((prev) =>
      prev.map((habit) => {
        if (habit.id !== habitId) return habit;

        // If already completed today, don't add duplicate (unless multiple completions allowed, but logic suggests 1/day)
        // But here we trust the caller (HabitsScreen) which checks for upload completion
        // We will just prepend the new completion

        const newStats = {
          ...habit.stats,
          total_completions: habit.stats.total_completions + 1,
          current_streak: habit.completedToday
            ? habit.stats.current_streak
            : habit.stats.current_streak + 1,
          last_completed: completion.completed_at,
        };

        return {
          ...habit,
          completedToday: true,
          stats: newStats,
          completions: [completion, ...habit.completions],
        };
      })
    );
  };

  const deleteHabit = (habitId: string) => {
    // Optimistic update: remove locally immediately
    setHabits((prev) => prev.filter((h) => h.id !== habitId));

    // Perform background deletion
    performBackgroundDelete(habitId).catch((err) => {
      console.error("Background delete failed:", err);
      // In a more robust app, we might want to revert the state here or show a toast
    });
  };

  const performBackgroundDelete = async (id: string) => {
    try {
      // First, fetch all habit completions to get image URLs
      const { data: completions, error: completionsError } = await supabase
        .from("habit_completions")
        .select("image_url, front_image_url")
        .eq("habit_id", id);

      if (completionsError) throw completionsError;

      // Extract all image URLs that need to be deleted
      const imageUrls: string[] = [];
      completions?.forEach((completion) => {
        if (completion.image_url) {
          const urlParts = completion.image_url.split("/");
          const fileName = urlParts[urlParts.length - 1];
          const userFolder = urlParts[urlParts.length - 2];
          const habitFolder = urlParts[urlParts.length - 3];
          imageUrls.push(`${habitFolder}/${userFolder}/${fileName}`);
        }
        if (completion.front_image_url) {
          const urlParts = completion.front_image_url.split("/");
          const fileName = urlParts[urlParts.length - 1];
          const userFolder = urlParts[urlParts.length - 2];
          const habitFolder = urlParts[urlParts.length - 3];
          imageUrls.push(`${habitFolder}/${userFolder}/${fileName}`);
        }
      });

      // Delete all images from storage in the background
      if (imageUrls.length > 0) {
        supabase.storage
          .from(BUCKETS.HABIT_IMAGES)
          .remove(imageUrls)
          .then(({ error }) => {
            if (error)
              console.warn("Background storage cleanup failed:", error);
          });
      }

      // Delete all habit completions
      const { error: completionDeleteError } = await supabase
        .from("habit_completions")
        .delete()
        .eq("habit_id", id);

      if (completionDeleteError) throw completionDeleteError;

      // Finally, delete the habit itself
      const { error: habitDeleteError } = await supabase
        .from("habits")
        .delete()
        .eq("id", id);

      if (habitDeleteError) throw habitDeleteError;

      console.log(`Habit ${id} deleted successfully in background`);
    } catch (error) {
      console.error("Error in performBackgroundDelete:", error);
      throw error;
    }
  };

  const updateHabitPrivacy = async (habit: HabitWithStats) => {
    try {
      const newIsPublic = !habit.is_public;

      // Optimistic update
      setHabits((prev) =>
        prev.map((h) =>
          h.id === habit.id ? { ...h, is_public: newIsPublic } : h
        )
      );

      const { error } = await supabase
        .from("habits")
        .update({ is_public: newIsPublic })
        .eq("id", habit.id);

      if (error) {
        // Revert on error
        setHabits((prev) =>
          prev.map((h) =>
            h.id === habit.id ? { ...h, is_public: habit.is_public } : h
          )
        );
        throw error;
      }
    } catch (error) {
      console.error("Error updating privacy:", error);
      Alert.alert("Error", "Failed to update privacy setting.");
    }
  };

  return (
    <HabitContext.Provider
      value={{
        habits,
        loading,
        refreshing,
        fetchHabits,
        addHabit,
        addHabitCompletion,
        deleteHabit,
        updateHabitPrivacy,
      }}
    >
      {children}
    </HabitContext.Provider>
  );
};
