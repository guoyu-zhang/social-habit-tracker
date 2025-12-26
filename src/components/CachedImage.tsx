import React, { useEffect, useState } from "react";
import { Image, ImageProps } from "react-native";
import * as FileSystem from "expo-file-system/legacy";

interface CachedImageProps extends Omit<ImageProps, "source"> {
  source: { uri: string };
}

// In-memory cache to store mapping of remote URIs to local file URIs
// This prevents checking the file system repeatedly for the same image
const uriCache = new Map<string, string>();

export const CachedImage: React.FC<CachedImageProps> = ({
  source,
  ...props
}) => {
  // Initialize with value from memory cache if available
  const [cachedUri, setCachedUri] = useState<string | null>(
    source?.uri ? uriCache.get(source.uri) || null : null
  );

  useEffect(() => {
    let isMounted = true;

    // If we already have it in memory cache, we're good
    if (source?.uri && uriCache.has(source.uri)) {
      const localUri = uriCache.get(source.uri);
      if (localUri !== cachedUri) {
        setCachedUri(localUri || null);
      }
      return;
    }

    setCachedUri(null); // Reset cached URI when source changes (if not in memory cache)

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

        // Check memory cache again (in case another component loaded it while we were waiting)
        if (uriCache.has(source.uri)) {
          if (isMounted) setCachedUri(uriCache.get(source.uri) || null);
          return;
        }

        const fileInfo = await FileSystem.getInfoAsync(path);

        if (fileInfo.exists) {
          uriCache.set(source.uri, path);
          if (isMounted) setCachedUri(path);
        } else {
          // Download in background
          const downloadRes = await FileSystem.downloadAsync(source.uri, path);
          if (isMounted && downloadRes && downloadRes.uri) {
            uriCache.set(source.uri, downloadRes.uri);
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
