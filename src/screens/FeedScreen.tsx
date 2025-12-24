import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  Image,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Modal,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { supabase } from "../services/supabase";
import { FeedItem, RootStackParamList } from "../types";
import { useAuth } from "../contexts/AuthContext";
import { useCollapsibleHeader } from "../hooks/useCollapsibleHeader";

type FeedScreenNavigationProp = StackNavigationProp<RootStackParamList>;

const HEADER_HEIGHT = 120;

const FeedScreen: React.FC = () => {
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useAuth();
  const navigation = useNavigation<FeedScreenNavigationProp>();
  const { scrollY, translateY, handleScroll } =
    useCollapsibleHeader(HEADER_HEIGHT);

  // useEffect(() => {
  //   if (user) {
  //     fetchFeed();
  //   }
  // }, [user]);

  useFocusEffect(
    React.useCallback(() => {
      if (user) {
        fetchFeed();
      }
    }, [user])
  );

  const fetchFeed = async () => {
    try {
      if (!user) return;

      const { data, error } = await supabase
        .from("habit_completions")
        .select(
          `
          *,
          habits!inner(id, title, color, is_public),
          users!inner(id, username)
        `
        )
        .not("image_url", "is", null)
        .neq("user_id", user.id)
        .eq("habits.is_public", true)
        .order("completed_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      const formattedFeed: FeedItem[] = (data || []).map((completion) => ({
        id: completion.id,
        user: {
          id: completion.users.id,
          username: completion.users.username,
        },
        habit: {
          id: completion.habits.id,
          title: completion.habits.title,
          color: completion.habits.color,
        },
        completion,
        created_at: completion.completed_at,
      }));

      setFeedItems(formattedFeed);
    } catch (error) {
      console.error("Error fetching feed:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchFeed();
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
            style={styles.avatar}
            onPress={() => handleUserPress(item.user.id)}
            activeOpacity={0.7}
          >
            <Ionicons name="person" size={20} color="#666" />
          </TouchableOpacity>
          <View>
            <Text style={styles.username}>{item.user.username}</Text>
            <Text style={styles.timestamp}>
              {new Date(item.created_at).toLocaleDateString()}
            </Text>
          </View>
        </TouchableOpacity>
        <View
          style={[
            styles.habitBadge,
            {
              backgroundColor: "#fff",
              borderWidth: 1,
              borderColor: item.habit.color,
            },
          ]}
        >
          <Text style={[styles.habitTitle, { color: item.habit.color }]}>
            {item.habit.title}
          </Text>
        </View>
      </View>

      {item.completion.image_url && (
        <View style={styles.imageContainer}>
          {item.completion.front_image_url ? (
            // Dual camera layout - overlaid like calendar thumbnail
            <View style={styles.dualImageContainer}>
              <Image
                source={{ uri: item.completion.image_url }}
                style={styles.feedImage}
              />
              <Image
                source={{ uri: item.completion.front_image_url }}
                style={styles.frontImageOverlay}
              />
            </View>
          ) : (
            // Single camera layout
            <Image
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
        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="heart-outline" size={20} color="#666" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="chatbubble-outline" size={20} color="#666" />
        </TouchableOpacity>
      </View>
    </View>
  );

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
    padding: 16,
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
  timestamp: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
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
    top: 12,
    right: 12,
    width: 80,
    aspectRatio: 4 / 5,
    resizeMode: "cover",
    borderRadius: 8,
    borderWidth: 2,
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
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  actionButton: {
    marginRight: 16,
    padding: 8,
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

export default FeedScreen;
