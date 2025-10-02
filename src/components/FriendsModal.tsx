import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Image,
  RefreshControl,
  Alert,
  Modal,
  SafeAreaView,
  Animated,
  Dimensions,
  PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Friendship, User } from '../types';

type UserSearchResult = Pick<User, 'id' | 'username' | 'avatar_url'>;

interface FriendWithUser extends Friendship {
  friend: Pick<User, 'id' | 'username' | 'avatar_url'>;
}

interface FriendsModalProps {
  visible: boolean;
  onClose: () => void;
}

const FriendsModal: React.FC<FriendsModalProps> = ({ visible, onClose }) => {
  const { user } = useAuth();
  const [friends, setFriends] = useState<FriendWithUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searching, setSearching] = useState(false);
  
  const screenWidth = Dimensions.get('window').width;
  const slideAnim = useState(new Animated.Value(screenWidth))[0];
  const panAnim = useState(new Animated.Value(0))[0];

  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (evt, gestureState) => {
      // Only respond to horizontal swipes to the right
      return Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && gestureState.dx > 0;
    },
    onPanResponderMove: (evt, gestureState) => {
      // Only allow swiping to the right (positive dx)
      if (gestureState.dx >= 0) {
        panAnim.setValue(gestureState.dx);
      }
    },
    onPanResponderRelease: (evt, gestureState) => {
      // If swiped more than 1/3 of screen width or with sufficient velocity, dismiss
      if (gestureState.dx > screenWidth / 3 || gestureState.vx > 0.5) {
        handleClose();
      } else {
        // Snap back to original position
        Animated.spring(panAnim, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      }
    },
  });

  const fetchFriends = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('friendships')
        .select('*')
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);

      if (error) throw error;

      // Fetch user details separately
      let friendsWithUser = [];
      if (data && data.length > 0) {
        const userIds = [...new Set(data.flatMap(f => [f.user1_id, f.user2_id]))];
        const { data: users } = await supabase
          .from('users')
          .select('id, username, avatar_url')
          .in('id', userIds);
        
        friendsWithUser = data.map((friendship: any) => {
          const friendId = friendship.user1_id === user.id ? friendship.user2_id : friendship.user1_id;
          const friend = users?.find(u => u.id === friendId) || { id: friendId, username: 'Unknown User' };
          return {
            ...friendship,
            friend,
          };
        });
      }

      setFriends(friendsWithUser);
    } catch (error) {
      console.error('Error fetching friends:', error);
      Alert.alert('Error', 'Failed to load friends');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  const searchUsers = useCallback(async (query: string) => {
    if (!query.trim() || !user) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, username, avatar_url')
        .ilike('username', `%${query}%`)
        .neq('id', user.id)
        .limit(10);

      if (error) throw error;

      // Filter out users who are already friends
      const friendIds = friends.map(f => f.friend.id);
      const filteredResults = data?.filter(u => !friendIds.includes(u.id)) || [];
      
      setSearchResults(filteredResults);
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setSearching(false);
    }
  }, [user, friends]);

  const addFriend = async (friendId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('friendships')
        .insert([
          {
            user1_id: user.id,
            user2_id: friendId,
            status: 'accepted',
          },
        ]);

      if (error) throw error;

      Alert.alert('Success', 'Friend added successfully!');
      fetchFriends();
      setSearchQuery('');
      setSearchResults([]);
    } catch (error) {
      console.error('Error adding friend:', error);
      Alert.alert('Error', 'Failed to add friend');
    }
  };

  const removeFriend = async (friendshipId: string) => {
    try {
      const { error } = await supabase
        .from('friendships')
        .delete()
        .eq('id', friendshipId);

      if (error) throw error;

      Alert.alert('Success', 'Friend removed successfully!');
      fetchFriends();
    } catch (error) {
      console.error('Error removing friend:', error);
      Alert.alert('Error', 'Failed to remove friend');
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchFriends();
  }, [fetchFriends]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: screenWidth,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(panAnim, {
        toValue: screenWidth,
        duration: 250,
        useNativeDriver: true,
      })
    ]).start(() => {
      panAnim.setValue(0);
      onClose();
    });
  };

  useEffect(() => {
    if (visible) {
      fetchFriends();
      panAnim.setValue(0);
      // Slide in from right
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      // Slide out to right
      Animated.timing(slideAnim, {
        toValue: screenWidth,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, fetchFriends, slideAnim, panAnim, screenWidth]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchUsers(searchQuery);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, searchUsers]);

  const renderFriend = ({ item }: { item: FriendWithUser }) => (
    <View style={styles.friendItem}>
      <View style={styles.friendInfo}>
        <Image
          source={{
            uri: item.friend.avatar_url || 'https://via.placeholder.com/50',
          }}
          style={styles.avatar}
        />
        <Text style={styles.friendName}>{item.friend.username}</Text>
      </View>
      <View style={styles.friendActions}>
        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => removeFriend(item.id)}
        >
          <Ionicons name="person-remove" size={20} color="#ff4444" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderSearchResult = ({ item }: { item: UserSearchResult }) => (
    <View style={styles.searchResultItem}>
      <View style={styles.friendInfo}>
        <Image
          source={{
            uri: item.avatar_url || 'https://via.placeholder.com/50',
          }}
          style={styles.avatar}
        />
        <Text style={styles.friendName}>{item.username}</Text>
      </View>
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => addFriend(item.id)}
      >
        <Ionicons name="person-add" size={20} color="#007AFF" />
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <Modal visible={visible} transparent animationType="none">
        <View style={styles.modalOverlay}>
          <Animated.View 
            style={[
              styles.modalContainer,
              {
                transform: [{ 
                  translateX: Animated.add(slideAnim, panAnim)
                }]
              }
            ]}
            {...panResponder.panHandlers}
          >
            <SafeAreaView style={styles.container}>
              <View style={styles.header}>
                <Text style={styles.headerTitle}>Friends</Text>
                <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
                  <Ionicons name="close" size={24} color="#333" />
                </TouchableOpacity>
              </View>
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Loading friends...</Text>
              </View>
            </SafeAreaView>
          </Animated.View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="none">
      <View style={styles.modalOverlay}>
        <Animated.View 
          style={[
            styles.modalContainer,
            {
              transform: [{ 
                translateX: Animated.add(slideAnim, panAnim)
              }]
            }
          ]}
          {...panResponder.panHandlers}
        >
          <SafeAreaView style={styles.container}>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Friends</Text>
              <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

        <View style={styles.searchContainer}>
          <View style={styles.searchInputContainer}>
            <Ionicons
              name="search"
              size={20}
              color="#8E8E93"
              style={styles.searchIcon}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Search users..."
              placeholderTextColor="#8E8E93"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>

        {searchQuery ? (
          <View style={styles.searchSection}>
            <Text style={styles.sectionTitle}>Search Results</Text>
            {searching ? (
              <Text style={styles.searchingText}>Searching...</Text>
            ) : (
              <FlatList
                data={searchResults}
                renderItem={renderSearchResult}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                  <Text style={styles.emptyText}>No users found</Text>
                }
              />
            )}
          </View>
        ) : (
          <View style={styles.friendsSection}>
            <Text style={styles.sectionTitle}>Friends ({friends.length})</Text>
            <FlatList
              data={friends}
              renderItem={renderFriend}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor="#007AFF"
                />
              }
              ListEmptyComponent={
                <Text style={styles.emptyText}>
                  No friends yet. Search for users to add as friends!
                </Text>
              }
            />
          </View>
        )}
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'flex-end',
    flexDirection: 'row',
  },
  modalContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f8f9fa',
    shadowColor: '#000',
    shadowOffset: {
      width: -2,
      height: 0,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e5e9',
    backgroundColor: '#fff',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  closeButton: {
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    color: '#333',
    fontSize: 16,
  },
  searchContainer: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e5e9',
    backgroundColor: '#fff',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: '#e1e5e9',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#333',
    fontSize: 16,
  },
  searchSection: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  friendsSection: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  sectionTitle: {
    color: '#333',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e5e9',
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e5e9',
  },
  friendInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  friendName: {
    color: '#333',
    fontSize: 16,
    fontWeight: '500',
  },
  friendActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  removeButton: {
    padding: 8,
  },
  addButton: {
    padding: 8,
  },
  emptyText: {
    color: '#666',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 32,
  },
  searchingText: {
    color: '#666',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 16,
  },
});

export default FriendsModal;