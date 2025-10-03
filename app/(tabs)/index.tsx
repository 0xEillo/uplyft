import { FeedCard } from '@/components/feed-card'
import { usePosts } from '@/contexts/posts-context'
import { Ionicons } from '@expo/vector-icons'
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'

// Mock data for the feed
const mockWorkouts = [
  {
    id: 1,
    userName: 'Mike Johnson',
    userAvatar: '',
    timeAgo: '2 hours ago',
    workoutTitle: 'Upper Body Power',
    description: 'Crushed my bench press PR today! 💪',
    stats: {
      duration: '1:32:45',
      calories: 385,
      exercises: 12,
    },
    likes: 24,
    comments: 8,
  },
  {
    id: 2,
    userName: 'Sarah Wilson',
    userAvatar: '',
    timeAgo: '4 hours ago',
    workoutTitle: 'Leg Day Destroyer',
    description: 'Can barely walk but totally worth it! 🔥',
    stats: {
      duration: '58:22',
      calories: 420,
      exercises: 8,
    },
    likes: 31,
    comments: 12,
  },
  {
    id: 3,
    userName: 'You',
    userAvatar: '',
    timeAgo: '6 hours ago',
    workoutTitle: 'Morning Cardio + Core',
    description: 'Started the day right with some cardio and core work 💯',
    stats: {
      duration: '45:12',
      calories: 298,
      exercises: 6,
    },
    likes: 18,
    comments: 5,
  },
  {
    id: 4,
    userName: 'Alex Chen',
    userAvatar: '',
    timeAgo: '1 day ago',
    workoutTitle: 'Pull Day Focus',
    description: 'Back and biceps feeling pumped! New deadlift PR 😤',
    stats: {
      duration: '1:15:30',
      calories: 352,
      exercises: 10,
    },
    likes: 27,
    comments: 9,
  },
]

export default function FeedScreen() {
  const { posts } = usePosts()
  const allPosts = [...posts, ...mockWorkouts]

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Uplyft</Text>
        <View style={styles.headerIcons}>
          <TouchableOpacity style={styles.iconButton}>
            <Ionicons name="notifications-outline" size={24} color="#1a1a1a" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Feed Posts */}
        <View style={styles.feed}>
          {allPosts.map((workout) => (
            <FeedCard key={workout.id} {...workout} />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fafafa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  headerIcons: {
    flexDirection: 'row',
    gap: 12,
  },
  iconButton: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  feed: {
    padding: 16,
  },
})
