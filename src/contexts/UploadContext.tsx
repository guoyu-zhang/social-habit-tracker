import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Alert } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from '../services/supabase';

interface UploadState {
  progress: number;
  status: 'uploading' | 'completed' | 'error';
  backUri: string;
  frontUri: string;
  error?: string;
}

interface UploadContextType {
  uploads: Record<string, UploadState>;
  startUpload: (habitId: string, backUri: string, frontUri: string, userId: string, selectedDate?: string) => Promise<void>;
  clearUpload: (habitId: string) => void;
}

const UploadContext = createContext<UploadContextType | undefined>(undefined);

export const useUpload = () => {
  const context = useContext(UploadContext);
  if (!context) {
    throw new Error('useUpload must be used within an UploadProvider');
  }
  return context;
};

interface UploadProviderProps {
  children: ReactNode;
}

export const UploadProvider: React.FC<UploadProviderProps> = ({ children }) => {
  const [uploads, setUploads] = useState<Record<string, UploadState>>({});

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

      // Cache the image immediately
      try {
        const cacheFilename =
          publicUrl.split("/").pop()?.split("?")[0] || "temp_img";
        const sanitizedFilename = cacheFilename.replace(/[^a-zA-Z0-9.]/g, "_");
        const cachePath = `${FileSystem.cacheDirectory}${sanitizedFilename}`;

        await FileSystem.copyAsync({
          from: manipulatedImage.uri,
          to: cachePath,
        });
      } catch (cacheError) {
        console.error("Error caching uploaded image:", cacheError);
      }

      return publicUrl;
    } catch (error) {
      console.error("Error uploading image:", error);
      return null;
    }
  };

  const startUpload = async (habitId: string, backUri: string, frontUri: string, userId: string, selectedDate?: string) => {
    // Set initial state
    setUploads(prev => ({
      ...prev,
      [habitId]: {
        progress: 0,
        status: 'uploading',
        backUri,
        frontUri,
      }
    }));

    try {
      const timestamp = Date.now();
      const backFileName = `${userId}/${habitId}/back_${timestamp}.jpg`;
      const frontFileName = `${userId}/${habitId}/front_${timestamp}.jpg`;

      // Update progress
      setUploads(prev => ({
        ...prev,
        [habitId]: { ...prev[habitId], progress: 10 }
      }));

      const backUrl = await uploadImage(backUri, backFileName);
      
      setUploads(prev => ({
        ...prev,
        [habitId]: { ...prev[habitId], progress: 50 }
      }));

      const frontUrl = await uploadImage(frontUri, frontFileName);

      setUploads(prev => ({
        ...prev,
        [habitId]: { ...prev[habitId], progress: 80 }
      }));

      if (backUrl && frontUrl) {
        const completionDate = selectedDate
          ? new Date(selectedDate)
          : new Date();
        
        const { error } = await supabase.from("habit_completions").insert({
          user_id: userId,
          habit_id: habitId,
          image_url: backUrl,
          front_image_url: frontUrl,
          completed_at: completionDate.toISOString(),
        });

        if (error) throw error;

        setUploads(prev => ({
          ...prev,
          [habitId]: { ...prev[habitId], progress: 100, status: 'completed' }
        }));
      } else {
        throw new Error("Failed to upload images");
      }
    } catch (error: any) {
      console.error("Error in background upload:", error);
      setUploads(prev => ({
        ...prev,
        [habitId]: { 
          ...prev[habitId], 
          status: 'error', 
          error: error.message || 'Upload failed' 
        }
      }));
      Alert.alert("Upload Failed", "Your habit completion could not be uploaded. Please try again.");
    }
  };

  const clearUpload = (habitId: string) => {
    setUploads(prev => {
      const newState = { ...prev };
      delete newState[habitId];
      return newState;
    });
  };

  return (
    <UploadContext.Provider value={{ uploads, startUpload, clearUpload }}>
      {children}
    </UploadContext.Provider>
  );
};
