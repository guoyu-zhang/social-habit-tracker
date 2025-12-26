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
import { LinearGradient } from "expo-linear-gradient";
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

const hexToRgba = (hex: string, opacity: number) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(
        result[3],
        16
      )}, ${opacity})`
    : `rgba(0, 0, 0, ${opacity})`;
};

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

    const cardBackgroundColor = hexToRgba(item.color, 0.15); // Increased opacity for richer color
    const borderColor = hexToRgba(item.color, 0.2);
    const shadowColor = hexToRgba(item.color, 0.3);

    return (
      <View
        style={[
          styles.habitCard,
          {
            backgroundColor: "#fff",
            borderColor: "rgba(255,255,255,0.6)",
            borderWidth: 1,
            shadowColor: shadowColor,
          },
        ]}
      >
        {/* Deep Depth Layer - Darker bottom-right corner for volume */}
        <LinearGradient
          colors={["#ffffff", "#e8e8e8"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: 24 }]}
        />

        {/* Strong Color Gradient - Diagonal sweep for dynamic look */}
        <LinearGradient
          colors={[
            hexToRgba(item.color, 0.08), // Lighter top-left
            hexToRgba(item.color, 0.25), // Stronger bottom-right
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: 24 }]}
        />

        {/* Texture/Noise Simulation (Subtle grain pattern using repeated views) */}
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              opacity: 0.03,
              backgroundColor: "#000",
              borderRadius: 24,
            },
          ]}
        />

        {/* Top Highlight - Simulates light source from top-left */}
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
            borderRadius: 24,
            opacity: 0.6,
          }}
        />

        {/* Bottom-Right Shadow/Rim - Adds 3D pop */}
        <LinearGradient
          colors={["transparent", hexToRgba(item.color, 0.2)]}
          start={{ x: 0.5, y: 0.5 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: 24, opacity: 0.8 }]}
        />

        {/* Top Edge Highlight - Sharp polished rim */}
        {/* <View
          style={{
            position: "absolute",
            top: 1,
            left: 12,
            right: 12,
            height: 1,
            backgroundColor: "rgba(255,255,255,0.8)",
            opacity: 0.9,
          }}
        /> */}

        <TouchableOpacity
          style={[
            styles.habitHeader,
            !item.description && { alignItems: "center" },
          ]}
          onPress={() =>
            navigation.navigate("HabitDetail", {
              habitId: item.id,
              initialData: item,
            })
          }
          activeOpacity={0.9}
        >
          <View
            style={[
              styles.habitInfo,
              !item.description && { justifyContent: "center" },
            ]}
          >
            <View
              style={[
                styles.titleRow,
                !item.description && { marginBottom: 0 },
              ]}
            >
              <Text
                style={[
                  styles.habitTitle,
                  !item.description && styles.habitTitleLarge,
                ]}
              >
                {item.title}
              </Text>
            </View>
            {item.description && (
              <Text style={styles.habitDescription}>{item.description}</Text>
            )}
          </View>
          <View style={styles.habitActions}>
            {item.stats?.current_streak > 0 && (
              <View
                style={[
                  styles.streakBadge,
                  {
                    backgroundColor: hexToRgba(item.color, 0.1),
                    height: 32, // Match checkCircle height
                    justifyContent: "center",
                  },
                ]}
              >
                <Text style={[styles.streakDisplay, { color: item.color }]}>
                  {item.stats.current_streak} 🔥
                </Text>
              </View>
            )}
            <TouchableOpacity
              style={[
                styles.completeButton,
                isOptimisticallyCompleted && styles.completedButton,
              ]}
              onPress={() => handleCompleteHabit(item)}
              disabled={isOptimisticallyCompleted}
            >
              {isUploading ? (
                <ActivityIndicator size="small" color={item.color} />
              ) : (
                <View
                  style={[
                    styles.checkCircle,
                    {
                      borderColor: isOptimisticallyCompleted
                        ? item.color
                        : "#D1D1D6",
                      backgroundColor: isOptimisticallyCompleted
                        ? item.color
                        : "transparent",
                    },
                  ]}
                >
                  {isOptimisticallyCompleted && (
                    <Ionicons name="checkmark" size={20} color="#fff" />
                  )}
                </View>
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
    paddingTop: 10,
  },
  habitCard: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  habitHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  habitInfo: {
    flex: 1,
    marginRight: 12,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 6,
  },
  streakDisplay: {
    fontSize: 13,
    fontWeight: "600",
  },
  streakBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  habitActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  privacyButton: {
    padding: 8,
  },
  habitTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#1C1C1E", // Soft black
    letterSpacing: -0.5,
  },
  habitTitleLarge: {
    fontSize: 24,
    fontWeight: "600",
    color: "#1C1C1E",
    letterSpacing: -0.5,
    lineHeight: 32,
  },
  habitDescription: {
    fontSize: 15,
    color: "#8E8E93", // Standard iOS subtitle gray
    lineHeight: 20,
  },
  completeButton: {
    padding: 4,
  },
  completedButton: {
    opacity: 1, // Keep full opacity for the filled state
  },
  checkCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
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
    marginTop: 0,
  },
});

export default HabitsScreen;
