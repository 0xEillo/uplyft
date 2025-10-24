import React, { useEffect, useRef, useState } from 'react'
import { View, StyleSheet, Animated } from 'react-native'
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av'

export function LoadingScreen() {
  const fadeAnim = useRef(new Animated.Value(1)).current
  const videoRef = useRef<Video>(null)
  const [videoFinished, setVideoFinished] = useState(false)

  const handlePlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (status.isLoaded && status.didJustFinish) {
      setVideoFinished(true)
    }
  }

  useEffect(() => {
    // Start playing the video
    if (videoRef.current) {
      videoRef.current.playAsync()
    }
  }, [])

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: '#1f1a24',
          opacity: fadeAnim,
        },
      ]}
    >
      <View style={styles.videoContainer}>
        <Video
          ref={videoRef}
          source={require('@/assets/videos/flex-animation.mp4')}
          style={styles.video}
          resizeMode={ResizeMode.CONTAIN}
          shouldPlay
          isLooping={false}
          onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
        />
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  videoContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    width: '100%',
    height: '100%',
  },
})
