import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Dimensions,
  Pressable,
  ScrollView,
} from "react-native";
import { HabitCompletion } from "../types";
import { CachedImage } from "./CachedImage";
import { Ionicons } from "@expo/vector-icons";

const { width, height } = Dimensions.get("window");

interface DayDetailModalProps {
  visible: boolean;
  completions: HabitCompletion[];
  onClose: () => void;
}

const DayDetailModal: React.FC<DayDetailModalProps> = ({
  visible,
  completions,
  onClose,
}) => {
  const [activeIndex, setActiveIndex] = useState(0);

  if (!completions || completions.length === 0) return null;

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);

    // Time
    let hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? "pm" : "am";
    hours = hours % 12;
    hours = hours ? hours : 12;
    const strTime = `${hours}:${minutes.toString().padStart(2, "0")}${ampm}`;

    // Date
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const day = date.getDate().toString().padStart(2, "0");
    const year = date.getFullYear();
    const strDate = `${month}.${day}.${year}`;

    return `${strTime} ${strDate}`;
  };

  const handleScroll = (event: any) => {
    const slideSize = event.nativeEvent.layoutMeasurement.width;
    const index = event.nativeEvent.contentOffset.x / slideSize;
    const roundIndex = Math.round(index);
    setActiveIndex(roundIndex);
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.modalContainer}>
          <ScrollView
            horizontal
            pagingEnabled
            style={styles.scrollView}
            showsHorizontalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            contentContainerStyle={styles.scrollContent}
          >
            {completions.map((completion, index) => (
              <View key={completion.id} style={styles.pageContainer}>
                <View style={styles.modalContent}>
                  {/* Image(s) */}
                  <View style={styles.imageContainer}>
                    {completion.front_image_url ? (
                      // Dual camera layout
                      <View style={styles.dualImageLayout}>
                        <CachedImage
                          source={{ uri: completion.image_url! }}
                          style={styles.mainImage}
                          resizeMode="cover"
                        />
                        <CachedImage
                          source={{ uri: completion.front_image_url }}
                          style={styles.frontImageOverlay}
                          resizeMode="cover"
                        />
                      </View>
                    ) : (
                      // Single camera layout
                      <View style={styles.singleImageContainer}>
                        <CachedImage
                          source={{ uri: completion.image_url! }}
                          style={styles.singleImage}
                          resizeMode="cover"
                        />
                      </View>
                    )}
                  </View>

                  {/* Date and Time */}
                  <View style={styles.dateTimeContainer}>
                    <Text style={styles.dateText}>
                      {formatDateTime(completion.completed_at)}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>

          {/* Pagination Dots */}
          {completions.length > 1 && (
            <View style={styles.paginationContainer}>
              {completions.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.paginationDot,
                    index === activeIndex
                      ? styles.paginationDotActive
                      : styles.paginationDotInactive,
                  ]}
                />
              ))}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    width: width * 0.9,
    height: height * 0.7, // Fixed height to contain the scroll view
    backgroundColor: "transparent", // Container itself is transparent
    borderRadius: 20,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  scrollView: {
    width: "100%",
    height: "100%",
  },
  scrollContent: {
    alignItems: "center",
  },
  pageContainer: {
    width: width * 0.9,
    alignItems: "center",
    justifyContent: "center",
  },
  modalContent: {
    width: "100%",
    backgroundColor: "transparent",
    alignItems: "center",
  },
  dateTimeContainer: {
    paddingTop: 16,
    alignItems: "center",
    backgroundColor: "transparent",
  },
  dateText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 4,
    textShadowColor: "rgba(0, 0, 0, 0.3)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  timeText: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.8)",
    textShadowColor: "rgba(0, 0, 0, 0.3)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  imageContainer: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    borderRadius: 20,
    overflow: "hidden",
  },
  dualImageLayout: {
    position: "relative",
    alignItems: "center",
    width: "100%",
  },
  mainImage: {
    width: "100%",
    aspectRatio: 0.8,
    borderRadius: 0,
  },
  frontImageOverlay: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 120,
    height: 150,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: "#fff",
  },
  singleImageContainer: {
    alignItems: "center",
    width: "100%",
  },
  singleImage: {
    width: "100%",
    aspectRatio: 0.8,
    borderRadius: 0,
  },
  paginationContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 20,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  paginationDotActive: {
    backgroundColor: "#fff",
  },
  paginationDotInactive: {
    backgroundColor: "rgba(255, 255, 255, 0.5)",
  },
});

export default DayDetailModal;
