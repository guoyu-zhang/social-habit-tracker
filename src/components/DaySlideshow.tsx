import React, { useState, useEffect } from "react";
import { View, Image, StyleSheet, Dimensions } from "react-native";
import { CachedImage } from "./CachedImage";

const { width } = Dimensions.get("window");

interface DaySlideshowProps {
  imageUrls: string[];
  interval?: number;
  compact?: boolean;
}

const DaySlideshow: React.FC<DaySlideshowProps> = ({
  imageUrls,
  interval = 3000,
  compact = false,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (imageUrls.length <= 1) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % imageUrls.length);
    }, interval);

    return () => clearInterval(timer);
  }, [imageUrls.length, interval]);

  if (imageUrls.length === 0) {
    return (
      <View style={[styles.emptyContainer, compact && styles.compactEmpty]}>
        {/* You can customize this empty state */}
      </View>
    );
  }

  return (
    <View style={[styles.container, compact && styles.compactContainer]}>
      <CachedImage
        source={{ uri: imageUrls[currentIndex] }}
        style={styles.image}
        resizeMode="cover"
      />
      {!compact && imageUrls.length > 1 && (
        <View style={styles.indicatorContainer}>
          {imageUrls.map((_, index) => (
            <View
              key={index}
              style={[
                styles.indicator,
                index === currentIndex ? styles.activeIndicator : null,
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "100%",
    height: 300,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#f0f0f0",
  },
  compactContainer: {
    height: "100%",
    borderRadius: 0,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  emptyContainer: {
    width: "100%",
    height: 100,
    backgroundColor: "#f9f9f9",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  compactEmpty: {
    height: "100%",
    borderRadius: 0,
  },
  indicatorContainer: {
    position: "absolute",
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  indicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255, 255, 255, 0.5)",
  },
  activeIndicator: {
    backgroundColor: "#fff",
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});

export default DaySlideshow;
