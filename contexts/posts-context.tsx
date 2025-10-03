import React, { createContext, ReactNode, useContext, useState } from 'react'

interface WorkoutStats {
  duration: string
  calories: number
  exercises: number
}

export interface Post {
  id: number
  userName: string
  userAvatar: string
  timeAgo: string
  workoutTitle: string
  description: string
  stats: WorkoutStats
  likes: number
  comments: number
}

interface PostsContextType {
  posts: Post[]
  addPost: (
    post: Omit<
      Post,
      'id' | 'userName' | 'userAvatar' | 'timeAgo' | 'likes' | 'comments'
    >,
  ) => void
}

const PostsContext = createContext<PostsContextType | undefined>(undefined)

export function PostsProvider({ children }: { children: ReactNode }) {
  const [posts, setPosts] = useState<Post[]>([])

  const addPost = (
    newPost: Omit<
      Post,
      'id' | 'userName' | 'userAvatar' | 'timeAgo' | 'likes' | 'comments'
    >,
  ) => {
    const post: Post = {
      ...newPost,
      id: Date.now(),
      userName: 'You',
      userAvatar: '',
      timeAgo: 'Just now',
      likes: 0,
      comments: 0,
    }
    setPosts((prev) => [post, ...prev])
  }

  return (
    <PostsContext.Provider value={{ posts, addPost }}>
      {children}
    </PostsContext.Provider>
  )
}

export function usePosts() {
  const context = useContext(PostsContext)
  if (context === undefined) {
    throw new Error('usePosts must be used within a PostsProvider')
  }
  return context
}
