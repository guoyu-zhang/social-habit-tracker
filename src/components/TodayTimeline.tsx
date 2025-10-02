import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  TouchableOpacity,
  DimensionValue,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../services/supabase";
import { useAuth } from "../contexts/AuthContext";
import { Habit } from "../types";

const { height: screenHeight, width: screenWidth } = Dimensions.get("window");

interface TodayTimelineProps {
  width?: DimensionValue;
}

const TodayTimeline: React.FC<TodayTimelineProps> = ({ width = "100%" }) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [scheduledHabits, setScheduledHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  // Calculate available height accounting for all UI elements
  const pageHeaderHeight = 80; // From HabitsScreen header style
  const bottomTabHeight = 60; // Typical bottom tab navigator height
  const availableHeight =
    screenHeight -
    insets.top -
    insets.bottom -
    pageHeaderHeight -
    bottomTabHeight;

  // Calculate dynamic heights based on available screen space
  const timeSlotHeight = availableHeight / 24; // Fit 24 hours exactly in available space
  const timeTextCenterOffset = timeSlotHeight / 2;

  // Create dynamic styles based on calculated dimensions
  const dynamicStyles = StyleSheet.create({
    timeline: {
      position: "relative",
      height: availableHeight,
      justifyContent: "space-between",
    },
    timeSlot: {
      flexDirection: "row",
      alignItems: "center",
      height: timeSlotHeight,
      marginBottom: 0,
    },
    habitBlock: {
      position: "absolute",
      left: 48,
      right: 10,
      borderRadius: 6,
      padding: 6,
      justifyContent: "center",
      minHeight: timeSlotHeight * 0.4,
    },
  });

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
    const minutesPerSlot = 60;

    // Calculate position to align with time text center
    const slotPosition =
      Math.floor(startMinutes / minutesPerSlot) * timeSlotHeight;
    const minuteOffset =
      (startMinutes % minutesPerSlot) * (timeSlotHeight / minutesPerSlot);
    const topPosition = slotPosition + timeTextCenterOffset + minuteOffset;

    const heightPixels = Math.max(
      (duration / minutesPerSlot) * timeSlotHeight,
      timeSlotHeight * 0.5
    ); // Minimum half slot height

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
            dynamicStyles.habitBlock,
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
        <View key={hour} style={dynamicStyles.timeSlot}>
          <Text style={styles.timeText}>{formatTime(hour)}</Text>
          <View style={styles.timeLine} />
        </View>
      );
    }
    return slots;
  };

  const currentTimePosition = getCurrentTimePosition();

  return (
    <View style={[styles.container, { width, height: screenHeight }]}>
      <View style={styles.timelineContainer}>
        <View style={dynamicStyles.timeline}>
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
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#f8f9fa",
    position: "absolute",
    top: 0,
    left: 0,
    zIndex: 1000,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e1e5e9",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
  },
  currentTimeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#007AFF",
  },
  timelineContainer: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },

  timeText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#666",
    width: 40,
    textAlign: "right",
    marginRight: 8,
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
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#ff3b30",
    marginLeft: 36, // Align with time text
    marginRight: 2,
  },
  currentTimeLine: {
    flex: 1,
    height: 2,
    backgroundColor: "#ff3b30",
  },

  habitBlockTitle: {
    fontSize: 10,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 1,
  },
  habitBlockTime: {
    fontSize: 8,
    color: "#fff",
    opacity: 0.9,
  },
});

export default TodayTimeline;
