import { useAuth } from '@/contexts/auth-context'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'

export default function ProfileScreen() {
  const { user, signOut } = useAuth()

  const handleSignOut = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut()
            router.replace('/(auth)/login')
          } catch (error) {
            Alert.alert('Error', error.message || 'Failed to sign out')
          }
        },
      },
    ])
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Profile Info */}
        <View style={styles.profileSection}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={48} color="#fff" />
          </View>
          <Text style={styles.email}>{user?.email}</Text>
        </View>

        {/* Menu Items */}
        <View style={styles.menu}>
          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="settings-outline" size={24} color="#666" />
              <Text style={styles.menuItemText}>Settings</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="help-circle-outline" size={24} color="#666" />
              <Text style={styles.menuItemText}>Help & Support</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={handleSignOut}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="log-out-outline" size={24} color="#FF6B35" />
              <Text style={[styles.menuItemText, styles.signOutText]}>
                Sign Out
              </Text>
            </View>
          </TouchableOpacity>
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
  content: {
    flex: 1,
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: '#fff',
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#FF6B35',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  email: {
    fontSize: 17,
    color: '#666',
  },
  menu: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuItemText: {
    fontSize: 17,
    color: '#1a1a1a',
  },
  signOutText: {
    color: '#FF6B35',
    fontWeight: '600',
  },
})
