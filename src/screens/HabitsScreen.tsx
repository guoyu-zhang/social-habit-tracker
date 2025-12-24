import React, { useState, useEffect, useRef } from "react";
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
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { useAuth } from "../contexts/AuthContext";
import { useUpload } from "../contexts/UploadContext";
import { useHabits, HabitWithStats } from "../contexts/HabitContext";
import { HabitCompletion } from "../types";
import { RootStackParamList } from "../types";
import HabitCalendar from "../components/HabitCalendar";
import ImageModal from "../components/ImageModal";
import { useCollapsibleHeader } from "../hooks/useCollapsibleHeader";
import AsyncStorage from "@react-native-async-storage/async-storage";

type HabitsScreenNavigationProp = StackNavigationProp<RootStackParamList>;

const HEADER_HEIGHT = 120;

const HabitsScreen: React.FC = () => {
  const { habits, loading, refreshing, fetchHabits, addHabitCompletion } =
    useHabits();
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedCompletion, setSelectedCompletion] =
    useState<HabitCompletion | null>(null);
  const { user } = useAuth();
  const { uploads } = useUpload();
  const navigation = useNavigation<HabitsScreenNavigationProp>();
  const { scrollY, translateY, handleScroll } =
    useCollapsibleHeader(HEADER_HEIGHT);

  const completedUploadsRef = useRef<Set<string>>(new Set());

  // Listen for upload completions to refresh data
  useEffect(() => {
    // Check for new completions
    Object.entries(uploads).forEach(([habitId, upload]) => {
      if (
        upload.status === "completed" &&
        !completedUploadsRef.current.has(habitId)
      ) {
        completedUploadsRef.current.add(habitId);

        // Instead of fetching all habits, we update the local state with the completed upload
        // We use the local URIs for immediate display
        if (user) {
          const newCompletion: HabitCompletion = {
            id: `temp-${Date.now()}`,
            habit_id: habitId,
            user_id: user.id,
            image_url: upload.backUri, // Use local URI
            front_image_url: upload.frontUri, // Use local URI
            completed_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
          };

          addHabitCompletion(habitId, newCompletion);
        }
      }
    });

    // Cleanup: Remove IDs that are no longer in uploads or not completed
    completedUploadsRef.current.forEach((habitId: string) => {
      if (!uploads[habitId] || uploads[habitId].status !== "completed") {
        completedUploadsRef.current.delete(habitId);
      }
    });
  }, [uploads, user, addHabitCompletion]);

  // Initial load
  useEffect(() => {
    if (user) {
      fetchHabits();
    }
  }, [user, fetchHabits]);

  const handleCompleteHabit = (habit: HabitWithStats) => {
    const upload = uploads[habit.id];
    const isOptimisticallyCompleted =
      habit.completedToday || (upload && upload.status !== "error");

    if (isOptimisticallyCompleted) {
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

  const renderHabitItem = ({ item }: { item: HabitWithStats }) => {
    const upload = uploads[item.id];
    const isUploading = upload?.status === "uploading";
    const isOptimisticallyCompleted =
      item.completedToday || (upload && upload.status !== "error");

    return (
      <View
        style={[
          styles.habitCard,
          { backgroundColor: "#fff", borderWidth: 1, borderColor: "#f0f0f0" },
        ]}
      >
        <TouchableOpacity
          style={styles.habitHeader}
          onPress={() =>
            navigation.navigate("HabitDetail", {
              habitId: item.id,
              initialData: item,
            })
          }
          activeOpacity={0.7}
        >
          <View style={styles.habitInfo}>
            <View style={styles.titleRow}>
              <Text style={styles.habitTitle}>{item.title}</Text>
              {item.stats?.current_streak > 0 && (
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
                isOptimisticallyCompleted && styles.completedButton,
              ]}
              onPress={() => handleCompleteHabit(item)}
              disabled={isOptimisticallyCompleted}
            >
              {isUploading ? (
                <ActivityIndicator size="small" color="#007AFF" />
              ) : (
                <Ionicons
                  name={
                    isOptimisticallyCompleted
                      ? "checkmark-circle"
                      : "checkmark-circle-outline"
                  }
                  size={32}
                  color={isOptimisticallyCompleted ? "#4CAF50" : "#007AFF"}
                />
              )}
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
            isUploading={isUploading}
            uploadProgress={upload ? upload.progress : 0}
            uploadingImages={
              upload
                ? { backUri: upload.backUri, frontUri: upload.frontUri }
                : undefined
            }
          />
        </View>
      </View>
    );
  };

  if (loading && habits.length === 0) {
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
