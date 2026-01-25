import React, { useRef } from 'react'
import { Animated, Image, StyleSheet, View } from 'react-native'

export function LoadingScreen() {
  const fadeAnim = useRef(new Animated.Value(1)).current

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
      <View style={styles.logoContainer}>
        <Image
          source={require('@/assets/images/logo-transparent.png')}
          style={styles.logo}
          resizeMode="contain"
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
  logoContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 200,
    height: 200,
  },
})
