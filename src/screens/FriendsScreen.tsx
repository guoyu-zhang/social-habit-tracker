import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Image,
  RefreshControl,
  Alert,
  Animated,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../services/supabase";
import { useAuth } from "../contexts/AuthContext";
import { Friendship, User } from "../types";
import { useCollapsibleHeader } from "../hooks/useCollapsibleHeader";

type UserSearchResult = Pick<User, "id" | "username" | "avatar_url">;
import { RootStackParamList } from "../types";

type FriendsScreenNavigationProp = StackNavigationProp<RootStackParamList>;

const HEADER_HEIGHT = 196;

interface FriendWithUser extends Friendship {
  friend: Pick<User, "id" | "username" | "avatar_url">;
}

const FriendsScreen: React.FC = () => {
  const navigation = useNavigation<FriendsScreenNavigationProp>();
  const { user } = useAuth();
  const [friends, setFriends] = useState<FriendWithUser[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [searching, setSearching] = useState(false);
  const { scrollY, translateY, handleScroll } =
    useCollapsibleHeader(HEADER_HEIGHT);

  const fetchFriends = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("friendships")
        .select("*")
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);

      if (error) throw error;

      // Fetch user details separately
      let friendsWithUser = [];
      if (data && data.length > 0) {
        const userIds = [
          ...new Set(data.flatMap((f) => [f.user1_id, f.user2_id])),
        ];
        const { data: users } = await supabase
          .from("users")
          .select("id, username, avatar_url")
          .in("id", userIds);

        friendsWithUser = data.map((friendship: any) => {
          const friendId =
            friendship.user1_id === user.id
              ? friendship.user2_id
              : friendship.user1_id;
          const friend = users?.find((u) => u.id === friendId) || {
            id: friendId,
            username: "Unknown User",
          };
          return {
            ...friendship,
            friend,
          };
        });
      }

      setFriends(friendsWithUser);
    } catch (error) {
      console.error("Error fetching friends:", error);
      Alert.alert("Error", "Failed to load friends");
    } finally {
      setRefreshing(false);
    }
  }, [user]);

  const searchUsers = useCallback(
    async (query: string) => {
      if (!query.trim() || !user) {
        setSearchResults([]);
        return;
      }

      setSearching(true);
      try {
        const { data, error } = await supabase
          .from("users")
          .select("id, username, avatar_url")
          .ilike("username", `%${query}%`)
          .neq("id", user.id)
          .limit(10);

        if (error) throw error;

        // Filter out users who are already friends
        const friendIds = friends.map((f) => f.friend.id);
        const filteredResults =
          data?.filter((u) => !friendIds.includes(u.id)) || [];

        setSearchResults(filteredResults);
      } catch (error) {
        console.error("Error searching users:", error);
      } finally {
        setSearching(false);
      }
    },
    [user, friends]
  );

  const sendFriendRequest = async (receiverId: string) => {
    if (!user) return;

    try {
      // Delete any existing friend request from current user to target user
      await supabase
        .from("friend_requests")
        .delete()
        .eq("sender_id", user.id)
        .eq("receiver_id", receiverId);

      // Create the new friend request
      const { error } = await supabase.from("friend_requests").insert({
        sender_id: user.id,
        receiver_id: receiverId,
        status: "pending",
      });

      if (error) throw error;

      Alert.alert("Success", "Friend request sent!");
      // Remove from search results
      setSearchResults((prev) => prev.filter((u) => u.id !== receiverId));
    } catch (err) {
      console.error("Error sending friend request:", err);
      Alert.alert("Error", "Failed to send friend request");
    }
  };

  const removeFriend = async (friendshipId: string) => {
    if (!user) return;

    try {
      // First get the friendship details to know the user IDs
      const { data: friendship, error: fetchError } = await supabase
        .from("friendships")
        .select("user1_id, user2_id")
        .eq("id", friendshipId)
        .single();

      if (fetchError) throw fetchError;

      // Delete the friendship
      const { error: friendshipError } = await supabase
        .from("friendships")
        .delete()
        .eq("id", friendshipId);

      if (friendshipError) throw friendshipError;

      // Delete any existing friend requests between these users
      const { error: requestError } = await supabase
        .from("friend_requests")
        .delete()
        .or(
          `and(sender_id.eq.${friendship.user1_id},receiver_id.eq.${friendship.user2_id}),and(sender_id.eq.${friendship.user2_id},receiver_id.eq.${friendship.user1_id})`
        );

      if (requestError) throw requestError;

      Alert.alert("Success", "Friend removed");
      fetchFriends();
    } catch (error) {
      console.error("Error removing friend:", error);
      Alert.alert("Error", "Failed to remove friend");
    }
  };

  const openChat = (friendId: string, friendName: string) => {
    navigation.navigate("Messaging", { friendId, friendName });
  };

  useEffect(() => {
    fetchFriends();
  }, [fetchFriends]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchUsers(searchQuery);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, searchUsers]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchFriends();
  }, [fetchFriends]);

  const renderFriend = ({ item }: { item: FriendWithUser }) => (
    <View style={styles.friendItem}>
      <View style={styles.friendInfo}>
        <Image
          source={{
            uri: item.friend.avatar_url || "https://via.placeholder.com/50",
          }}
          style={styles.avatar}
        />
        <Text style={styles.friendName}>{item.friend.username}</Text>
      </View>
      <View style={styles.friendActions}>
        <TouchableOpacity
          style={styles.messageButton}
          onPress={() => openChat(item.friend.id, item.friend.username)}
        >
          <Ionicons name="chatbubble-outline" size={24} color="#007AFF" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => removeFriend(item.id)}
        >
          <Ionicons name="person-remove-outline" size={24} color="#FF3B30" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderSearchResult = ({ item }: { item: UserSearchResult }) => (
    <View style={styles.searchResultItem}>
      <View style={styles.friendInfo}>
        <Image
          source={{
            uri: item.avatar_url || "https://via.placeholder.com/50",
          }}
          style={styles.avatar}
        />
        <Text style={styles.friendName}>{item.username}</Text>
      </View>
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => sendFriendRequest(item.id)}
      >
        <Ionicons name="person-add-outline" size={24} color="#34C759" />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <Animated.View
        style={{
          transform: [{ translateY }],
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          backgroundColor: "#fff",
        }}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Friends</Text>
        </View>
        <View style={styles.searchContainer}>
          <View style={styles.searchInputContainer}>
            <Ionicons
              name="search"
              size={20}
              color="#8E8E93"
              style={styles.searchIcon}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Search users..."
              placeholderTextColor="#8E8E93"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>
      </Animated.View>

      {searchQuery ? (
        <View style={[styles.searchSection, { paddingTop: HEADER_HEIGHT }]}>
          <Text style={styles.sectionTitle}>Search Results</Text>
          {searching ? (
            <Text style={styles.searchingText}>Searching...</Text>
          ) : (
            <Animated.FlatList
              data={searchResults}
              renderItem={renderSearchResult}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No users found</Text>
              }
              onScroll={handleScroll}
              scrollEventThrottle={16}
            />
          )}
        </View>
      ) : (
        <View style={styles.friendsSection}>
          <Animated.FlatList
            data={friends}
            renderItem={renderFriend}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              friends.length === 0 ? styles.emptyListContent : undefined,
              {
                paddingTop: HEADER_HEIGHT,
                paddingHorizontal: 16,
                paddingBottom: 16,
              },
            ]}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#fff"
                progressViewOffset={HEADER_HEIGHT}
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  No friends yet. Search for users to add as friends!
                </Text>
              </View>
            }
            onScroll={handleScroll}
            scrollEventThrottle={16}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  headerTitle: {
    fontSize: 34,
    fontWeight: "bold",
    color: "#333",
  },
  searchContainer: {
    padding: 16,
    borderBottomWidth: 0,
    backgroundColor: "#fff",
  },
  searchInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: "#e1e5e9",
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: "#333",
    fontSize: 16,
  },
  searchSection: {
    flex: 1,
    padding: 16,
    backgroundColor: "#fff",
  },
  friendsSection: {
    flex: 1,
    backgroundColor: "#fff",
  },
  sectionTitle: {
    color: "#333",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 16,
  },
  friendItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e1e5e9",
  },
  searchResultItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e1e5e9",
  },
  friendInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  friendName: {
    color: "#333",
    fontSize: 16,
    fontWeight: "500",
  },
  friendActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  messageButton: {
    padding: 8,
    marginRight: 8,
  },
  removeButton: {
    padding: 8,
  },
  addButton: {
    padding: 8,
  },
  emptyListContent: {
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    color: "#666",
    fontSize: 16,
    textAlign: "center",
  },
  searchingText: {
    color: "#666",
    fontSize: 16,
    textAlign: "center",
    marginTop: 16,
  },
});

export default FriendsScreen;
