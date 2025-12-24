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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
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
                      {formatDate(completion.completed_at)}
                    </Text>
                    <Text style={styles.timeText}>
                      {formatTime(completion.completed_at)}
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
    backgroundColor: "#fff",
    borderRadius: 20,
    overflow: "hidden",
  },
  dateTimeContainer: {
    padding: 20,
    paddingBottom: 20,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  dateText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  timeText: {
    fontSize: 14,
    color: "#666",
  },
  imageContainer: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000",
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
