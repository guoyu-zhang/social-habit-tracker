import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Animated,
  Image,
  ActivityIndicator,
  FlatList,
  Dimensions,
  RefreshControl,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";

import { useAuth } from "../contexts/AuthContext";
import { useCollapsibleHeader } from "../hooks/useCollapsibleHeader";
import {
  RootStackParamList,
  Habit,
  HabitStats,
  HabitCompletion,
} from "../types";
import { supabase, BUCKETS } from "../services/supabase";
import DaySlideshow from "../components/DaySlideshow";
import DayDetailModal from "../components/DayDetailModal";
import { CachedImage } from "../components/CachedImage";

type ProfileScreenNavigationProp = StackNavigationProp<RootStackParamList>;

const HEADER_HEIGHT = 120;
const CELL_WIDTH = Dimensions.get("window").width / 7;

interface HabitWithStats extends Habit {
  stats: HabitStats;
  completions: HabitCompletion[];
}

const hexToRgba = (hex: string, opacity: number) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(
        result[3],
        16
      )}, ${opacity})`
    : `rgba(0, 0, 0, ${opacity})`;
};

const ProfileScreen: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const navigation = useNavigation<ProfileScreenNavigationProp>();
  const { scrollY, translateY, handleScroll } =
    useCollapsibleHeader(HEADER_HEIGHT);
  const [uploading, setUploading] = useState(false);
  const [habits, setHabits] = useState<HabitWithStats[]>([]);
  const [loadingHabits, setLoadingHabits] = useState(true);
  const [dateList, setDateList] = useState<string[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedCompletions, setSelectedCompletions] = useState<
    HabitCompletion[]
  >([]);
  const [completionsMap, setCompletionsMap] = useState<
    Record<string, HabitCompletion[]>
  >({});
  const [refreshing, setRefreshing] = useState(false);

  const toLocalDateString = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const stats = useMemo(() => {
    if (!user?.created_at) return null;

    const allCompletions = habits.flatMap((h) => h.completions);
    const uniqueDates = new Set(
      allCompletions.map((c) => toLocalDateString(new Date(c.completed_at)))
    );
    const daysActive = uniqueDates.size;

    const sortedDates = Array.from(uniqueDates).sort();
    let maxStreak = 0;
    let currentStreak = 0;
    let lastDateStr = "";

    sortedDates.forEach((dateStr) => {
      if (lastDateStr) {
        const curr = new Date(dateStr);
        const prev = new Date(lastDateStr);
        const diffTime = Math.abs(curr.getTime() - prev.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
          currentStreak++;
        } else {
          currentStreak = 1;
        }
      } else {
        currentStreak = 1;
      }
      if (currentStreak > maxStreak) maxStreak = currentStreak;
      lastDateStr = dateStr;
    });

    const joinDate = new Date(user.created_at);
    const now = new Date();
    const totalDays = Math.max(
      1,
      Math.floor((now.getTime() - joinDate.getTime()) / (1000 * 60 * 60 * 24)) +
        1
    );
    const percentage = Math.round((daysActive / totalDays) * 100);

    return {
      daysActive,
      longestStreak: maxStreak,
      habitCount: habits.length,
      percentage,
    };
  }, [habits, user]);

  useEffect(() => {
    fetchHabits();
  }, [user]);

  const generateDates = () => {
    if (user?.created_at) {
      const dates: string[] = [];
      const now = new Date();
      now.setHours(0, 0, 0, 0);

      const joinDate = new Date(user.created_at);
      joinDate.setHours(0, 0, 0, 0);

      let currentDate = new Date(now);

      // Generate dates from today backwards to join date
      while (currentDate >= joinDate) {
        dates.push(toLocalDateString(currentDate));
        currentDate.setDate(currentDate.getDate() - 1);
      }
      setDateList(dates);
    }
  };

  useEffect(() => {
    generateDates();
  }, [user?.created_at]);

  useEffect(() => {
    const map: Record<string, HabitCompletion[]> = {};
    habits.forEach((habit) => {
      habit.completions.forEach((completion) => {
        const dateStr = toLocalDateString(new Date(completion.completed_at));
        if (!map[dateStr]) {
          map[dateStr] = [];
        }
        map[dateStr].push(completion);
      });
    });
    setCompletionsMap(map);
  }, [habits]);

  const fetchHabits = async () => {
    if (!user) return;
    try {
      // Fetch user's habits
      const { data: habitsData, error: habitsError } = await supabase
        .from("habits")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (habitsError) throw habitsError;

      // Fetch completions for each habit
      const habitsWithStats = await Promise.all(
        (habitsData || []).map(async (habit) => {
          const { data: completions } = await supabase
            .from("habit_completions")
            .select("*")
            .eq("habit_id", habit.id)
            .order("completed_at", { ascending: false });

          return {
            ...habit,
            stats: {
              habit_id: habit.id,
              current_streak: 0,
              longest_streak: 0,
              total_completions: completions?.length || 0,
              completion_rate: 0,
              last_completed: completions?.[0]?.completed_at || null,
            }, // Minimal stats needed for now
            completions: completions || [],
          };
        })
      );

      setHabits(habitsWithStats);
    } catch (error) {
      console.error("Error fetching habits:", error);
    } finally {
      setLoadingHabits(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    generateDates();
    refreshUser();
    fetchHabits();
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      });

      if (!result.canceled && result.assets[0].uri) {
        await uploadAvatar(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to pick image");
    }
  };

  const base64ToUint8Array = (base64: string): Uint8Array => {
    const binaryString = globalThis.atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  };

  const uploadAvatar = async (uri: string) => {
    if (!user) return;

    try {
      setUploading(true);

      // Resize image if needed (optional but good for performance)
      const manipulatedImage = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 300, height: 300 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );

      const base64 = await FileSystem.readAsStringAsync(manipulatedImage.uri, {
        encoding: "base64",
      });
      const arrayBuffer = base64ToUint8Array(base64);

      const fileName = `${user.id}/${Date.now()}.jpg`;
      const filePath = `${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from(BUCKETS.AVATARS)
        .upload(filePath, arrayBuffer, {
          contentType: "image/jpeg",
          upsert: true,
        });

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from(BUCKETS.AVATARS).getPublicUrl(filePath);

      // Update user profile
      const { error: updateError } = await supabase
        .from("users")
        .update({ avatar_url: publicUrl })
        .eq("id", user.id);

      if (updateError) {
        throw updateError;
      }

      await refreshUser();
      Alert.alert("Success", "Profile picture updated!");
    } catch (error: any) {
      console.error("Error uploading avatar:", error);
      Alert.alert("Error", error.message || "Failed to upload profile picture");
    } finally {
      setUploading(false);
    }
  };

  const getCompletionsForDate = (dateStr: string) => {
    return completionsMap[dateStr] || [];
  };

  const getImagesForDate = (dateStr: string) => {
    return getCompletionsForDate(dateStr)
      .map((c) => c.image_url!)
      .filter(Boolean);
  };

  const handleDayPress = (dateStr: string) => {
    const completions = getCompletionsForDate(dateStr);
    if (completions.length > 0) {
      setSelectedCompletions(completions);
      setModalVisible(true);
    }
  };

  const handleCloseModal = () => {
    setModalVisible(false);
    setSelectedCompletions([]);
  };

  const renderDayCell = ({ item: dateStr }: { item: string }) => {
    const images = getImagesForDate(dateStr);
    // Parse date manually to ensure local time is used
    const [year, month, day] = dateStr.split("-").map(Number);
    const dayNumber = day;

    // Check if date is in the future
    const todayStr = toLocalDateString(new Date());
    const isFuture = dateStr > todayStr;

    return (
      <TouchableOpacity
        style={[
          styles.dayCell,
          { width: CELL_WIDTH, height: CELL_WIDTH * 1.2 },
        ]}
        onPress={() => handleDayPress(dateStr)}
        activeOpacity={0.8}
        disabled={isFuture || images.length === 0}
      >
        {!isFuture && (
          <>
            {images.length > 0 ? (
              <View style={StyleSheet.absoluteFill}>
                <DaySlideshow
                  imageUrls={images}
                  interval={3000}
                  compact={true}
                />
                <View style={styles.cellOverlay} />
              </View>
            ) : (
              <View style={styles.emptyCellBackground} />
            )}
            <Text
              style={[
                styles.dayNumber,
                images.length > 0 && styles.dayNumberLight,
                day === 1 && { fontWeight: "bold" },
              ]}
            >
              {day === 1
                ? [
                    "Jan",
                    "Feb",
                    "Mar",
                    "Apr",
                    "May",
                    "Jun",
                    "Jul",
                    "Aug",
                    "Sep",
                    "Oct",
                    "Nov",
                    "Dec",
                  ][month - 1]
                : dayNumber}
            </Text>
          </>
        )}
      </TouchableOpacity>
    );
  };

  const renderProfileHeader = () => (
    <View style={styles.profileSection}>
      <TouchableOpacity
        style={styles.avatarContainer}
        onPress={pickImage}
        disabled={uploading}
      >
        {user?.avatar_url ? (
          <CachedImage
            source={{ uri: user.avatar_url }}
            style={styles.avatar}
          />
        ) : (
          <View style={[styles.avatar, styles.placeholderAvatar]}>
            <Ionicons name="person" size={40} color="#666" />
          </View>
        )}
        <View style={styles.editBadge}>
          <Ionicons name="camera" size={16} color="#fff" />
        </View>
        {uploading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="small" color="#fff" />
          </View>
        )}
      </TouchableOpacity>
      <Text style={styles.username}>{user?.username || "User"}</Text>

      {/* Habit Tags */}
      {habits.length > 0 && (
        <View style={styles.habitTagsContainer}>
          {habits.map((habit) => {
            const cardBackgroundColor = hexToRgba(habit.color, 0.15);
            const borderColor = hexToRgba(habit.color, 0.2);
            const shadowColor = hexToRgba(habit.color, 0.3);

            return (
              <View
                key={habit.id}
                style={[
                  styles.habitTag,
                  {
                    backgroundColor: "#fff",
                    borderColor: "rgba(255,255,255,0.6)",
                    borderWidth: 1,
                    shadowColor: shadowColor,
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.1,
                    shadowRadius: 4,
                    elevation: 2,
                  },
                ]}
              >
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

                <Text style={[styles.habitTagText, { color: "#333333" }]}>
                  {habit.title}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {stats && (
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.daysActive}</Text>
            <Text style={styles.statLabel}>Days Active</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.longestStreak}</Text>
            <Text style={styles.statLabel}>Longest Streak</Text>
          </View>

          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.percentage}%</Text>
            <Text style={styles.statLabel}>Consistency</Text>
          </View>
        </View>
      )}
    </View>
  );

  const renderFooter = () => {
    if (!user) return null;
    return (
      <View style={styles.footer}>
        <Ionicons
          name="calendar-outline"
          size={20}
          color="#666"
          style={styles.footerIcon}
        />
        <Text style={styles.footerText}>
          Joined on {new Date(user.created_at).toLocaleDateString()}
        </Text>
      </View>
    );
  };

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
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate("Settings")}
          style={styles.settingsButton}
        >
          <Ionicons name="settings-outline" size={24} color="#333" />
        </TouchableOpacity>
      </Animated.View>

      <Animated.FlatList
        data={dateList}
        renderItem={renderDayCell}
        keyExtractor={(item) => item}
        numColumns={7}
        key={7}
        ListHeaderComponent={renderProfileHeader}
        ListFooterComponent={renderFooter}
        contentContainerStyle={{ paddingTop: HEADER_HEIGHT, paddingBottom: 20 }}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      />

      <DayDetailModal
        visible={modalVisible}
        completions={selectedCompletions}
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
  scrollView: {
    flex: 1,
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
  settingsButton: {
    padding: 8,
    marginRight: -8,
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: "bold",
    color: "#333",
  },
  profileSection: {
    backgroundColor: "#fff",
    alignItems: "center",
    paddingTop: 32,
    paddingBottom: 50,
    marginBottom: 0,
  },
  avatarContainer: {
    position: "relative",
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#f0f0f0",
  },
  placeholderAvatar: {
    justifyContent: "center",
    alignItems: "center",
  },
  editBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#333",
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 50,
  },
  username: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 4,
  },
  habitTagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 20,
  },
  habitTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    overflow: "hidden",
  },
  habitTagText: {
    fontSize: 14,
    fontWeight: "600",
  },

  dayCell: {
    borderWidth: 0.5,
    borderColor: "#eee",
    justifyContent: "center",
    alignItems: "center",
    padding: 4,
    overflow: "hidden",
    borderRadius: 3,
  },
  emptyCellBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#f8f9fa",
  },
  cellOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.1)",
  },
  dayNumber: {
    fontSize: 16,
    fontWeight: "600",
    color: "#999999",
    zIndex: 2,
  },
  dayNumberLight: {
    color: "rgba(255, 255, 255, 0.9)",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  footer: {
    padding: 30,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    opacity: 0.7,
  },
  footerIcon: {
    marginRight: 8,
  },
  footerText: {
    fontSize: 14,
    color: "#666",
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 24,
    width: "100%",
    paddingHorizontal: 20,
  },
  statItem: {
    alignItems: "center",
    paddingHorizontal: 12,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: "#666",
    fontWeight: "500",
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: "#eee",
  },
});

export default ProfileScreen;
