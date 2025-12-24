import React, { useEffect, useState } from "react";
import { Image, ImageProps } from "react-native";
import * as FileSystem from "expo-file-system/legacy";

interface CachedImageProps extends Omit<ImageProps, "source"> {
  source: { uri: string };
}

export const CachedImage: React.FC<CachedImageProps> = ({
  source,
  ...props
}) => {
  const [cachedUri, setCachedUri] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setCachedUri(null); // Reset cached URI when source changes

    const loadCachedImage = async () => {
      try {
        if (!source?.uri) {
          return;
        }

        // If it's a local file, don't try to cache it
        if (
          source.uri.startsWith("file://") ||
          source.uri.startsWith("content://") ||
          source.uri.startsWith("/")
        ) {
          if (isMounted) setCachedUri(source.uri);
          return;
        }

        const filename =
          source.uri.split("/").pop()?.split("?")[0] || "temp_img";
        const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.]/g, "_");
        const path = `${FileSystem.cacheDirectory}${sanitizedFilename}`;

        const fileInfo = await FileSystem.getInfoAsync(path);

        if (fileInfo.exists) {
          if (isMounted) setCachedUri(path);
        } else {
          // Download in background
          const downloadRes = await FileSystem.downloadAsync(source.uri, path);
          if (isMounted && downloadRes && downloadRes.uri) {
            setCachedUri(downloadRes.uri);
          }
        }
      } catch (error) {
        console.error("Error caching image:", error);
        // If error, we just don't set cachedUri, so it falls back to source.uri
      }
    };

    loadCachedImage();

    return () => {
      isMounted = false;
    };
  }, [source.uri]);

  const displayUri = cachedUri || source?.uri;

  if (!displayUri) {
    return null;
  }

  return <Image source={{ uri: displayUri }} {...props} />;
};
