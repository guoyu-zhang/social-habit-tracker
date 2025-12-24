import { useRef } from "react";
import { Animated } from "react-native";

export const useCollapsibleHeader = (headerHeight: number) => {
  const scrollY = useRef(new Animated.Value(0)).current;

  // Create a value that is clamped to 0 for the diffClamp
  // This prevents the header from hiding when the user pulls down (negative scrollY)
  // and then releases (scrollY goes back to 0)
  const scrollYForDiffClamp = scrollY.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
    extrapolateLeft: "clamp",
  });

  const scrollYClamped = Animated.diffClamp(
    scrollYForDiffClamp,
    0,
    headerHeight
  );

  const slideTranslateY = scrollYClamped.interpolate({
    inputRange: [0, headerHeight],
    outputRange: [0, -headerHeight],
  });

  const overscrollTranslateY = scrollY.interpolate({
    inputRange: [-headerHeight, 0],
    outputRange: [headerHeight, 0],
    extrapolateRight: "clamp",
    extrapolateLeft: "extend",
  });

  const translateY = Animated.add(slideTranslateY, overscrollTranslateY);

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: true }
  );

  return { scrollY, translateY, handleScroll };
};
