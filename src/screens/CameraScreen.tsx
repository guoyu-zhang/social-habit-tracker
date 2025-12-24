import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRoute, useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RouteProp } from "@react-navigation/native";
import { useAuth } from "../contexts/AuthContext";
import { supabase, BUCKETS } from "../services/supabase";
import { RootStackParamList } from "../types";
import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";

type CameraScreenRouteProp = RouteProp<RootStackParamList, "Camera">;
type CameraScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  "Camera"
>;

const CameraScreen: React.FC = () => {
  const [image, setImage] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState(false);

  const route = useRoute<CameraScreenRouteProp>();
  const navigation = useNavigation<CameraScreenNavigationProp>();
  const { user } = useAuth();
  const { habitId, selectedDate } = route.params;

  const requestCameraPermission = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission required",
        "Camera access is needed to take photos."
      );
      return false;
    }
    return true;
  };

  const requestMediaLibraryPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission required",
        "Library access is needed to pick photos."
      );
      return false;
    }
    return true;
  };

  const takePhoto = async () => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) return;

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setImage(result.assets[0].uri);
    }
  };

  const pickImage = async () => {
    const hasPermission = await requestMediaLibraryPermission();
    if (!hasPermission) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setImage(result.assets[0].uri);
    }
  };

  const base64ToUint8Array = (base64: string): Uint8Array => {
    const binaryString = globalThis.atob
      ? globalThis.atob(base64)
      : Buffer.from(base64, "base64").toString("binary");
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  };

  const uploadImage = async (uri: string): Promise<string | null> => {
    try {
      // Resize and compress before reading to base64
      const manipulated = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1280 } }],
        { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG }
      );

      const base64 = await FileSystem.readAsStringAsync(manipulated.uri, {
        encoding: "base64",
      });
      const bytes = base64ToUint8Array(base64);

      // Save as jpg after compression
      const ext = "jpg";
      const timestamp = Date.now();
      const fileName = `${user?.id}/${habitId}/${timestamp}.${ext}`;

      // Upload the image file to storage
      const { data, error } = await supabase.storage
        .from(BUCKETS.HABIT_IMAGES)
        .upload(fileName, bytes, {
          contentType: `image/${ext}`,
          upsert: false,
        });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from(BUCKETS.HABIT_IMAGES)
        .getPublicUrl(fileName);

      // Cache the image immediately so it doesn't need to be re-downloaded
      try {
        const publicUrl = urlData.publicUrl;
        const cacheFilename =
          publicUrl.split("/").pop()?.split("?")[0] || "temp_img";
        const sanitizedFilename = cacheFilename.replace(/[^a-zA-Z0-9.]/g, "_");
        const cachePath = `${FileSystem.cacheDirectory}${sanitizedFilename}`;

        // Copy the manipulated (resized/compressed) image to the cache directory
        await FileSystem.copyAsync({
          from: manipulated.uri,
          to: cachePath,
        });
      } catch (cacheError) {
        console.error("Error caching uploaded image:", cacheError);
      }

      return urlData.publicUrl;
    } catch (error) {
      console.error("Error uploading image:", error);
      throw error;
    }
  };

  const handleComplete = async () => {
    if (!image) {
      Alert.alert(
        "Photo Required",
        "Please take or select a photo to complete this habit."
      );
      return;
    }

    if (!user) {
      Alert.alert("Error", "You must be logged in to complete habits.");
      return;
    }

    setUploading(true);

    try {
      // Upload image
      const imageUrl = await uploadImage(image);

      if (!imageUrl) {
        throw new Error("Failed to upload image");
      }

      // Create habit completion record
      const completionDate = selectedDate ? new Date(selectedDate) : new Date();
      const { error } = await supabase.from("habit_completions").insert({
        habit_id: habitId,
        user_id: user.id,
        completed_at: completionDate.toISOString(),
        image_url: imageUrl,
        notes: notes.trim() || null,
      });

      if (error) throw error;

      Alert.alert("Success!", "Habit completed successfully! 🎉", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      console.error("Error completing habit:", error);
      Alert.alert("Error", "Failed to complete habit. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.content}>
        {!image ? (
          <View style={styles.placeholderContainer}>
            <Ionicons name="camera-outline" size={64} color="#ccc" />
            <Text style={styles.placeholderText}>
              Take a photo to prove you completed this habit!
            </Text>

            <View style={styles.buttonContainer}>
              <TouchableOpacity style={styles.cameraButton} onPress={takePhoto}>
                <Ionicons name="camera" size={24} color="#fff" />
                <Text style={styles.buttonText}>Take Photo</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.galleryButton}
                onPress={pickImage}
              >
                <Ionicons name="images" size={24} color="#007AFF" />
                <Text style={styles.galleryButtonText}>
                  Choose from Gallery
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.imageContainer}>
            <Image source={{ uri: image }} style={styles.image} />

            <TouchableOpacity
              style={styles.retakeButton}
              onPress={() => setImage(null)}
            >
              <Ionicons name="refresh" size={20} color="#007AFF" />
              <Text style={styles.retakeText}>Retake</Text>
            </TouchableOpacity>
          </View>
        )}

        {image && (
          <View style={styles.notesContainer}>
            <Text style={styles.notesLabel}>Add a note (optional)</Text>
            <TextInput
              style={styles.notesInput}
              placeholder="How did it go? Any thoughts?"
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
              maxLength={200}
            />
          </View>
        )}
      </View>

      {image && (
        <TouchableOpacity
          style={[
            styles.completeButton,
            uploading && styles.completeButtonDisabled,
          ]}
          onPress={handleComplete}
          disabled={uploading}
        >
          <Text style={styles.completeButtonText}>
            {uploading ? "Completing..." : "Complete Habit"}
          </Text>
        </TouchableOpacity>
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  content: {
    flex: 1,
    padding: 20,
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderText: {
    fontSize: 18,
    color: "#666",
    textAlign: "center",
    marginTop: 16,
    marginBottom: 40,
    paddingHorizontal: 20,
  },
  buttonContainer: {
    width: "100%",
    gap: 16,
  },
  cameraButton: {
    backgroundColor: "#007AFF",
    borderRadius: 8,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  galleryButton: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#007AFF",
  },
  galleryButtonText: {
    color: "#007AFF",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  imageContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  image: {
    width: 300,
    height: 300,
    borderRadius: 12,
    marginBottom: 16,
  },
  retakeButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
  },
  retakeText: {
    color: "#007AFF",
    fontSize: 16,
    marginLeft: 4,
  },
  notesContainer: {
    marginTop: 20,
  },
  notesLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    backgroundColor: "#fff",
    textAlignVertical: "top",
    minHeight: 80,
  },
  completeButton: {
    backgroundColor: "#4CAF50",
    borderRadius: 8,
    padding: 16,
    margin: 20,
    alignItems: "center",
  },
  completeButtonDisabled: {
    backgroundColor: "#ccc",
  },
  completeButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default CameraScreen;
