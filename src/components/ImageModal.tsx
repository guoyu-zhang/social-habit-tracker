import React, { useState, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  Image,
  StyleSheet,
  Dimensions,
  Pressable,
  TouchableWithoutFeedback,
} from "react-native";
import { HabitCompletion } from "../types";
import { CachedImage } from "./CachedImage";

const { width, height } = Dimensions.get("window");

interface ImageModalProps {
  visible: boolean;
  completion: HabitCompletion | null;
  onClose: () => void;
  onDelete?: (completionId: string) => void;
}

const ImageModal: React.FC<ImageModalProps> = ({
  visible,
  completion,
  onClose,
}) => {
  if (!completion) return null;

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

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <TouchableWithoutFeedback>
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              {/* Image(s) */}
              <View style={styles.imageContainer}>
                {completion.front_image_url ? (
                  // Dual camera layout - overlaid like calendar thumbnail
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
        </TouchableWithoutFeedback>
      </Pressable>
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
    width: "100%",
    alignItems: "center",
  },
  modalContent: {
    width: "100%",
    backgroundColor: "transparent",
    alignItems: "center",
  },
  imageContainer: {
    width: width - 32,
    aspectRatio: 0.8, // 4:5 aspect ratio
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#000",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  dualImageLayout: {
    width: "100%",
    height: "100%",
    position: "relative",
  },
  mainImage: {
    width: "100%",
    height: "100%",
    borderRadius: 16,
  },
  frontImageOverlay: {
    position: "absolute",
    top: 16,
    right: 16,
    width: "30%",
    height: "30%",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.8)",
  },
  singleImageContainer: {
    width: "100%",
    height: "100%",
  },
  singleImage: {
    width: "100%",
    height: "100%",
    borderRadius: 16,
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
    color: "#fff",
    opacity: 0.8,
  },
});

export default ImageModal;
