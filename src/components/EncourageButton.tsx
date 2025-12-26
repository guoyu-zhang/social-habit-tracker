import React, { useState, useRef } from 'react';
import { TouchableOpacity, Text, StyleSheet, View, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const PARTICLE_COUNT = 12;
const COLORS = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEEAD'];

interface EncourageButtonProps {
  onPress?: () => void;
}

const EncourageButton: React.FC<EncourageButtonProps> = ({ onPress }) => {
  const [particles] = useState(() => 
    Array(PARTICLE_COUNT).fill(0).map(() => ({
      anim: new Animated.Value(0),
      angle: Math.random() * Math.PI * 2,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      distance: 60 + Math.random() * 40,
      size: 6 + Math.random() * 4
    }))
  );

  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    // Reset particles
    particles.forEach(p => p.anim.setValue(0));
    
    // Button bump animation
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.9,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        tension: 40,
        useNativeDriver: true,
      })
    ]).start();

    // Particle explosion
    const animations = particles.map(p => 
      Animated.timing(p.anim, {
        toValue: 1,
        duration: 800 + Math.random() * 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      })
    );

    Animated.parallel(animations).start();
    onPress?.();
  };

  return (
    <View style={styles.container}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {particles.map((p, i) => {
          const translateX = p.anim.interpolate({
            inputRange: [0, 1],
            outputRange: [0, Math.cos(p.angle) * p.distance]
          });
          const translateY = p.anim.interpolate({
            inputRange: [0, 1],
            outputRange: [0, Math.sin(p.angle) * p.distance]
          });
          const opacity = p.anim.interpolate({
            inputRange: [0, 0.7, 1],
            outputRange: [1, 1, 0]
          });
          const scale = p.anim.interpolate({
            inputRange: [0, 1],
            outputRange: [1, 0]
          });

          return (
            <Animated.View
              key={i}
              style={[
                styles.particle,
                {
                  backgroundColor: p.color,
                  width: p.size,
                  height: p.size,
                  borderRadius: p.size / 2,
                  transform: [
                    { translateX }, 
                    { translateY }, 
                    { scale }
                  ],
                  opacity,
                  left: '50%',
                  top: '50%',
                  marginLeft: -p.size / 2,
                  marginTop: -p.size / 2,
                }
              ]}
            />
          );
        })}
      </View>
      
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <TouchableOpacity 
          style={styles.encourageButton} 
          onPress={handlePress}
          activeOpacity={0.9}
        >
          <Ionicons name="sparkles-outline" size={16} color="#FFF" />
          <Text style={styles.encourageText}>Encourage</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  particle: {
    position: 'absolute',
  },
  encourageButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#333",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 25,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  encourageText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 8,
  },
});

export default EncourageButton;
