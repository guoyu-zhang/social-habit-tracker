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
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRoute, useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RouteProp } from "@react-navigation/native";
import { supabase, BUCKETS } from "../services/supabase";
import { Habit, HabitStats, HabitCompletion } from "../types";
import { RootStackParamList } from "../types";
import { useFocusEffect } from "@react-navigation/native";
import { useHabits } from "../contexts/HabitContext";
import HabitCalendar from "../components/HabitCalendar";
import ImageModal from "../components/ImageModal";

type HabitDetailScreenRouteProp = RouteProp<RootStackParamList, "HabitDetail">;
type HabitDetailScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  "HabitDetail"
>;

const HABIT_COLORS = [
  "#FF6B6B", // Warm Red
  "#FF9F43", // Deep Orange
  "#FDCB6E", // Mustard Yellow
  "#55EFC4", // Mint Green
  "#00CEC9", // Robin's Egg Blue
  "#0984E3", // Electron Blue
  "#6C5CE7", // Exquisite Purple
  "#A29BFE", // Shy Moment Lavender
  "#FD79A8", // Pico Pink
  "#E84393", // Prunus Avium Pink
  "#636E72", // American River Grey
  "#2D3436", // Dracula Orchid (Dark Grey)
];

const hexToRgba = (hex: string, opacity: number) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(
        result[3],
        16
      )}, ${opacity})`
    : `rgba(0, 0, 0, ${opacity})`;
};

const HabitDetailScreen: React.FC = () => {
  const [habit, setHabit] = useState<Habit | null>(null);
  const [stats, setStats] = useState<HabitStats | null>(null);
  const [completions, setCompletions] = useState<HabitCompletion[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedCompletion, setSelectedCompletion] =
    useState<HabitCompletion | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const [editedIsPublic, setEditedIsPublic] = useState(false);
  const [editedColor, setEditedColor] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const { deleteHabit: deleteHabitFromContext, updateHabit } = useHabits();

  const route = useRoute<HabitDetailScreenRouteProp>();
  const navigation = useNavigation<HabitDetailScreenNavigationProp>();
  const { habitId, initialData } = route.params;

  useEffect(() => {
    if (initialData) {
      setHabit(initialData);
      setStats(initialData.stats);
      setCompletions(initialData.completions);
      setLoading(false);
      setEditedTitle(initialData.title);
      setEditedColor(initialData.color);
      setEditedIsPublic(initialData.is_public);
    }
  }, [initialData]);

  useFocusEffect(
    React.useCallback(() => {
      if (habitId) {
        // If we have initial data, we don't need to show loading, but we still want to refresh
        if (!initialData) {
          setLoading(true);
        }
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
      if (!isEditingName) {
        setEditedTitle(habitData.title);
        setEditedColor(habitData.color);
        setEditedIsPublic(habitData.is_public);
      }

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
    if (isEditingName) {
      Alert.alert(
        "Delete Entry",
        "Are you sure you want to delete this entry?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => handleDeleteCompletion(completion.id),
          },
        ]
      );
    } else {
      setSelectedCompletion(completion);
      setModalVisible(true);
    }
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
    try {
      // 1. Delete from database first
      const { error } = await supabase
        .from("habit_completions")
        .delete()
        .eq("id", completionId);

      if (error) throw error;

      // 2. Remove from local state
      setCompletions((prev) => prev.filter((c) => c.id !== completionId));

      // 3. Refresh habit details to update stats
      await fetchHabitDetails();
    } catch (error) {
      console.error("Error deleting completion:", error);
      Alert.alert("Error", "Failed to delete entry. Please try again.");
    }
  };

  const handleEditPress = () => {
    if (isEditingName) {
      handleSaveChanges();
    } else {
      if (habit) {
        setEditedTitle(habit.title);
        setEditedColor(habit.color);
        setEditedIsPublic(habit.is_public);
        setIsEditingName(true);
      }
    }
  };

  const handleSaveChanges = async () => {
    if (!habit || !editedTitle.trim()) return;

    setIsUpdating(true);
    try {
      const updates = {
        title: editedTitle.trim(),
        is_public: editedIsPublic,
        color: editedColor,
      };

      const { error } = await supabase
        .from("habits")
        .update(updates)
        .eq("id", habit.id);

      if (error) {
        Alert.alert("Error", "Failed to update habit. Please try again.");
        return;
      }

      // Update local state
      setHabit((prev) => (prev ? { ...prev, ...updates } : null));

      // Update global context state
      updateHabit(habit.id, updates);

      setIsEditingName(false);
    } catch (error) {
      Alert.alert("Error", "Failed to update habit. Please try again.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditingName(false);
    if (habit) {
      setEditedTitle(habit.title);
      setEditedColor(habit.color);
      setEditedIsPublic(habit.is_public);
    }
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

  const deleteHabit = () => {
    // 1. Navigate back immediately
    navigation.goBack();

    // 2. Trigger deletion in context (optimistic update + background delete)
    deleteHabitFromContext(habitId);
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
          onPress={() => {
            if (isEditingName) {
              handleCancelEdit();
            } else {
              navigation.goBack();
            }
          }}
        >
          <Ionicons
            name={isEditingName ? "close" : "arrow-back"}
            size={24}
            color="#333"
          />
        </TouchableOpacity>

        {isEditingName ? (
          <TextInput
            style={[styles.navHeaderTitle, styles.headerInput]}
            value={editedTitle}
            onChangeText={setEditedTitle}
            autoFocus={false}
            placeholder="Habit Name"
            maxLength={50}
            onSubmitEditing={handleSaveChanges}
            returnKeyType="done"
          />
        ) : (
          <Text style={styles.navHeaderTitle} numberOfLines={1}>
            {habit.title}
          </Text>
        )}

        <TouchableOpacity
          style={styles.backButton}
          onPress={handleEditPress}
          disabled={isUpdating}
        >
          {isUpdating ? (
            <ActivityIndicator size="small" color="#333" />
          ) : (
            <Ionicons
              name={isEditingName ? "checkmark" : "pencil"}
              size={24}
              color="#333"
            />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView>
        {habit.description ? (
          <View style={[styles.header, { backgroundColor: "#fff" }]}>
            <Text style={styles.habitDescription}>{habit.description}</Text>
          </View>
        ) : null}

        <View style={styles.statsContainer}>
          <Text style={styles.sectionTitle}>Statistics</Text>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.current_streak}</Text>
              <Text style={styles.statLabel}>Current{"\n"}Streak</Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.total_completions}</Text>
              <Text style={styles.statLabel}>Total{"\n"}Completions</Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.longest_streak}</Text>
              <Text style={styles.statLabel}>Longest{"\n"}Streak</Text>
            </View>
          </View>
        </View>

        <View style={styles.calendarContainer}>
          <Text style={styles.sectionTitle}>Calendar</Text>
          <HabitCalendar
            habitId={habit.id}
            habitTitle={habit.title}
            habitColor={isEditingName ? editedColor : habit.color}
            completions={completions}
            onCompletionPress={handleCompletionPress}
            onDayPress={handleDayPress}
            hideHeader={true}
            showMonthNavigation={true}
            compact={true}
            isEditing={isEditingName}
            createdAt={habit.created_at}
          />
        </View>

        <View style={styles.infoContainer}>
          <Text style={styles.sectionTitle}>Details</Text>

          <View
            style={[
              styles.infoRow,
              isEditingName && {
                flexDirection: "column",
                alignItems: "flex-start",
                gap: 12,
              },
            ]}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                width: "100%",
              }}
            >
              <Ionicons name="color-palette-outline" size={20} color="#666" />
              <Text style={styles.infoLabel}>Color</Text>
              {!isEditingName && (
                <View style={styles.colorPreview}>
                  {/* Deep Depth Layer */}
                  <LinearGradient
                    colors={["#ffffff", "#e8e8e8"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[StyleSheet.absoluteFill, { borderRadius: 12 }]}
                  />

                  {/* Strong Color Gradient */}
                  <LinearGradient
                    colors={[
                      hexToRgba(habit.color, 0.08),
                      hexToRgba(habit.color, 0.25),
                    ]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[StyleSheet.absoluteFill, { borderRadius: 12 }]}
                  />

                  {/* Texture/Noise Simulation */}
                  <View
                    style={[
                      StyleSheet.absoluteFill,
                      {
                        opacity: 0.03,
                        backgroundColor: "#000",
                        borderRadius: 12,
                      },
                    ]}
                  />

                  {/* Top Highlight */}
                  <LinearGradient
                    colors={["rgba(255,255,255,0.95)", "rgba(255,255,255,0.0)"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0.8, y: 0.6 }}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      height: "60%",
                      borderRadius: 12,
                      opacity: 0.6,
                    }}
                  />

                  {/* Bottom-Right Shadow/Rim */}
                  <LinearGradient
                    colors={["transparent", hexToRgba(habit.color, 0.2)]}
                    start={{ x: 0.5, y: 0.5 }}
                    end={{ x: 1, y: 1 }}
                    style={[
                      StyleSheet.absoluteFill,
                      { borderRadius: 12, opacity: 0.8 },
                    ]}
                  />
                </View>
              )}
            </View>

            {isEditingName && (
              <View style={styles.colorPickerContainer}>
                {HABIT_COLORS.map((color) => (
                  <TouchableOpacity
                    key={color}
                    style={[
                      styles.colorOption,
                      editedColor === color && styles.selectedColor,
                    ]}
                    onPress={() => setEditedColor(color)}
                  >
                    {/* Deep Depth Layer */}
                    <LinearGradient
                      colors={["#ffffff", "#e8e8e8"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={[StyleSheet.absoluteFill, { borderRadius: 18 }]}
                    />

                    {/* Strong Color Gradient */}
                    <LinearGradient
                      colors={[hexToRgba(color, 0.08), hexToRgba(color, 0.25)]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={[StyleSheet.absoluteFill, { borderRadius: 18 }]}
                    />

                    {/* Texture/Noise Simulation */}
                    <View
                      style={[
                        StyleSheet.absoluteFill,
                        {
                          opacity: 0.03,
                          backgroundColor: "#000",
                          borderRadius: 18,
                        },
                      ]}
                    />

                    {/* Top Highlight */}
                    <LinearGradient
                      colors={[
                        "rgba(255,255,255,0.95)",
                        "rgba(255,255,255,0.0)",
                      ]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 0.8, y: 0.6 }}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        height: "60%",
                        borderRadius: 18,
                        opacity: 0.6,
                      }}
                    />

                    {/* Bottom-Right Shadow/Rim */}
                    <LinearGradient
                      colors={["transparent", hexToRgba(color, 0.2)]}
                      start={{ x: 0.5, y: 0.5 }}
                      end={{ x: 1, y: 1 }}
                      style={[
                        StyleSheet.absoluteFill,
                        { borderRadius: 18, opacity: 0.8 },
                      ]}
                    />

                    {editedColor === color && (
                      <View style={styles.selectionBorder} />
                    )}

                    {editedColor === color && (
                      <Ionicons name="checkmark" size={20} color="#333" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

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

          <View style={styles.infoRow}>
            <Ionicons
              name={
                (isEditingName ? editedIsPublic : habit.is_public)
                  ? "globe-outline"
                  : "lock-closed-outline"
              }
              size={20}
              color="#666"
            />
            <Text style={styles.infoLabel}>Visibility</Text>
            {isEditingName ? (
              <View style={styles.privacyToggleContainer}>
                <TouchableOpacity onPress={() => setEditedIsPublic(true)}>
                  <Text
                    style={[
                      styles.privacyOption,
                      editedIsPublic
                        ? styles.privacyOptionActive
                        : styles.privacyOptionInactive,
                    ]}
                  >
                    Public
                  </Text>
                </TouchableOpacity>
                <Text style={styles.privacySeparator}> / </Text>
                <TouchableOpacity onPress={() => setEditedIsPublic(false)}>
                  <Text
                    style={[
                      styles.privacyOption,
                      !editedIsPublic
                        ? styles.privacyOptionActive
                        : styles.privacyOptionInactive,
                    ]}
                  >
                    Private
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={styles.infoValue}>
                {habit.is_public ? "Public" : "Private"}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.actionsContainer}>
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  navHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: "#fff",
  },
  navHeaderTitle: {
    fontSize: 24,
    fontWeight: "600",
    color: "#1a1a1a",
    flex: 1,
    textAlign: "center",
    marginHorizontal: 10,
    letterSpacing: -0.5,
  },
  headerInput: {
    borderBottomWidth: 1,
    borderBottomColor: "#007AFF",
    paddingVertical: 4,
  },
  backButton: {
    padding: 8,
  },
  header: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    paddingBottom: 10,
  },
  habitDescription: {
    fontSize: 16,
    color: "#666",
    lineHeight: 24,
    textAlign: "center",
  },
  statsContainer: {
    marginTop: 20,
    marginHorizontal: 24,
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 20,
    letterSpacing: -0.5,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 10,
  },
  statItem: {
    alignItems: "center",
    flex: 1,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: "#eee",
  },
  statValue: {
    fontSize: 24,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: "#666",
    fontWeight: "500",
    textAlign: "center",
  },
  infoContainer: {
    marginHorizontal: 24,
    marginBottom: 30,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  infoLabel: {
    flex: 1,
    fontSize: 16,
    color: "#333",
    marginLeft: 16,
    fontWeight: "500",
  },
  infoValue: {
    fontSize: 16,
    color: "#666",
    fontWeight: "500",
  },
  actionsContainer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    marginTop: 20,
  },
  deleteButton: {
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  deleteButtonText: {
    color: "#FF3B30",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  calendarContainer: {
    marginHorizontal: 24,
    marginBottom: 30,
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
  privacyToggleContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  privacyOption: {
    fontSize: 16,
    fontWeight: "600",
  },
  privacyOptionActive: {
    color: "#007AFF",
    fontWeight: "bold",
  },
  privacyOptionInactive: {
    color: "#ccc",
    fontWeight: "normal",
  },
  privacySeparator: {
    fontSize: 16,
    color: "#ccc",
    marginHorizontal: 4,
  },
  colorPickerContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 10,
    maxWidth: 270,
    alignSelf: "center",
    justifyContent: "center",
  },
  colorOption: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  selectedColor: {
    // Removed scale transform to prevent jagged edges
  },
  selectionBorder: {
    position: "absolute",
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#1a1a1a",
    backgroundColor: "transparent",
    borderCurve: "continuous",
  },
  colorPreview: {
    width: 24,
    height: 24,
    borderRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
    backgroundColor: "#fff",
  },
});

export default HabitDetailScreen;
