import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { HabitCompletion } from "../types";

interface HabitCalendarProps {
  habitId: string;
  habitTitle: string;
  habitColor: string;
  completions: HabitCompletion[];
  onCompletionPress?: (completion: HabitCompletion) => void;
  onDayPress?: (date: Date, habitId: string) => void;
  compact?: boolean;
  hideHeader?: boolean;
  showMonthNavigation?: boolean;
}

const HabitCalendar: React.FC<HabitCalendarProps> = ({
  habitId,
  habitTitle,
  habitColor,
  completions,
  onCompletionPress,
  onDayPress,
  compact = false,
  hideHeader = false,
  showMonthNavigation = true,
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarGridWidth, setCalendarGridWidth] = useState(0);

  const daySize = calendarGridWidth > 0 ? Math.floor(calendarGridWidth / 7) : 0;

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const getCompletionForDate = (day: number) => {
    const dateStr = `${currentDate.getFullYear()}-${String(
      currentDate.getMonth() + 1
    ).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    return completions.find((completion) => {
      const completionDate = new Date(completion.completed_at);
      const completionDateStr = `${completionDate.getFullYear()}-${String(
        completionDate.getMonth() + 1
      ).padStart(2, "0")}-${String(completionDate.getDate()).padStart(2, "0")}`;
      return completionDateStr === dateStr;
    });
  };

  const navigateMonth = (direction: "prev" | "next") => {
    const newDate = new Date(currentDate);
    if (direction === "prev") {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCurrentDate(newDate);
  };

  const handleDayPress = (day: number) => {
    if (onDayPress) {
      const selectedDate = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        day
      );
      onDayPress(selectedDate, habitId);
    }
  };

  const renderCalendarHeader = () => {
    if (!showMonthNavigation) {
      return null;
    }

    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];

    return (
      <View style={styles.calendarHeader}>
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => navigateMonth("prev")}
        >
          <Ionicons name="chevron-back" size={20} color="#666" />
        </TouchableOpacity>

        <Text style={styles.monthText}>
          {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
        </Text>

        <TouchableOpacity
          style={styles.navButton}
          onPress={() => navigateMonth("next")}
        >
          <Ionicons name="chevron-forward" size={20} color="#666" />
        </TouchableOpacity>
      </View>
    );
  };

  const renderDayHeaders = () => {
    const dayHeaders = ["S", "M", "T", "W", "T", "F", "S"];

    return (
      <View style={styles.dayHeadersRow}>
        {dayHeaders.map((day, index) => (
          <View key={index} style={[styles.dayHeader, { width: daySize }]}>
            <Text style={styles.dayHeaderText}>{day}</Text>
          </View>
        ))}
      </View>
    );
  };

  const renderCalendarDays = () => {
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);
    const days = [];

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      days.push(
        <View
          key={`empty-${i}`}
          style={[styles.dayCell, { width: daySize, height: daySize }]}
        >
          <View style={styles.emptyDay} />
        </View>
      );
    }

    // Add cells for each day of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const completion = getCompletionForDate(day);

      days.push(
        <View
          key={day}
          style={[styles.dayCell, { width: daySize, height: daySize }]}
        >
          {completion && completion.image_url ? (
            <TouchableOpacity
              style={styles.dayWithImage}
              onPress={() => onCompletionPress?.(completion)}
              activeOpacity={0.8}
            >
              {completion.front_image_url ? (
                // Dual camera layout
                <View style={styles.dualImageContainer}>
                  <Image
                    source={{ uri: completion.image_url }}
                    style={styles.dayImageBack}
                  />
                  <Image
                    source={{ uri: completion.front_image_url }}
                    style={styles.dayImageFront}
                  />
                </View>
              ) : (
                // Single camera layout
                <Image
                  source={{ uri: completion.image_url }}
                  style={styles.dayImage}
                />
              )}
              <Text style={styles.dayNumber}>{day}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.emptyDay}
              onPress={() => handleDayPress(day)}
              activeOpacity={0.7}
            >
              <Text style={styles.dayNumberEmpty}>{day}</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    }

    return (
      <View
        style={styles.calendarGrid}
        onLayout={(e) => setCalendarGridWidth(e.nativeEvent.layout.width)}
      >
        {days}
      </View>
    );
  };

  return (
    <View style={[styles.container, compact && styles.compactContainer]}>
      {!hideHeader && (
        <View style={[styles.habitHeader, { backgroundColor: habitColor }]}>
          <Text style={styles.habitTitle}>{habitTitle}</Text>
        </View>
      )}

      <View
        style={[
          styles.calendarContainer,
          compact && styles.compactCalendarContainer,
        ]}
      >
        {renderCalendarHeader()}
        {renderDayHeaders()}
        {renderCalendarDays()}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 20,
    overflow: "hidden",
  },
  habitHeader: {
    padding: 16,
    alignItems: "center",
  },
  habitTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  calendarContainer: {
    padding: 16,
  },
  calendarHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  navButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: "#f0f0f0",
  },
  monthText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  dayHeadersRow: {
    flexDirection: "row",
    marginBottom: 8,
  },
  dayHeader: {
    alignItems: "center",
    paddingVertical: 8,
  },
  dayHeaderText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayCell: {
    padding: 2,
  },
  dayWithImage: {
    flex: 1,
    borderRadius: 6,
    overflow: "hidden",
    position: "relative",
  },
  dayImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  dualImageContainer: {
    width: "100%",
    height: "100%",
    position: "relative",
  },
  dayImageBack: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  dayImageFront: {
    position: "absolute",
    top: 2,
    right: 2,
    width: "30%",
    height: "30%",
    resizeMode: "cover",
    borderRadius: 2,
    borderWidth: 0.5,
    borderColor: "#fff",
  },
  dualIndicator: {
    position: "absolute",
    top: 1,
    left: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    borderRadius: 4,
    padding: 1,
  },
  dayNumber: {
    position: "absolute",
    bottom: 2,
    right: 2,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    color: "#fff",
    fontSize: 8,
    fontWeight: "bold",
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderRadius: 2,
    minWidth: 12,
    textAlign: "center",
  },
  emptyDay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 6,
    backgroundColor: "#f8f9fa",
  },
  dayNumberEmpty: {
    fontSize: 12,
    color: "#666",
    fontWeight: "500",
  },
  compactContainer: {
    marginBottom: 0,
    borderRadius: 8,
  },
  compactCalendarContainer: {
    padding: 0,
  },
});

export default HabitCalendar;
