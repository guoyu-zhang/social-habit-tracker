import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { useAuth } from "../contexts/AuthContext";
import { useCollapsibleHeader } from "../hooks/useCollapsibleHeader";
import { RootStackParamList } from "../types";

type ProfileScreenNavigationProp = StackNavigationProp<RootStackParamList>;

const HEADER_HEIGHT = 120;

const ProfileScreen: React.FC = () => {
  const { user } = useAuth();
  const navigation = useNavigation<ProfileScreenNavigationProp>();
  const { scrollY, translateY, handleScroll } =
    useCollapsibleHeader(HEADER_HEIGHT);

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

      <Animated.ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingTop: HEADER_HEIGHT }}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        <View style={styles.profileSection}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={40} color="#666" />
          </View>
          <Text style={styles.username}>{user?.username}</Text>
          <Text style={styles.email}>{user?.email}</Text>
        </View>
      </Animated.ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
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
    paddingVertical: 32,
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
    marginBottom: 4,
  },
  email: {
    fontSize: 16,
    color: "#666",
  },
});

export default ProfileScreen;
