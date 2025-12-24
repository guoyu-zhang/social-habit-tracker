import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRoute, useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RouteProp } from "@react-navigation/native";
import { supabase, BUCKETS } from "../services/supabase";
import { Habit, HabitStats, HabitCompletion } from "../types";
import { RootStackParamList } from "../types";
import { useFocusEffect } from "@react-navigation/native";
import HabitCalendar from "../components/HabitCalendar";
import ImageModal from "../components/ImageModal";

type HabitDetailScreenRouteProp = RouteProp<RootStackParamList, "HabitDetail">;
type HabitDetailScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  "HabitDetail"
>;

const HabitDetailScreen: React.FC = () => {
  const [habit, setHabit] = useState<Habit | null>(null);
  const [stats, setStats] = useState<HabitStats | null>(null);
  const [completions, setCompletions] = useState<HabitCompletion[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedCompletion, setSelectedCompletion] =
    useState<HabitCompletion | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  const route = useRoute<HabitDetailScreenRouteProp>();
  const navigation = useNavigation<HabitDetailScreenNavigationProp>();
  const { habitId } = route.params;

  // useEffect(() => {
  //   fetchHabitDetails();
  // }, [habitId]);

  useFocusEffect(
    React.useCallback(() => {
      if (habitId) {
        fetchHabitDetails();
      }
    }, [habitId])
  );

  const fetchHabitDetails = async () => {
    try {
      // Fetch habit details
      const { data: habitData, error: habitError } = await supabase
        .from("habits")
        .select("*")
        .eq("id", habitId)
        .single();

      if (habitError) throw habitError;
      setHabit(habitData);

      // Fetch habit stats
      const { data: completionsData, error: completionsError } = await supabase
        .from("habit_completions")
        .select("*")
        .eq("habit_id", habitId)
        .order("completed_at", { ascending: false });

      if (completionsError) throw completionsError;

      setCompletions(completionsData || []);

      const completions = completionsData || [];
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

      setStats({
        habit_id: habitId,
        current_streak: currentStreak,
        longest_streak: longestStreak,
        total_completions: totalCompletions,
        completion_rate: 0, // Simplified
        last_completed: completions[0]?.completed_at || null,
      });
    } catch (error) {
      console.error("Error fetching habit details:", error);
      Alert.alert("Error", "Failed to load habit details");
    } finally {
      setLoading(false);
    }
  };

  const handleCompletionPress = (completion: HabitCompletion) => {
    setSelectedCompletion(completion);
    setModalVisible(true);
  };

  const handleDayPress = (date: Date, habitId: string) => {
    const selectedDate = date.toISOString();
    // Navigate directly to dual camera
    navigation.navigate("DualCamera", { habitId, selectedDate });
  };

  const handleCloseModal = () => {
    setModalVisible(false);
    setSelectedCompletion(null);
  };

  const handleDeleteCompletion = async (completionId: string) => {
    // Remove the completion from local state
    setCompletions((prev) => prev.filter((c) => c.id !== completionId));

    // Refresh habit details to update stats
    await fetchHabitDetails();
  };

  const handleEditHabitName = () => {
    if (!habit) return;
    setEditedTitle(habit.title);
    setEditModalVisible(true);
  };

  const handleSaveHabitName = async () => {
    if (!habit || !editedTitle.trim()) return;

    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from("habits")
        .update({ title: editedTitle.trim() })
        .eq("id", habit.id);

      if (error) {
        Alert.alert("Error", "Failed to update habit name. Please try again.");
        return;
      }

      // Update local state
      setHabit((prev) =>
        prev ? { ...prev, title: editedTitle.trim() } : null
      );
      setEditModalVisible(false);
      Alert.alert("Success", "Habit name updated successfully!");
    } catch (error) {
      Alert.alert("Error", "Failed to update habit name. Please try again.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancelEdit = () => {
    setEditModalVisible(false);
    setEditedTitle("");
  };

  const handleDeleteHabit = () => {
    Alert.alert(
      "Delete Habit",
      "Are you sure you want to delete this habit? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: deleteHabit },
      ]
    );
  };

  const deleteHabit = async () => {
    try {
      // First, fetch all habit completions to get image URLs
      const { data: completions, error: completionsError } = await supabase
        .from("habit_completions")
        .select("image_url, front_image_url")
        .eq("habit_id", habitId);

      if (completionsError) throw completionsError;

      // Extract all image URLs that need to be deleted
      const imageUrls: string[] = [];
      completions?.forEach((completion) => {
        if (completion.image_url) {
          // Extract file path from the full URL
          const urlParts = completion.image_url.split("/");
          const fileName = urlParts[urlParts.length - 1];
          const userFolder = urlParts[urlParts.length - 2];
          const habitFolder = urlParts[urlParts.length - 3];
          imageUrls.push(`${habitFolder}/${userFolder}/${fileName}`);
        }
        if (completion.front_image_url) {
          // Extract file path from the full URL for front camera image
          const urlParts = completion.front_image_url.split("/");
          const fileName = urlParts[urlParts.length - 1];
          const userFolder = urlParts[urlParts.length - 2];
          const habitFolder = urlParts[urlParts.length - 3];
          imageUrls.push(`${habitFolder}/${userFolder}/${fileName}`);
        }
      });

      // Delete all images from storage
      if (imageUrls.length > 0) {
        const { error: storageError } = await supabase.storage
          .from(BUCKETS.HABIT_IMAGES)
          .remove(imageUrls);

        if (storageError) {
          console.warn(
            "Some images could not be deleted from storage:",
            storageError
          );
          // Continue with habit deletion even if some images fail to delete
        }
      }

      // Delete all habit completions (this should cascade, but being explicit)
      const { error: completionDeleteError } = await supabase
        .from("habit_completions")
        .delete()
        .eq("habit_id", habitId);

      if (completionDeleteError) throw completionDeleteError;

      // Finally, delete the habit itself
      const { error: habitDeleteError } = await supabase
        .from("habits")
        .delete()
        .eq("id", habitId);

      if (habitDeleteError) throw habitDeleteError;

      Alert.alert(
        "Success",
        "Habit and all associated data deleted successfully",
        [{ text: "OK", onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      console.error("Error deleting habit:", error);
      Alert.alert("Error", "Failed to delete habit. Please try again.");
    }
  };

  const handleTogglePrivacy = async () => {
    if (!habit) return;

    try {
      const newIsPublic = !habit.is_public;

      const { error } = await supabase
        .from("habits")
        .update({ is_public: newIsPublic })
        .eq("id", habit.id);

      if (error) throw error;

      // Update local state
      setHabit({ ...habit, is_public: newIsPublic });

      Alert.alert(
        "Privacy Updated",
        `Your habit is now ${newIsPublic ? "public" : "private"}. ${
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

  const handleCompleteHabit = () => {
    if (!habit) return;

    // Navigate directly to dual camera
    navigation.navigate("DualCamera", { habitId: habit.id });
  };

  if (loading || !habit || !stats) {
    return (
      <View style={styles.centerContainer}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.navHeader}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.navHeaderTitle}>Habit Details</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView>
        <View style={[styles.header, { backgroundColor: "#fff" }]}>
          <View style={styles.titleContainer}>
            <Text style={styles.habitTitle}>{habit.title}</Text>
            <TouchableOpacity
              onPress={handleEditHabitName}
              style={styles.editButton}
            >
              <Ionicons name="pencil" size={20} color="#333" />
            </TouchableOpacity>
          </View>
          {habit.description && (
            <Text style={styles.habitDescription}>{habit.description}</Text>
          )}
        </View>

        <View style={styles.statsContainer}>
          <Text style={styles.sectionTitle}>Statistics</Text>

          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{stats.current_streak}</Text>
              <Text style={styles.statLabel}>Current Streak</Text>
            </View>

            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{stats.total_completions}</Text>
              <Text style={styles.statLabel}>Total Completions</Text>
            </View>

            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{stats.longest_streak}</Text>
              <Text style={styles.statLabel}>Longest Streak</Text>
            </View>
          </View>
        </View>

        <View style={styles.calendarContainer}>
          <Text style={styles.sectionTitle}>Calendar</Text>
          <HabitCalendar
            habitId={habit.id}
            habitTitle={habit.title}
            habitColor={habit.color}
            completions={completions}
            onCompletionPress={handleCompletionPress}
            onDayPress={handleDayPress}
            hideHeader={true}
            showMonthNavigation={true}
          />
        </View>

        <View style={styles.infoContainer}>
          <Text style={styles.sectionTitle}>Details</Text>

          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={20} color="#666" />
            <Text style={styles.infoLabel}>Created</Text>
            <Text style={styles.infoValue}>
              {new Date(habit.created_at).toLocaleDateString()}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="repeat-outline" size={20} color="#666" />
            <Text style={styles.infoLabel}>Frequency</Text>
            <Text style={styles.infoValue}>{habit.frequency}</Text>
          </View>

          <TouchableOpacity
            style={styles.infoRow}
            onPress={handleTogglePrivacy}
          >
            <Ionicons
              name={habit.is_public ? "globe-outline" : "lock-closed-outline"}
              size={20}
              color="#666"
            />
            <Text style={styles.infoLabel}>Visibility</Text>
            <Text style={styles.infoValue}>
              {habit.is_public ? "Public" : "Private"}
            </Text>
            <Ionicons name="chevron-forward" size={16} color="#ccc" />
          </TouchableOpacity>

          {stats.last_completed && (
            <View style={styles.infoRow}>
              <Ionicons
                name="checkmark-circle-outline"
                size={20}
                color="#666"
              />
              <Text style={styles.infoLabel}>Last Completed</Text>
              <Text style={styles.infoValue}>
                {new Date(stats.last_completed).toLocaleDateString()}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={styles.completeButton}
            onPress={handleCompleteHabit}
          >
            <Ionicons name="camera" size={20} color="#fff" />
            <Text style={styles.completeButtonText}>Complete Habit</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDeleteHabit}
          >
            <Ionicons name="trash-outline" size={20} color="#FF3B30" />
            <Text style={styles.deleteButtonText}>Delete Habit</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <ImageModal
        visible={modalVisible}
        completion={selectedCompletion}
        onClose={handleCloseModal}
        onDelete={handleDeleteCompletion}
      />

      {/* Edit Habit Name Modal */}
      <Modal
        visible={editModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={handleCancelEdit}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.editModalContainer}>
            <Text style={styles.editModalTitle}>Edit Habit Name</Text>
            <TextInput
              style={styles.editInput}
              value={editedTitle}
              onChangeText={setEditedTitle}
              placeholder="Enter habit name"
              autoFocus={true}
              maxLength={50}
            />
            <View style={styles.editModalButtons}>
              <TouchableOpacity
                style={[styles.editModalButton, styles.cancelButton]}
                onPress={handleCancelEdit}
                disabled={isUpdating}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.editModalButton, styles.saveButton]}
                onPress={handleSaveHabitName}
                disabled={isUpdating || !editedTitle.trim()}
              >
                <Text style={styles.saveButtonText}>
                  {isUpdating ? "Saving..." : "Save"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  },
  navHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  navHeaderTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  backButton: {
    padding: 8,
  },
  placeholder: {
    width: 40,
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  habitTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#333",
    flex: 1,
  },
  editButton: {
    padding: 8,
  },
  habitDescription: {
    fontSize: 16,
    color: "#666",
    lineHeight: 24,
  },
  statsContainer: {
    backgroundColor: "#fff",
    margin: 20,
    borderRadius: 12,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: "row",
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#f8f9fa",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
  },
  statNumber: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#007AFF",
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: "#666",
    textAlign: "center",
  },
  infoContainer: {
    backgroundColor: "#fff",
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 12,
    padding: 20,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  infoLabel: {
    flex: 1,
    fontSize: 16,
    color: "#333",
    marginLeft: 12,
  },
  infoValue: {
    fontSize: 16,
    color: "#666",
    fontWeight: "500",
  },
  actionsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  completeButton: {
    backgroundColor: "#007AFF",
    borderRadius: 8,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  completeButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  deleteButton: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#FF3B30",
  },
  deleteButtonText: {
    color: "#FF3B30",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  calendarContainer: {
    backgroundColor: "#fff",
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 12,
    padding: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  editModalContainer: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 20,
    width: "80%",
    maxWidth: 300,
  },
  editModalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
    textAlign: "center",
  },
  editInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  editModalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  editModalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: "#f0f0f0",
    marginRight: 8,
  },
  saveButton: {
    backgroundColor: "#007AFF",
    marginLeft: 8,
  },
  cancelButtonText: {
    color: "#333",
    fontWeight: "600",
  },
  saveButtonText: {
    color: "white",
    fontWeight: "600",
  },
});

export default HabitDetailScreen;
