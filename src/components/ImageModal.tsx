import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ScrollView,
  SafeAreaView,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { HabitCompletion } from "../types";
import { supabase, BUCKETS } from "../services/supabase";

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
  onDelete,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!completion) return;

    Alert.alert(
      "Delete Completion",
      "Are you sure you want to delete this habit completion? This action cannot be undone.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setIsDeleting(true);
            try {
              // Extract image URLs that need to be deleted from storage
              const imageUrls: string[] = [];

              if (completion.image_url) {
                // Extract file path from the full URL
                const urlParts = completion.image_url.split("/");
                const fileName = urlParts[urlParts.length - 1];
                const userFolder = urlParts[urlParts.length - 2];
                const habitFolder = urlParts[urlParts.length - 3];
                imageUrls.push(`${habitFolder}/${userFolder}/${fileName}`);
              }

              if (completion.front_image_url) {
                // Extract file path from the full URL for front camera image
                const urlParts = completion.front_image_url.split("/");
                const fileName = urlParts[urlParts.length - 1];
                const userFolder = urlParts[urlParts.length - 2];
                const habitFolder = urlParts[urlParts.length - 3];
                imageUrls.push(`${habitFolder}/${userFolder}/${fileName}`);
              }

              // Delete images from storage first
              if (imageUrls.length > 0) {
                const { error: storageError } = await supabase.storage
                  .from(BUCKETS.HABIT_IMAGES)
                  .remove(imageUrls);

                if (storageError) {
                  console.warn(
                    "Some images could not be deleted from storage:",
                    storageError
                  );
                  // Continue with completion deletion even if some images fail to delete
                }
              }

              // Delete the habit completion from database
              const { error } = await supabase
                .from("habit_completions")
                .delete()
                .eq("id", completion.id);

              if (error) {
                Alert.alert(
                  "Error",
                  "Failed to delete completion. Please try again."
                );
                return;
              }

              // Call the onDelete callback to refresh the parent component
              onDelete?.(completion.id);
              onClose();
            } catch (error) {
              Alert.alert(
                "Error",
                "Failed to delete completion. Please try again."
              );
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  };
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
      <SafeAreaView style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Habit Completion</Text>
            <View style={styles.headerButtons}>
              <TouchableOpacity
                onPress={handleDelete}
                style={[styles.headerButton, styles.deleteButton]}
                disabled={isDeleting}
              >
                <Ionicons
                  name={isDeleting ? "hourglass" : "trash"}
                  size={20}
                  color="#dc3545"
                />
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose} style={styles.headerButton}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView
            style={styles.modalContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Date and Time */}
            <View style={styles.dateTimeContainer}>
              <Text style={styles.dateText}>
                {formatDate(completion.completed_at)}
              </Text>
              <Text style={styles.timeText}>
                {formatTime(completion.completed_at)}
              </Text>
            </View>

            {/* Image(s) */}
            <View style={styles.imageContainer}>
              {completion.front_image_url ? (
                // Dual camera layout - overlaid like calendar thumbnail
                <View style={styles.dualImageLayout}>
                  <Image
                    source={{ uri: completion.image_url! }}
                    style={styles.mainImage}
                    resizeMode="contain"
                  />
                  <Image
                    source={{ uri: completion.front_image_url }}
                    style={styles.frontImageOverlay}
                    resizeMode="contain"
                  />
                  <View style={styles.dualIndicator}>
                    <Ionicons name="camera" size={16} color="#fff" />
                  </View>
                </View>
              ) : (
                // Single camera layout
                <View style={styles.singleImageContainer}>
                  <Image
                    source={{ uri: completion.image_url! }}
                    style={styles.singleImage}
                    resizeMode="contain"
                  />
                </View>
              )}
            </View>

            {/* Notes */}
            {completion.notes && (
              <View style={styles.notesContainer}>
                <Text style={styles.notesTitle}>Notes</Text>
                <View style={styles.notesBox}>
                  <Text style={styles.notesText}>{completion.notes}</Text>
                </View>
              </View>
            )}

            {/* Additional Info */}
            <View style={styles.infoContainer}>
              <View style={styles.infoRow}>
                <Ionicons name="camera" size={16} color="#666" />
                <Text style={styles.infoText}>
                  {completion.front_image_url ? "Dual Camera" : "Single Camera"}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Ionicons name="time" size={16} color="#666" />
                <Text style={styles.infoText}>
                  Completed at {formatTime(completion.completed_at)}
                </Text>
              </View>
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>
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
    width: width * 0.95,
    height: height * 0.9,
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  headerButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerButton: {
    padding: 8,
    borderRadius: 8,
  },
  deleteButton: {
    backgroundColor: "rgba(220, 53, 69, 0.1)",
  },
  modalContent: {
    flex: 1,
    paddingBottom: 20,
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
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  dualImageLayout: {
    position: "relative",
    alignItems: "center",
  },
  mainImage: {
    width: width * 0.85,
    height: width * 0.85 * 0.75, // 4:3 aspect ratio
    borderRadius: 12,
  },
  frontImageOverlay: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 120,
    height: 120,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: "#fff",
  },
  dualIndicator: {
    position: "absolute",
    top: 12,
    left: 12,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    borderRadius: 12,
    padding: 8,
  },
  singleImageContainer: {
    alignItems: "center",
  },
  singleImage: {
    width: width * 0.85,
    height: width * 0.85 * 0.75, // 4:3 aspect ratio
    borderRadius: 12,
  },
  notesContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  notesTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  notesBox: {
    backgroundColor: "#f8f9fa",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e9ecef",
  },
  notesText: {
    fontSize: 14,
    color: "#333",
    lineHeight: 20,
  },
  infoContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 8,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  infoText: {
    fontSize: 14,
    color: "#666",
  },
});

export default ImageModal;
