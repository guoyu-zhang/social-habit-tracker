import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  Alert,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../services/supabase";
import { useAuth } from "../contexts/AuthContext";
import { FriendRequest, Notification } from "../types";
import { RootStackParamList } from "../types";

type NotificationsScreenNavigationProp =
  StackNavigationProp<RootStackParamList>;

interface FriendRequestWithSender extends FriendRequest {
  sender: {
    id: string;
    username: string;
    avatar_url?: string;
  };
}

interface NotificationItem {
  id: string;
  type: "friend_request" | "friend_accepted" | "message";
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  data?: any;
  friendRequest?: FriendRequestWithSender;
}

const NotificationsScreen: React.FC = () => {
  const navigation = useNavigation<NotificationsScreenNavigationProp>();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;

    try {
      // Fetch notifications
      const { data: notificationsData, error: notificationsError } =
        await supabase
          .from("notifications")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

      if (notificationsError) throw notificationsError;

      // Fetch pending friend requests
      const { data: friendRequests, error: friendRequestsError } =
        await supabase
          .from("friend_requests")
          .select("*")
          .eq("receiver_id", user.id)
          .eq("status", "pending")
          .order("created_at", { ascending: false });

      // Fetch sender details separately
      let friendRequestsWithSenders = [];
      if (friendRequests && friendRequests.length > 0) {
        const senderIds = friendRequests.map((req) => req.sender_id);
        const { data: senders } = await supabase
          .from("users")
          .select("id, username, avatar_url")
          .in("id", senderIds);

        friendRequestsWithSenders = friendRequests.map((request) => ({
          ...request,
          sender: senders?.find(
            (sender) => sender.id === request.sender_id
          ) || { username: "Unknown User" },
        }));
      }

      if (friendRequestsError) throw friendRequestsError;

      // Combine notifications and friend requests
      const combinedNotifications: NotificationItem[] = [
        ...(notificationsData || []).map((notification) => ({
          ...notification,
          friendRequest: undefined,
        })),
        ...friendRequestsWithSenders.map((request) => ({
          id: `friend_request_${request.id}`,
          type: "friend_request" as const,
          title: "Friend Request",
          message: `${
            request.sender?.username || "Someone"
          } wants to be your friend`,
          read: false,
          created_at: request.created_at,
          data: { request_id: request.id, sender_id: request.sender_id },
          friendRequest: {
            ...request,
            sender: request.sender || {
              id: request.sender_id,
              username: "Unknown User",
              avatar_url: undefined,
            },
          },
        })),
      ];

      // Sort by created_at
      combinedNotifications.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setNotifications(combinedNotifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      Alert.alert("Error", "Failed to load notifications");
    } finally {
      setRefreshing(false);
    }
  }, [user]);

  const handleFriendRequest = async (
    requestId: string,
    action: "accept" | "decline"
  ) => {
    try {
      const { error } = await supabase
        .from("friend_requests")
        .update({ status: action === "accept" ? "accepted" : "declined" })
        .eq("id", requestId);

      if (error) throw error;

      // Remove the friend request notification from the list
      setNotifications((prev) =>
        prev.filter(
          (notification) =>
            !(
              notification.type === "friend_request" &&
              notification.data?.request_id === requestId
            )
        )
      );

      Alert.alert(
        "Success",
        action === "accept"
          ? "Friend request accepted!"
          : "Friend request declined"
      );
    } catch (error) {
      console.error("Error handling friend request:", error);
      Alert.alert("Error", "Failed to process friend request");
    }
  };

  const markAsRead = async (notificationId: string) => {
    if (!notificationId.startsWith("friend_request_")) {
      try {
        await supabase
          .from("notifications")
          .update({ read: true })
          .eq("id", notificationId);

        setNotifications((prev) =>
          prev.map((notification) =>
            notification.id === notificationId
              ? { ...notification, read: true }
              : notification
          )
        );
      } catch (error) {
        console.error("Error marking notification as read:", error);
      }
    }
  };

  const handleNotificationPress = (notification: NotificationItem) => {
    markAsRead(notification.id);

    switch (notification.type) {
      case "friend_request":
        // Already handled in the notification item itself
        break;
      case "friend_accepted":
        if (notification.data?.friend_id) {
          navigation.navigate("UserProfile", {
            userId: notification.data.friend_id,
          });
        }
        break;
      case "message":
        if (notification.data?.sender_id) {
          // Navigate to messaging screen - we'd need to get the sender's username first
          navigation.navigate("UserProfile", {
            userId: notification.data.sender_id,
          });
        }
        break;
    }
  };

  const clearAllNotifications = async () => {
    Alert.alert(
      "Clear All Notifications",
      "Are you sure you want to clear all notifications?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear All",
          style: "destructive",
          onPress: async () => {
            try {
              await supabase
                .from("notifications")
                .delete()
                .eq("user_id", user?.id);

              setNotifications((prev) =>
                prev.filter(
                  (notification) => notification.type === "friend_request"
                )
              );

              Alert.alert("Success", "All notifications cleared");
            } catch (error) {
              console.error("Error clearing notifications:", error);
              Alert.alert("Error", "Failed to clear notifications");
            }
          },
        },
      ]
    );
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = (now.getTime() - date.getTime()) / (1000 * 60);

    if (diffInMinutes < 1) {
      return "Just now";
    } else if (diffInMinutes < 60) {
      return `${Math.floor(diffInMinutes)}m ago`;
    } else if (diffInMinutes < 1440) {
      return `${Math.floor(diffInMinutes / 60)}h ago`;
    } else {
      return `${Math.floor(diffInMinutes / 1440)}d ago`;
    }
  };

  const renderNotification = ({ item }: { item: NotificationItem }) => {
    const isUnread = !item.read;

    return (
      <TouchableOpacity
        style={[styles.notificationItem, isUnread && styles.unreadNotification]}
        onPress={() => handleNotificationPress(item)}
      >
        <View style={styles.notificationContent}>
          <View style={styles.notificationHeader}>
            <View style={styles.notificationInfo}>
              <Text style={styles.notificationTitle}>{item.title}</Text>
              <Text style={styles.notificationTime}>
                {formatTime(item.created_at)}
              </Text>
            </View>
            {isUnread && <View style={styles.unreadDot} />}
          </View>

          <Text style={styles.notificationMessage}>{item.message}</Text>

          {item.type === "friend_request" && item.friendRequest && (
            <View style={styles.friendRequestActions}>
              <View style={styles.senderInfo}>
                <Image
                  source={{
                    uri:
                      item.friendRequest.sender.avatar_url ||
                      "https://via.placeholder.com/40",
                  }}
                  style={styles.senderAvatar}
                />
                <Text style={styles.senderName}>
                  {item.friendRequest.sender.username}
                </Text>
              </View>

              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.acceptButton]}
                  onPress={() =>
                    handleFriendRequest(item.friendRequest!.id, "accept")
                  }
                >
                  <Text style={styles.acceptButtonText}>Accept</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton, styles.declineButton]}
                  onPress={() =>
                    handleFriendRequest(item.friendRequest!.id, "decline")
                  }
                >
                  <Text style={styles.declineButtonText}>Decline</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        {notifications.length > 0 ? (
          <TouchableOpacity onPress={clearAllNotifications}>
            <Text style={styles.clearAllText}>Clear</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.placeholder} />
        )}
      </View>

      {notifications.length > 0 ? (
        <FlatList
          data={notifications}
          renderItem={renderNotification}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="notifications-outline" size={64} color="#8E8E93" />
          <Text style={styles.emptyText}>No notifications yet</Text>
          <Text style={styles.emptySubtext}>
            You'll see friend requests and other updates here
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e1e5e9",
    backgroundColor: "#fff",
  },
  backButton: {
    padding: 8,
  },
  placeholder: {
    width: 40,
  },
  headerTitle: {
    color: "#333",
    fontSize: 20,
    fontWeight: "bold",
  },
  clearAllText: {
    color: "#007AFF",
    fontSize: 16,
  },
  notificationItem: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  unreadNotification: {
    backgroundColor: "#f0f8ff",
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  notificationInfo: {
    flex: 1,
  },
  notificationTitle: {
    color: "#333",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 2,
  },
  notificationTime: {
    color: "#666",
    fontSize: 12,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#007AFF",
    marginLeft: 8,
  },
  notificationMessage: {
    color: "#555",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  friendRequestActions: {
    marginTop: 8,
  },
  senderInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  senderAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  senderName: {
    color: "#333",
    fontSize: 16,
    fontWeight: "500",
  },
  actionButtons: {
    flexDirection: "row",
    gap: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  acceptButton: {
    backgroundColor: "#007AFF",
  },
  declineButton: {
    backgroundColor: "#f0f0f0",
  },
  acceptButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  declineButtonText: {
    color: "#333",
    fontSize: 14,
    fontWeight: "600",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  emptyText: {
    color: "#333",
    fontSize: 18,
    fontWeight: "600",
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    color: "#666",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
});

export default NotificationsScreen;
