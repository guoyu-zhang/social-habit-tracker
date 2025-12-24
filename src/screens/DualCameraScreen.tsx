import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
} from "react-native";
import { CameraView, CameraType, useCameraPermissions } from "expo-camera";
import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";
import { supabase } from "../services/supabase";
import { useAuth } from "../contexts/AuthContext";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

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

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const [captureStep, setCaptureStep] = useState<
    "back" | "front" | "preview" | "uploading" | "complete"
  >("back");
  const [backImage, setBackImage] = useState<string | null>(null);
  const [frontImage, setFrontImage] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isCapturing, setIsCapturing] = useState(false);
  const [habitDetails, setHabitDetails] = useState<{
    title: string;
    color: string;
  } | null>(null);

  useEffect(() => {
    if (!permission) {
      requestPermission();
    }
    fetchHabitDetails();
  }, [permission]);

  const fetchHabitDetails = async () => {
    try {
      const { data, error } = await supabase
        .from("habits")
        .select("title, color")
        .eq("id", habitId)
        .single();

      if (error) throw error;
      setHabitDetails(data);
    } catch (error) {
      console.error("Error fetching habit details:", error);
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

  const uploadImage = async (
    imageUri: string,
    fileName: string
  ): Promise<string | null> => {
    try {
      const manipulatedImage = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ resize: { width: 1280 } }],
        {
          compress: 0.6,
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

  const handleCapture = async () => {
    if (!cameraRef.current || isCapturing) return;

    try {
      setIsCapturing(true);
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false, // We read file later in uploadImage
        skipProcessing: false,
      });

      if (!photo) {
        throw new Error("Failed to take photo");
      }

      if (captureStep === "back") {
        setBackImage(photo.uri);
        setCaptureStep("front");
        setIsCapturing(false);
      } else if (captureStep === "front") {
        setFrontImage(photo.uri);
        setCaptureStep("preview");
        setIsCapturing(false);
      }
    } catch (error) {
      console.error("Capture error:", error);
      Alert.alert("Error", "Failed to take photo");
      setIsCapturing(false);
    }
  };

  const handlePost = async () => {
    if (!backImage || !frontImage) return;
    setCaptureStep("uploading");
    await processAndUpload(backImage, frontImage);
  };

  const handleRetake = () => {
    setBackImage(null);
    setFrontImage(null);
    setCaptureStep("back");
  };

  const processAndUpload = async (backUri: string, frontUri: string) => {
    if (!user) return;

    try {
      const timestamp = Date.now();
      const backFileName = `${user.id}/${habitId}/back_${timestamp}.jpg`;
      const frontFileName = `${user.id}/${habitId}/front_${timestamp}.jpg`;

      setUploadProgress(25);
      const backUrl = await uploadImage(backUri, backFileName);

      setUploadProgress(50);
      const frontUrl = await uploadImage(frontUri, frontFileName);

      setUploadProgress(75);

      if (backUrl && frontUrl) {
        const completionDate = selectedDate
          ? new Date(selectedDate)
          : new Date();
        const { error } = await supabase.from("habit_completions").insert({
          user_id: user.id,
          habit_id: habitId,
          image_url: backUrl,
          front_image_url: frontUrl,
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
      }
    }
  };

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>
          We need your permission to show the camera
        </Text>
        <TouchableOpacity onPress={requestPermission} style={styles.button}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Camera View - Only visible during capture steps */}
      {(captureStep === "back" || captureStep === "front") && (
        <View style={styles.cameraContainer}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing={captureStep === "back" ? "back" : "front"}
            ref={cameraRef}
            zoom={0.1}
          />
        </View>
      )}

      {/* Top Label - Back/Front indicator */}
      {(captureStep === "back" || captureStep === "front") && (
        <View style={styles.topLabelContainer} pointerEvents="none">
          <Text style={styles.cameraLabel}>
            {captureStep === "back" ? "Back" : "Front"}
          </Text>
        </View>
      )}

      {/* Preview View */}
      {captureStep === "preview" && backImage && frontImage && (
        <View style={styles.previewScreen}>
          {/* Main Image Container - Centered like Camera */}
          <View style={styles.cameraContainer}>
            <Image
              source={{ uri: backImage }}
              style={styles.previewBackImage}
            />
            <Image
              source={{ uri: frontImage }}
              style={styles.frontImageOverlay}
            />
          </View>

          {/* Controls Container for Post Button - Same position as Shutter */}
          <View style={styles.controlsContainer}>
            <TouchableOpacity style={styles.postButton} onPress={handlePost}>
              <Text style={styles.postButtonText}>Post</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Status / Uploading View */}
      {(captureStep === "uploading" || captureStep === "complete") && (
        <View style={styles.uploadContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.statusText}>
            {captureStep === "uploading"
              ? `Uploading... ${uploadProgress}%`
              : "Dual capture complete!"}
          </Text>
        </View>
      )}

      {/* Close/Back Button */}
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => {
          if (captureStep === "preview") {
            handleRetake();
          } else {
            navigation.goBack();
          }
        }}
        disabled={captureStep === "uploading"}
      >
        <Text style={styles.backButtonText}>✕</Text>
      </TouchableOpacity>

      {/* Shutter Button */}
      {(captureStep === "back" || captureStep === "front") && (
        <View style={styles.controlsContainer}>
          <TouchableOpacity
            style={[
              styles.shutterButton,
              isCapturing && styles.shutterButtonDisabled,
            ]}
            onPress={handleCapture}
            disabled={isCapturing}
          >
            <View style={styles.shutterButtonInner} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
  },
  cameraContainer: {
    width: "100%",
    aspectRatio: 2 / 3,
    alignSelf: "center",
  },
  topLabelContainer: {
    position: "absolute",
    top: 60,
    left: 0,
    right: 0,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 20,
  },
  text: {
    color: "#fff",
    textAlign: "center",
  },
  button: {
    alignItems: "center",
    backgroundColor: "#007AFF",
    padding: 10,
    margin: 20,
    borderRadius: 5,
  },
  buttonText: {
    color: "#fff",
  },
  backButton: {
    position: "absolute",
    left: 20,
    top: 60,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 50,
  },
  backButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-start",
    alignItems: "center",
    zIndex: 5,
    paddingTop: 0,
  },
  cameraLabel: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "bold",
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
  controlsContainer: {
    position: "absolute",
    bottom: 50,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 10,
  },
  shutterButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: "rgba(255,255,255,0.3)",
  },
  shutterButtonDisabled: {
    opacity: 0.5,
  },
  shutterButtonInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#000",
  },
  uploadContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  statusText: {
    color: "#fff",
    fontSize: 18,
    marginTop: 20,
  },
  previewScreen: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
    justifyContent: "center",
    zIndex: 10,
  },
  previewBackImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  frontImageOverlay: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 80,
    aspectRatio: 2 / 3,
    resizeMode: "cover",
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#fff",
  },
  postButton: {
    width: 200,
    height: 50,
    borderRadius: 10,
    backgroundColor: "#007AFF",
    alignItems: "center",
    justifyContent: "center",
  },
  postButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
});
