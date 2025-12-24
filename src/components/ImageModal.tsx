import React from "react";
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

const { width } = Dimensions.get("window");

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
                    <Image
                      source={{ uri: completion.image_url! }}
                      style={styles.mainImage}
                      resizeMode="cover"
                    />
                    <Image
                      source={{ uri: completion.front_image_url }}
                      style={styles.frontImageOverlay}
                      resizeMode="cover"
                    />
                  </View>
                ) : (
                  // Single camera layout
                  <View style={styles.singleImageContainer}>
                    <Image
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
    width: width * 0.9,
    backgroundColor: "#fff",
    borderRadius: 20,
    overflow: "hidden",
  },
  modalContent: {
    width: "100%",
  },
  dateTimeContainer: {
    padding: 20,
    paddingBottom: 10,
    alignItems: "center",
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
    paddingHorizontal: 0,
    paddingBottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  dualImageLayout: {
    position: "relative",
    alignItems: "center",
    width: "100%",
  },
  mainImage: {
    width: "100%",
    aspectRatio: 0.8, // 4:5 ratio (width/height = 4/5 = 0.8)
    borderRadius: 0,
  },
  frontImageOverlay: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 120,
    height: 150, // 4:5 aspect ratio for overlay too
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
    aspectRatio: 0.8, // 4:5 ratio
    borderRadius: 0,
  },
});

export default ImageModal;
