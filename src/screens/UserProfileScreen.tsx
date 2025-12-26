import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Image,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRoute, useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RouteProp } from "@react-navigation/native";
import { supabase } from "../services/supabase";
import { User, Habit, HabitStats, HabitCompletion } from "../types";
import { RootStackParamList } from "../types";
import DaySlideshow from "../components/DaySlideshow";
import DayDetailModal from "../components/DayDetailModal";
import { useAuth } from "../contexts/AuthContext";
import { CachedImage } from "../components/CachedImage";

type UserProfileScreenRouteProp = RouteProp<RootStackParamList, "UserProfile">;
type UserProfileScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  "UserProfile"
>;

interface HabitWithStats extends Habit {
  stats: HabitStats;
  completions: HabitCompletion[];
}

const UserProfileScreen: React.FC = () => {
  const route = useRoute<UserProfileScreenRouteProp>();
  const navigation = useNavigation<UserProfileScreenNavigationProp>();
  const { userId } = route.params;

  const [user, setUser] = useState<User | null>(null);
  const [habits, setHabits] = useState<HabitWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [friendshipStatus, setFriendshipStatus] = useState<
    "none" | "pending" | "friends" | "sent"
  >("none");
  const [sendingRequest, setSendingRequest] = useState(false);
  const [dateList, setDateList] = useState<string[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedCompletions, setSelectedCompletions] = useState<
    HabitCompletion[]
  >([]);
  const [completionsMap, setCompletionsMap] = useState<
    Record<string, HabitCompletion[]>
  >({});
  const { user: currentUser } = useAuth();

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
    fetchUserProfile();
    if (currentUser && currentUser.id !== userId) {
      checkFriendshipStatus();
    }
  }, [userId, currentUser]);

  const fetchUserProfile = async () => {
    try {
      // Fetch user details
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("*")
        .eq("id", userId)
        .single();

      if (userError) throw userError;
      setUser(userData);

      // Fetch user's public habits
      const { data: habitsData, error: habitsError } = await supabase
        .from("habits")
        .select("*")
        .eq("user_id", userId)
        .eq("is_public", true)
        .order("created_at", { ascending: false });

      if (habitsError) throw habitsError;

      // Fetch completions for each habit
      const habitsWithStats = await Promise.all(
        (habitsData || []).map(async (habit) => {
          const stats = await fetchHabitStats(habit.id);
          const { data: completions } = await supabase
            .from("habit_completions")
            .select("*")
            .eq("habit_id", habit.id)
            .order("completed_at", { ascending: false });

          return {
            ...habit,
            stats,
            completions: completions || [],
          };
        })
      );

      setHabits(habitsWithStats);
    } catch (error) {
      console.error("Error fetching user profile:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const checkFriendshipStatus = async () => {
    if (!currentUser) return;

    try {
      // Check if they are already friends
      const { data: friendship } = await supabase
        .from("friendships")
        .select("*")
        .or(
          `and(user1_id.eq.${currentUser.id},user2_id.eq.${userId}),and(user1_id.eq.${userId},user2_id.eq.${currentUser.id})`
        )
        .single();

      if (friendship) {
        setFriendshipStatus("friends");
        return;
      }

      // Check for pending friend requests
      const { data: sentRequest } = await supabase
        .from("friend_requests")
        .select("*")
        .eq("sender_id", currentUser.id)
        .eq("receiver_id", userId)
        .eq("status", "pending")
        .single();

      if (sentRequest) {
        setFriendshipStatus("sent");
        return;
      }

      const { data: receivedRequest } = await supabase
        .from("friend_requests")
        .select("*")
        .eq("sender_id", userId)
        .eq("receiver_id", currentUser.id)
        .eq("status", "pending")
        .single();

      if (receivedRequest) {
        setFriendshipStatus("pending");
        return;
      }

      setFriendshipStatus("none");
    } catch (error) {
      console.error("Error checking friendship status:", error);
    }
  };

  const sendFriendRequest = async () => {
    if (!currentUser || sendingRequest) return;

    setSendingRequest(true);
    try {
      // Delete any existing friend request from current user to target user
      await supabase
        .from("friend_requests")
        .delete()
        .eq("sender_id", currentUser.id)
        .eq("receiver_id", userId);

      // Create the new friend request
      const { error } = await supabase.from("friend_requests").insert({
        sender_id: currentUser.id,
        receiver_id: userId,
        status: "pending",
      });

      if (error) throw error;

      setFriendshipStatus("sent");
    } catch (err) {
      console.error("Error sending friend request:", err);
    } finally {
      setSendingRequest(false);
    }
  };

  const removeFriend = async () => {
    if (!currentUser) return;

    try {
      // Delete the friendship
      const { error: friendshipError } = await supabase
        .from("friendships")
        .delete()
        .or(
          `and(user1_id.eq.${currentUser.id},user2_id.eq.${userId}),and(user1_id.eq.${userId},user2_id.eq.${currentUser.id})`
        );

      if (friendshipError) throw friendshipError;

      // Delete any existing friend requests between these users
      const { error: requestError } = await supabase
        .from("friend_requests")
        .delete()
        .or(
          `and(sender_id.eq.${currentUser.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${currentUser.id})`
        );

      if (requestError) throw requestError;

      setFriendshipStatus("none");
    } catch (err) {
      console.error("Error removing friend:", err);
    }
  };

  const renderFriendButton = () => {
    if (!currentUser || currentUser.id === userId) return null;

    switch (friendshipStatus) {
      case "friends":
        return (
          <View style={styles.friendButtonContainer}>
            <TouchableOpacity
              style={[styles.friendButton, styles.messageButton]}
              onPress={() =>
                navigation.navigate("Messaging", {
                  friendId: userId,
                  friendName: user?.username || "User",
                })
              }
            >
              <Ionicons name="chatbubble" size={16} color="#fff" />
              <Text style={styles.friendButtonText}>Message</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.friendButton, styles.removeFriendButton]}
              onPress={removeFriend}
            >
              <Ionicons name="person-remove" size={16} color="#ff4444" />
              <Text style={[styles.friendButtonText, { color: "#ff4444" }]}>
                Remove
              </Text>
            </TouchableOpacity>
          </View>
        );
      case "sent":
        return (
          <TouchableOpacity
            style={[styles.friendButton, styles.sentButton]}
            disabled
          >
            <Ionicons name="checkmark" size={16} color="#666" />
            <Text style={[styles.friendButtonText, { color: "#666" }]}>
              Request Sent
            </Text>
          </TouchableOpacity>
        );
      case "pending":
        return (
          <TouchableOpacity
            style={[styles.friendButton, styles.pendingButton]}
            onPress={() => navigation.navigate("Notifications")}
          >
            <Ionicons name="notifications" size={16} color="#007AFF" />
            <Text style={[styles.friendButtonText, { color: "#007AFF" }]}>
              Respond to Request
            </Text>
          </TouchableOpacity>
        );
      default:
        return (
          <TouchableOpacity
            style={[styles.friendButton, styles.addFriendButton]}
            onPress={sendFriendRequest}
            disabled={sendingRequest}
          >
            <Ionicons name="person-add" size={16} color="#fff" />
            <Text style={styles.friendButtonText}>
              {sendingRequest ? "Sending..." : "Add Friend"}
            </Text>
          </TouchableOpacity>
        );
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
        const mostRecentDate = new Date(completions[0].completed_at);
        mostRecentDate.setHours(0, 0, 0, 0);

        const daysSinceLastCompletion = Math.floor(
          (today.getTime() - mostRecentDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysSinceLastCompletion <= 1) {
          let expectedDate = new Date(mostRecentDate);

          for (let i = 0; i < completions.length; i++) {
            const completionDate = new Date(completions[i].completed_at);
            completionDate.setHours(0, 0, 0, 0);

            if (completionDate.getTime() === expectedDate.getTime()) {
              currentStreak++;
              expectedDate.setDate(expectedDate.getDate() - 1);
            } else {
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
        completion_rate: 0,
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

  const onRefresh = () => {
    setRefreshing(true);
    generateDates();
    fetchUserProfile();
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

  const CELL_WIDTH = Dimensions.get("window").width / 7;

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

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <Text>Loading profile...</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.centerContainer}>
        <Text>User not found</Text>
      </View>
    );
  }

  const renderHeader = () => {
    if (!user) return null;
    return (
      <>
        <View style={styles.profileSection}>
          {user.avatar_url ? (
            <CachedImage
              source={{ uri: user.avatar_url }}
              style={styles.avatar}
            />
          ) : (
            <View style={styles.avatar}>
              <Ionicons name="person" size={40} color="#666" />
            </View>
          )}
          <Text style={styles.username}>{user.username}</Text>
          <Text style={styles.memberSince}>
            Member since {new Date(user.created_at).toLocaleDateString()}
          </Text>
          {renderFriendButton()}

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
      </>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="lock-closed-outline" size={48} color="#ccc" />
      <Text style={styles.emptyTitle}>No Public Habits</Text>
      <Text style={styles.emptySubtitle}>
        This user hasn't shared any habits publicly yet.
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={styles.placeholder} />
      </View>

      <FlatList
        data={dateList}
        renderItem={renderDayCell}
        keyExtractor={(item) => item}
        numColumns={7}
        key={7}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.listContainer}
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
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  placeholder: {
    width: 40,
  },
  profileSection: {
    backgroundColor: "#fff",
    alignItems: "center",
    paddingVertical: 30,
    marginBottom: 20,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  username: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  memberSince: {
    fontSize: 14,
    color: "#666",
    marginBottom: 16,
  },
  friendButtonContainer: {
    flexDirection: "row",
    gap: 12,
  },
  friendButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  addFriendButton: {
    backgroundColor: "#007AFF",
  },
  messageButton: {
    backgroundColor: "#34C759",
  },
  removeFriendButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#ff4444",
  },
  sentButton: {
    backgroundColor: "#f0f0f0",
  },
  pendingButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#007AFF",
  },
  friendButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
  habitsSection: {
    flex: 1,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 16,
    marginHorizontal: 20,
  },
  listContainer: {
    paddingBottom: 20,
  },
  habitCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    marginHorizontal: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  habitHeader: {
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
  habitTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  streakDisplay: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FF6B35",
  },
  habitDescription: {
    fontSize: 14,
    color: "#666",
  },
  calendarContainer: {
    marginTop: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    paddingHorizontal: 40,
  },
  calendarHeaderRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    paddingBottom: 8,
    marginBottom: 0,
  },
  headerCell: {
    justifyContent: "center",
    alignItems: "center",
  },
  headerCellText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#999",
  },
  dayCell: {
    borderWidth: 0.5,
    borderColor: "#eee",
    justifyContent: "center",
    alignItems: "center",
    padding: 4,
    overflow: "hidden",
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
    color: "rgba(51, 51, 51, 0.3)",
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

export default UserProfileScreen;
