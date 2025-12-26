import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Image,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { supabase } from "../services/supabase";
import { FeedItem, RootStackParamList } from "../types";
import { useAuth } from "../contexts/AuthContext";
import { useCollapsibleHeader } from "../hooks/useCollapsibleHeader";
import EncourageButton from "../components/EncourageButton";
import { CachedImage } from "../components/CachedImage";

type FeedScreenNavigationProp = StackNavigationProp<RootStackParamList>;

const PAGE_SIZE = 10;
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

const formatTimeAgo = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return "Just now";
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours}h ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays}d ago`;
  }

  return date.toLocaleDateString();
};

const FeedScreen: React.FC = () => {
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const { user } = useAuth();
  const navigation = useNavigation<FeedScreenNavigationProp>();
  const { scrollY, translateY, handleScroll } =
    useCollapsibleHeader(HEADER_HEIGHT);

  // Initial load
  useFocusEffect(
    useCallback(() => {
      if (user) {
        // Only refresh if the list is empty or we explicitly want to (e.g. user revisited tab)
        // For now, let's just refresh to keep it simple, but we can optimize later
        fetchFeed(0, true);
      }
    }, [user])
  );

  const fetchFeed = async (pageNumber: number, shouldRefresh = false) => {
    try {
      if (!user) return;

      if (pageNumber === 0) {
        setHasMore(true);
      }

      const { data, error } = await supabase
        .from("habit_completions")
        .select(
          `
          *,
          habits!inner(id, title, color, is_public),
          users!inner(id, username, avatar_url)
        `
        )
        .not("image_url", "is", null)
        .neq("user_id", user.id)
        .eq("habits.is_public", true)
        .order("completed_at", { ascending: false })
        .range(pageNumber * PAGE_SIZE, (pageNumber + 1) * PAGE_SIZE - 1);

      if (error) throw error;

      const formattedFeed: FeedItem[] = (data || []).map((completion) => ({
        id: completion.id,
        user: {
          id: completion.users.id,
          username: completion.users.username,
          avatar_url: completion.users.avatar_url,
        },
        habit: {
          id: completion.habits.id,
          title: completion.habits.title,
          color: completion.habits.color,
        },
        completion,
        created_at: completion.completed_at,
      }));

      if (shouldRefresh || pageNumber === 0) {
        setFeedItems(formattedFeed);
      } else {
        setFeedItems((prev) => [...prev, ...formattedFeed]);
      }

      setHasMore(formattedFeed.length === PAGE_SIZE);
      setPage(pageNumber);
    } catch (error) {
      console.error("Error fetching feed:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchFeed(0, true);
  };

  const loadMore = () => {
    if (!loadingMore && hasMore && !loading) {
      setLoadingMore(true);
      fetchFeed(page + 1);
    }
  };

  const handleUserPress = (userId: string) => {
    navigation.navigate("UserProfile", { userId });
  };

  const renderFeedItem = ({ item }: { item: FeedItem }) => (
    <View style={styles.feedCard}>
      <View style={styles.feedHeader}>
        <TouchableOpacity
          style={styles.userInfo}
          onPress={() => handleUserPress(item.user.id)}
          activeOpacity={0.7}
        >
          <TouchableOpacity
            style={[
              styles.avatar,
              item.user.avatar_url ? { backgroundColor: "transparent" } : {},
            ]}
            onPress={() => handleUserPress(item.user.id)}
            activeOpacity={0.7}
          >
            {item.user.avatar_url ? (
              <Image
                source={{ uri: item.user.avatar_url }}
                style={{ width: 40, height: 40, borderRadius: 20 }}
              />
            ) : (
              <Ionicons name="person" size={20} color="#666" />
            )}
          </TouchableOpacity>
          <View>
            <Text style={styles.username}>{item.user.username}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuButton}>
          <Ionicons name="ellipsis-vertical" size={20} color="#666" />
        </TouchableOpacity>
      </View>

      {item.completion.image_url && (
        <View style={styles.imageContainer}>
          {item.completion.front_image_url ? (
            // Dual camera layout - overlaid like calendar thumbnail
            <View style={styles.dualImageContainer}>
              <CachedImage
                source={{ uri: item.completion.image_url }}
                style={styles.feedImage}
              />
              <CachedImage
                source={{ uri: item.completion.front_image_url }}
                style={styles.frontImageOverlay}
              />
            </View>
          ) : (
            // Single camera layout
            <CachedImage
              source={{ uri: item.completion.image_url }}
              style={styles.feedImage}
            />
          )}
        </View>
      )}

      {item.completion.notes && (
        <Text style={styles.notes}>{item.completion.notes}</Text>
      )}

      <View style={styles.feedFooter}>
        <View style={styles.footerLeftContent}>
          <View
            style={[
              styles.habitBadge,
              {
                backgroundColor: "#fff",
                borderColor: "rgba(255,255,255,0.6)",
                borderWidth: 1,
                shadowColor: hexToRgba(item.habit.color, 0.3),
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
                elevation: 2,
                overflow: "hidden",
                alignSelf: "flex-start",
                marginBottom: 8,
              },
            ]}
          >
            {/* Deep Depth Layer */}
            <LinearGradient
              colors={["#ffffff", "#e8e8e8"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />

            {/* Strong Color Gradient */}
            <LinearGradient
              colors={[
                hexToRgba(item.habit.color, 0.08),
                hexToRgba(item.habit.color, 0.25),
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />

            {/* Texture/Noise Simulation */}
            <View
              style={[
                StyleSheet.absoluteFill,
                {
                  opacity: 0.03,
                  backgroundColor: "#000",
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
                opacity: 0.6,
              }}
            />

            {/* Bottom-Right Shadow/Rim */}
            <LinearGradient
              colors={["transparent", hexToRgba(item.habit.color, 0.2)]}
              start={{ x: 0.5, y: 0.5 }}
              end={{ x: 1, y: 1 }}
              style={[StyleSheet.absoluteFill, { opacity: 0.8 }]}
            />

            <Text style={[styles.habitTitle, { color: "#333333" }]}>
              {item.habit.title}
            </Text>
          </View>
          <Text style={styles.timestamp}>{formatTimeAgo(item.created_at)}</Text>
        </View>
        <EncourageButton onPress={() => console.log("Encouraged!")} />
      </View>
    </View>
  );

  const renderFooter = () => {
    if (loadingMore) {
      return (
        <View style={{ padding: 20 }}>
          <ActivityIndicator size="small" color="#666" />
        </View>
      );
    }

    if (!hasMore && feedItems.length > 0) {
      return (
        <View style={styles.footerContainer}>
          <Ionicons name="checkmark-circle-outline" size={24} color="#ccc" />
          <Text style={styles.footerText}>You're all caught up</Text>
        </View>
      );
    }

    return null;
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <Text>Loading feed...</Text>
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
        <Text style={styles.headerTitle}>HabitSnap</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => navigation.navigate("Notifications")}
          >
            <Ionicons name="notifications-outline" size={24} color="#333" />
          </TouchableOpacity>
        </View>
      </Animated.View>

      {feedItems.length === 0 ? (
        <View style={[styles.emptyContainer, { paddingTop: HEADER_HEIGHT }]}>
          <Ionicons name="people-outline" size={64} color="#ccc" />
          <Text style={styles.emptyTitle}>No Activity Yet</Text>
          <Text style={styles.emptySubtitle}>
            Complete some habits to see activity in the feed!
          </Text>
        </View>
      ) : (
        <Animated.FlatList
          data={feedItems}
          renderItem={renderFeedItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContainer,
            { paddingTop: HEADER_HEIGHT },
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
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
        />
      )}
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: "#fff",
  },
  headerButtons: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerButton: {
    padding: 8,
    marginLeft: 8,
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: "bold",
    color: "#333",
  },
  listContainer: {
    paddingBottom: 20,
  },
  feedCard: {
    backgroundColor: "#fff",
    marginBottom: 0,
  },
  feedHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  username: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  habitBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  habitTitle: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  menuButton: {
    padding: 8,
    marginRight: -8,
  },
  feedImage: {
    width: "100%",
    aspectRatio: 4 / 5,
    resizeMode: "cover",
  },
  imageContainer: {
    width: "100%",
  },
  dualImageContainer: {
    position: "relative",
    width: "100%",
    aspectRatio: 4 / 5,
  },
  frontImageOverlay: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 120,
    height: 150,
    resizeMode: "cover",
    borderRadius: 12,
    borderWidth: 3,
    borderColor: "#fff",
  },
  dualIndicator: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    borderRadius: 8,
    padding: 4,
  },
  notes: {
    padding: 16,
    fontSize: 14,
    color: "#333",
    lineHeight: 20,
  },
  feedFooter: {
    flexDirection: "row",
    paddingLeft: 16,
    paddingRight: 8,
    paddingBottom: 16,
    justifyContent: "space-between",
    alignItems: "flex-end", // Align encourage button to bottom
    marginTop: 12,
  },
  footerLeftContent: {
    justifyContent: "center",
  },
  timestamp: {
    fontSize: 12,
    color: "#666",
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
  footerContainer: {
    padding: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  footerText: {
    marginTop: 8,
    color: "#999",
    fontSize: 14,
    fontWeight: "500",
  },
});

export default FeedScreen;
