import type { Href } from 'expo-router'
import type { ImageSourcePropType } from 'react-native'

export type AppPostPreviewType =
  | 'editor_toolbar'
  | 'workout_calendar'
  | 'rest_timer'
  | 'scan_workout'
  | 'voice_logging'
  | 'music_preview'
  | 'pr_tooltip'
  | 'share_widgets'
  | 'body_log'
  | 'routine_library'
  | 'coach_chat'
  | 'offline_queue'
  | 'explore_programs'
  | 'explore_routines'

export type AppPost = {
  id: string
  title: string
  body: string
  createdAt: string
  image?: ImageSourcePropType
  preview?: AppPostPreviewType
  badge?: string
  ctaText?: string
  ctaRoute?: Href<string>
  ctaUrl?: string
}

export const APP_ACCOUNT = {
  id: 'rep-ai',
  name: 'Rep AI',
  avatar: require('../assets/images/icon.png') as ImageSourcePropType,
}

export const APP_POSTS: AppPost[] = [
  {
    id: 'workout-calendar',
    title: 'Track Your Training Consistency',
    body:
      'View all your past workouts in a clear calendar view. Stay on top of your routine and watch your consistency grow.',
    createdAt: '2026-02-02T16:00:00.000Z',
    preview: 'workout_calendar',
    ctaText: 'Open calendar',
    ctaRoute: '/workout-calendar',
  },
  {
    id: 'explore-programs',
    title: 'Explore Programs Built by Coaches',
    body:
      'Jump into curated training plans with multiple routines and a clear progression path.',
    createdAt: '2026-02-02T14:30:00.000Z',
    preview: 'explore_programs',
    badge: 'EXPLORE',
    ctaText: 'Browse programs',
    ctaRoute: '/explore',
  },
  {
    id: 'explore-routines',
    title: 'Pick a Routine and Train Today',
    body:
      'Choose from premium routines in Explore and save them to your library in one tap.',
    createdAt: '2026-02-02T13:45:00.000Z',
    preview: 'explore_routines',
    badge: 'EXPLORE',
    ctaText: 'See routines',
    ctaRoute: '/explore',
  },
  {
    id: 'music-preview',
    title: 'Add a Song Preview to Your Workout',
    body: 'Attach a track preview so friends can feel the vibe you trained to.',
    createdAt: '2026-02-02T13:10:00.000Z',
    preview: 'music_preview',
    badge: 'NEW',
    ctaText: 'Add a song',
    ctaRoute: '/(tabs)/create-post',
  },
  {
    id: 'quick-toolbar',
    title: 'Quick Add Toolbar While You Type',
    body:
      'Scan, voice log, start a timer, pick a routine, or search exercises without leaving the keyboard.',
    createdAt: '2026-02-01T18:15:00.000Z',
    preview: 'editor_toolbar',
    ctaText: 'Try it now',
    ctaRoute: '/(tabs)/create-post',
  },
  {
    id: 'rest-timer',
    title: 'Rest Timer Without Leaving Your Workout',
    body:
      'Start, pause, and add time from the overlay so your flow never breaks between sets.',
    createdAt: '2026-01-31T19:05:00.000Z',
    preview: 'rest_timer',
    badge: 'HIDDEN GEM',
    ctaText: 'Start a timer',
    ctaRoute: '/(tabs)/create-post',
  },
  {
    id: 'scan-notes',
    title: 'Scan Handwritten Notes Into a Workout',
    body:
      'Snap a photo and let Rep AI parse sets, reps, and exercises automatically.',
    createdAt: '2026-01-30T17:20:00.000Z',
    preview: 'scan_workout',
    badge: 'AI',
    ctaText: 'Scan a workout',
    ctaRoute: '/(tabs)/create-post',
  },
  {
    id: 'voice-logging',
    title: 'Voice Log Your Training',
    body:
      'Dictate your workout out loud and let Rep AI turn it into structured sets.',
    createdAt: '2026-01-29T16:45:00.000Z',
    preview: 'voice_logging',
    badge: 'PRO',
    ctaText: 'Open voice log',
    ctaRoute: '/(tabs)/create-speech',
  },
  {
    id: 'pr-breakdown',
    title: 'Tap Any PR Badge for the Full Breakdown',
    body: 'See the exact set, weight, and reps that created your new record.',
    createdAt: '2026-01-28T14:10:00.000Z',
    preview: 'pr_tooltip',
    badge: 'INSIGHT',
    ctaText: 'View strength stats',
    ctaRoute: '/strength-stats',
  },
  {
    id: 'share-cards',
    title: 'Share Ready-Made Workout Cards',
    body:
      'Generate clean share cards with your highlights for stories or messages.',
    createdAt: '2026-01-27T15:30:00.000Z',
    preview: 'share_widgets',
    badge: 'SHARE',
    ctaText: 'Log & share',
    ctaRoute: '/(tabs)/create-post',
  },
  {
    id: 'body-log',
    title: 'Body Log Trends Over Time',
    body: 'Track weight, body fat, and progress photos in one place.',
    createdAt: '2026-01-26T12:40:00.000Z',
    preview: 'body_log',
    badge: 'TRACK',
    ctaText: 'Open Gym Log',
    ctaRoute: '/body-log/',
  },
  {
    id: 'routine-library',
    title: 'Save Your Go-To Routines',
    body:
      'Build reusable routines and launch them from your library in seconds.',
    createdAt: '2026-01-25T17:05:00.000Z',
    preview: 'routine_library',
    badge: 'ORGANIZE',
    ctaText: 'View routines',
    ctaRoute: '/routines',
  },
  {
    id: 'coach-chat',
    title: 'Ask the Coach for Real-Time Help',
    body:
      'Get form cues, swap exercises, or build a workout with the Rep AI coach.',
    createdAt: '2026-01-24T16:10:00.000Z',
    preview: 'coach_chat',
    badge: 'AI',
    ctaText: 'Open coach',
    ctaRoute: '/(tabs)/chat',
  },
  {
    id: 'offline-queue',
    title: 'Log Workouts Offline, Sync Later',
    body:
      'Keep logging even without service. We queue and upload once you’re back online.',
    createdAt: '2026-01-23T13:50:00.000Z',
    preview: 'offline_queue',
    badge: 'OFFLINE',
    ctaText: 'Try offline logging',
    ctaRoute: '/(tabs)/create-post',
  },
]
