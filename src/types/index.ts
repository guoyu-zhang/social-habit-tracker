export interface User {
  id: string;
  email: string;
  username: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Habit {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  color: string;
  icon?: string;
  frequency: "daily" | "weekly" | "monthly";
  is_public: boolean;
  start_time?: string; // Format: "HH:MM"
  duration?: number; // Duration in minutes
  created_at: string;
  updated_at: string;
}

export interface HabitCompletion {
  id: string;
  habit_id: string;
  user_id: string;
  completed_at: string;
  image_url?: string;
  front_image_url?: string;
  notes?: string;
  created_at: string;
}

export interface HabitImage {
  id: string;
  habit_completion_id: string;
  image_url: string;
  thumbnail_url: string;
  created_at: string;
}

export interface HabitStats {
  habit_id: string;
  current_streak: number;
  longest_streak: number;
  total_completions: number;
  completion_rate: number;
  last_completed: string | null;
}

export interface FeedItem {
  id: string;
  user: Pick<User, "id" | "username">;
  habit: Pick<Habit, "id" | "title" | "color">;
  completion: HabitCompletion;
  created_at: string;
}

export interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
}

export type MainTabParamList = {
  Habits: undefined;
  Feed: undefined;
  Profile: undefined;
};

export interface FriendRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: "pending" | "accepted" | "declined";
  created_at: string;
  updated_at: string;
  sender?: Pick<User, "id" | "username" | "avatar_url">;
  receiver?: Pick<User, "id" | "username" | "avatar_url">;
}

export interface Friendship {
  id: string;
  user1_id: string;
  user2_id: string;
  created_at: string;
  friend?: Pick<User, "id" | "username" | "avatar_url">;
}

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  read: boolean;
  created_at: string;
  sender?: Pick<User, "id" | "username" | "avatar_url">;
}

export interface Notification {
  id: string;
  user_id: string;
  type: "friend_request" | "friend_accepted" | "message";
  title: string;
  message: string;
  read: boolean;
  data?: any;
  created_at: string;
}

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  Login: undefined;
  Register: undefined;
  CreateHabit: undefined;
  HabitDetail: { habitId: string };
  Camera: { habitId: string; selectedDate?: string };
  DualCamera: { habitId: string; selectedDate?: string };
  Profile: undefined;
  UserProfile: { userId: string };
  Notifications: undefined;
  Messaging: { friendId: string; friendName: string };
};
