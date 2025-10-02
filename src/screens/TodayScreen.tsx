import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  TouchableOpacity,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "../services/supabase";
import { useAuth } from "../contexts/AuthContext";
import { Habit } from "../types";

const { height: screenHeight } = Dimensions.get("window");

const TodayScreen = () => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [scheduledHabits, setScheduledHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(timer);
  }, []);

  const fetchScheduledHabits = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("habits")
        .select("*")
        .eq("user_id", user.id)
        .not("start_time", "is", null);

      if (error) throw error;
      setScheduledHabits(data || []);
    } catch (error) {
      console.error("Error fetching scheduled habits:", error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      fetchScheduledHabits();
    }, [user])
  );

  const getCurrentTimePosition = () => {
    const now = currentTime;
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const totalMinutes = hours * 60 + minutes;

    // Each time slot is 70px (60px height + 10px margin)
    // Time text is centered vertically in the 60px slot, so offset by 30px
    const timeSlotHeight = 70;
    const timeTextCenterOffset = 30; // Half of the 60px slot height
    const minutesPerSlot = 60;

    // Calculate position to align with time text center
    const slotPosition =
      Math.floor(totalMinutes / minutesPerSlot) * timeSlotHeight;
    const minuteOffset =
      (totalMinutes % minutesPerSlot) * (timeSlotHeight / minutesPerSlot);

    return slotPosition + timeTextCenterOffset + minuteOffset;
  };

  const getHabitBlockPosition = (startTime: string, duration: number) => {
    const [hours, minutes] = startTime.split(":").map(Number);
    const startMinutes = hours * 60 + minutes;

    // Each time slot is 70px (60px height + 10px margin)
    // Time text is centered vertically in the 60px slot, so offset by 30px
    const timeSlotHeight = 70;
    const timeTextCenterOffset = 30; // Half of the 60px slot height
    const minutesPerSlot = 60;

    // Calculate position to align with time text center
    const slotPosition =
      Math.floor(startMinutes / minutesPerSlot) * timeSlotHeight;
    const minuteOffset =
      (startMinutes % minutesPerSlot) * (timeSlotHeight / minutesPerSlot);
    const topPosition = slotPosition + timeTextCenterOffset + minuteOffset;

    const heightPixels = Math.max(
      (duration / minutesPerSlot) * timeSlotHeight,
      40
    ); // Minimum 40px height

    return {
      top: topPosition,
      height: heightPixels,
    };
  };

  const renderHabitBlocks = () => {
    return scheduledHabits.map((habit) => {
      if (!habit.start_time || !habit.duration) return null;

      const position = getHabitBlockPosition(habit.start_time, habit.duration);

      return (
        <TouchableOpacity
          key={habit.id}
          style={[
            styles.habitBlock,
            {
              backgroundColor: habit.color,
              top: position.top,
              height: position.height,
            },
          ]}
          activeOpacity={0.8}
        >
          <Text style={styles.habitBlockTitle} numberOfLines={1}>
            {habit.title}
          </Text>
          <Text style={styles.habitBlockTime}>
            {habit.start_time} • {habit.duration}min
          </Text>
        </TouchableOpacity>
      );
    });
  };

  const formatTime = (hour: number) => {
    return `${hour.toString().padStart(2, "0")}:00`;
  };

  const renderTimeSlots = () => {
    const slots = [];
    for (let hour = 0; hour < 24; hour++) {
      slots.push(
        <View key={hour} style={styles.timeSlot}>
          <Text style={styles.timeText}>{formatTime(hour)}</Text>
          <View style={styles.timeLine} />
        </View>
      );
    }
    return slots;
  };

  const currentTimePosition = getCurrentTimePosition();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Today</Text>
        <Text style={styles.currentTimeText}>
          {currentTime.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.timeline}>
          {renderTimeSlots()}

          {/* Current time indicator */}
          <View
            style={[styles.currentTimeIndicator, { top: currentTimePosition }]}
          >
            <View style={styles.currentTimeDot} />
            <View style={styles.currentTimeLine} />
          </View>

          {/* Habit blocks */}
          {renderHabitBlocks()}
        </View>
      </ScrollView>
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
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e1e5e9",
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#333",
  },
  currentTimeText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#007AFF",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  timeline: {
    position: "relative",
    minHeight: screenHeight * 2, // Make it tall enough for smooth scrolling
  },
  timeSlot: {
    flexDirection: "row",
    alignItems: "center",
    height: 60,
    marginBottom: 10,
  },
  timeText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#666",
    width: 60,
    textAlign: "right",
    marginRight: 15,
  },
  timeLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#e1e5e9",
  },
  currentTimeIndicator: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    zIndex: 10,
  },
  currentTimeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#ff3b30",
    marginLeft: 54, // Align with time text
    marginRight: 3,
  },
  currentTimeLine: {
    flex: 1,
    height: 2,
    backgroundColor: "#ff3b30",
  },
  habitBlock: {
    position: "absolute",
    left: 75,
    right: 20,
    borderRadius: 8,
    padding: 8,
    justifyContent: "center",
    minHeight: 40,
  },
  habitBlockTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 2,
  },
  habitBlockTime: {
    fontSize: 12,
    color: "#fff",
    opacity: 0.9,
  },
});

export default TodayScreen;
