import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
  ActivityIndicator,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";
import { supabase } from "../services/supabase";
import { useAuth } from "../contexts/AuthContext";
import { useNavigation } from "@react-navigation/native";

interface DualCameraScreenProps {
  route: {
    params: {
      habitId: string;
      selectedDate?: string;
    };
  };
}

export default function DualCameraScreen({ route }: DualCameraScreenProps) {
  const { habitId, selectedDate } = route.params;
  const { user } = useAuth();
  const navigation = useNavigation();

  const [isCapturing, setIsCapturing] = useState(false);
  const [captureStep, setCaptureStep] = useState<
    "ready" | "back" | "front" | "uploading" | "complete"
  >("ready");
  const [backImage, setBackImage] = useState<string | null>(null);
  const [frontImage, setFrontImage] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    requestPermissions();
  }, []);

  const requestPermissions = async () => {
    const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
    if (cameraPermission.status !== "granted") {
      Alert.alert(
        "Permission Required",
        "Camera permission is required to take photos."
      );
      navigation.goBack();
    }
  };

  const base64ToUint8Array = (base64: string): Uint8Array => {
    const binaryString = globalThis.atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  };

  const captureImage = async (
    cameraType: ImagePicker.CameraType
  ): Promise<string | null> => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        aspect: [4, 3],
        quality: 0.8,
        base64: true,
        cameraType,
      });

      if (!result.canceled && result.assets[0]) {
        return result.assets[0].uri;
      }
      return null;
    } catch (error) {
      console.error("Error capturing image:", error);
      Alert.alert("Error", "Failed to capture image");
      return null;
    }
  };

  const uploadImage = async (
    imageUri: string,
    fileName: string
  ): Promise<string | null> => {
    try {
      // Compress and resize the image
      const manipulatedImage = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ resize: { width: 1280 } }], // Resize to max width of 1280px
        {
          compress: 0.6, // 60% quality for consistency with CameraScreen
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );

      const base64 = await FileSystem.readAsStringAsync(manipulatedImage.uri, {
        encoding: "base64",
      });

      const uint8Array = base64ToUint8Array(base64);

      const { data, error } = await supabase.storage
        .from("habit-images")
        .upload(fileName, uint8Array, {
          contentType: "image/jpeg",
          upsert: false,
        });

      if (error) {
        console.error("Upload error:", error);
        return null;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("habit-images").getPublicUrl(data.path);

      return publicUrl;
    } catch (error) {
      console.error("Error uploading image:", error);
      return null;
    }
  };

  const startDualCapture = async () => {
    if (!user) return;

    setIsCapturing(true);
    setCaptureStep("back");

    try {
      // Capture back camera first
      const backImageUri = await captureImage(ImagePicker.CameraType.back);
      if (!backImageUri) {
        setIsCapturing(false);
        setCaptureStep("ready");
        return;
      }

      setBackImage(backImageUri);
      setCaptureStep("front");

      // Small delay for better UX
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Capture front camera
      const frontImageUri = await captureImage(ImagePicker.CameraType.front);
      if (!frontImageUri) {
        setIsCapturing(false);
        setCaptureStep("ready");
        setBackImage(null);
        return;
      }

      setFrontImage(frontImageUri);
      setCaptureStep("uploading");

      // Upload both images
      const timestamp = Date.now();
      const backFileName = `${user.id}/${habitId}/back_${timestamp}.jpg`;
      const frontFileName = `${user.id}/${habitId}/front_${timestamp}.jpg`;

      setUploadProgress(25);
      const backUrl = await uploadImage(backImageUri, backFileName);

      setUploadProgress(50);
      const frontUrl = await uploadImage(frontImageUri, frontFileName);

      setUploadProgress(75);

      if (backUrl && frontUrl) {
        // Create completion record with both images
        const completionDate = selectedDate
          ? new Date(selectedDate)
          : new Date();
        const { error } = await supabase.from("habit_completions").insert({
          user_id: user.id,
          habit_id: habitId,
          image_url: backUrl, // Primary image (back camera)
          front_image_url: frontUrl, // Secondary image (front camera)
          completed_at: completionDate.toISOString(),
        });

        setUploadProgress(100);

        if (error) {
          console.error("Error saving completion:", error);
          Alert.alert("Error", "Failed to save completion");
        } else {
          setCaptureStep("complete");
          setTimeout(() => {
            navigation.goBack();
          }, 1500);
        }
      } else {
        Alert.alert("Error", "Failed to upload images");
      }
    } catch (error) {
      console.error("Error in dual capture:", error);
      Alert.alert("Error", "Failed to complete dual capture");
    } finally {
      if (captureStep !== "complete") {
        setIsCapturing(false);
        setCaptureStep("ready");
        setBackImage(null);
        setFrontImage(null);
        setUploadProgress(0);
      }
    }
  };

  const getStepText = () => {
    switch (captureStep) {
      case "ready":
        return "Tap to capture both cameras";
      case "back":
        return "Taking back camera photo...";
      case "front":
        return "Taking front camera photo...";
      case "uploading":
        return `Uploading... ${uploadProgress}%`;
      case "complete":
        return "Dual capture complete!";
      default:
        return "";
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          disabled={isCapturing}
        >
          <Text style={styles.backButtonText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Dual Camera</Text>
      </View>

      <View style={styles.previewContainer}>
        {backImage && (
          <View style={styles.imagePreview}>
            <Text style={styles.imageLabel}>Back Camera</Text>
            <Image source={{ uri: backImage }} style={styles.previewImage} />
          </View>
        )}

        {frontImage && (
          <View style={styles.imagePreview}>
            <Text style={styles.imageLabel}>Front Camera</Text>
            <Image source={{ uri: frontImage }} style={styles.previewImage} />
          </View>
        )}
      </View>

      <View style={styles.statusContainer}>
        <Text style={styles.statusText}>{getStepText()}</Text>
        {isCapturing && (
          <ActivityIndicator
            size="large"
            color="#007AFF"
            style={styles.loader}
          />
        )}
      </View>

      <View style={styles.captureContainer}>
        <TouchableOpacity
          style={[
            styles.captureButton,
            isCapturing && styles.captureButtonDisabled,
          ]}
          onPress={startDualCapture}
          disabled={isCapturing}
        >
          <View style={styles.captureButtonInner} />
        </TouchableOpacity>
      </View>

      <Text style={styles.instructionText}>
        This will take photos from both cameras sequentially
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  backButton: {
    position: "absolute",
    left: 20,
    top: 60,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  backButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  title: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  previewContainer: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  imagePreview: {
    alignItems: "center",
  },
  imageLabel: {
    color: "#fff",
    fontSize: 14,
    marginBottom: 10,
    fontWeight: "500",
  },
  previewImage: {
    width: 150,
    height: 200,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#007AFF",
  },
  statusContainer: {
    alignItems: "center",
    paddingVertical: 20,
  },
  statusText: {
    color: "#fff",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 10,
  },
  loader: {
    marginTop: 10,
  },
  captureContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: "#007AFF",
  },
  captureButtonDisabled: {
    opacity: 0.5,
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#007AFF",
  },
  instructionText: {
    color: "#fff",
    fontSize: 14,
    textAlign: "center",
    paddingHorizontal: 40,
    paddingBottom: 40,
    opacity: 0.7,
  },
});
