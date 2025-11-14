import { Paywall } from '@/components/paywall'
import { AnalyticsEvents } from '@/constants/analytics-events'
import { useAnalytics } from '@/contexts/analytics-context'
import { useAuth } from '@/contexts/auth-context'
import { useSubscription } from '@/contexts/subscription-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { useWeightUnits } from '@/hooks/useWeightUnits'
import { Ionicons } from '@expo/vector-icons'
import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import Markdown from 'react-native-markdown-display'
import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system/legacy'
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler'
import AnimatedReanimated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  images?: string[] // Image URIs for display
}

interface ExamplePrompt {
  text: string
  requiresImage: boolean
}

const TEXT_EXAMPLES: ExamplePrompt[] = [
  { text: "What's my 1 rep max for squat?", requiresImage: false },
  { text: "What's my strongest exercise?", requiresImage: false },
  { text: "How's my strength trending?", requiresImage: false },
  { text: 'Where do I rank on bench?', requiresImage: false },
  { text: 'What muscle groups am I neglecting?', requiresImage: false },
  { text: 'How much progress have I made this month?', requiresImage: false },
  { text: 'What should I focus on in my next workout?', requiresImage: false },
  { text: 'How often am I training each muscle group?', requiresImage: false },
  { text: 'When did I last hit a PR on deadlift?', requiresImage: false },
  { text: 'Am I training consistently enough?', requiresImage: false },
  { text: "What's my total training volume been?", requiresImage: false },
  { text: 'How do my lifts compare to my body weight?', requiresImage: false },
  { text: 'What exercises am I improving fastest on?', requiresImage: false },
]

const IMAGE_EXAMPLES: ExamplePrompt[] = [
  { text: 'What does this gym machine do?', requiresImage: true },
  { text: 'Can you analyze my form?', requiresImage: true },
  { text: 'Should I add this to my routine?', requiresImage: true },
  { text: 'Which muscles does this exercise target?', requiresImage: true },
  { text: 'Is my setup safe for this exercise?', requiresImage: true },
  { text: 'Suggest a workout using these machines', requiresImage: true },
]

const ALL_EXAMPLES = [...TEXT_EXAMPLES, ...IMAGE_EXAMPLES]

const MAX_IMAGES = 10

// Fisher-Yates shuffle to get random examples
function getRandomExamples(count: number): ExamplePrompt[] {
  const shuffled = [...ALL_EXAMPLES]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled.slice(0, count)
}

export function WorkoutChat() {
  const scrollViewRef = useRef<ScrollView>(null)
  const inputRef = useRef<TextInput>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [displayedExamples] = useState<ExamplePrompt[]>(() => getRandomExamples(4))
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showPaywall, setShowPaywall] = useState(false)
  const [selectedImages, setSelectedImages] = useState<string[]>([])
  const [showImagePickerModal, setShowImagePickerModal] = useState(false)
  const [viewerImages, setViewerImages] = useState<string[]>([])
  const [viewerImageIndex, setViewerImageIndex] = useState<number | null>(null)
  const translateY = useSharedValue(0)
  const { user, session } = useAuth()
  const { isProMember } = useSubscription()
  const { trackEvent } = useAnalytics()
  const colors = useThemedColors()
  const { weightUnit } = useWeightUnits()
  const insets = useSafeAreaInsets()

  // Auto-scroll to bottom when new messages arrive or content changes
  const scrollToBottom = () => {
    scrollViewRef.current?.scrollToEnd({ animated: true })
  }

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom()
    }
  }, [messages.length])

  // Scroll to bottom when keyboard appears
  useEffect(() => {
    const keyboardWillShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        setTimeout(() => scrollToBottom(), 100)
      },
    )

    return () => {
      keyboardWillShowListener.remove()
    }
  }, [])

  // Reset bottom sheet position when modal opens
  useEffect(() => {
    if (showImagePickerModal) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      translateY.value = 0
    }
  }, [showImagePickerModal, translateY])

  // Bottom sheet swipe-down gesture
  const closeImagePickerSheet = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setShowImagePickerModal(false)
  }

  const pan = Gesture.Pan()
    .onUpdate((event) => {
      if (event.translationY > 0) {
        translateY.value = event.translationY
      }
    })
    .onEnd((event) => {
      if (event.translationY > 100 || event.velocityY > 1000) {
        translateY.value = withTiming(500, { duration: 200 }, () => {
          runOnJS(closeImagePickerSheet)()
        })
      } else {
        translateY.value = withSpring(0, {
          damping: 20,
          stiffness: 300,
        })
      }
    })

  const animatedBottomSheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }))

  // Convert image URI to base64
  const convertImageToBase64 = async (uri: string): Promise<string> => {
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: 'base64',
      })
      return base64
    } catch (error) {
      console.error('Error converting image to base64:', error)
      throw error
    }
  }

  // Launch camera
  const launchCamera = async () => {
    setShowImagePickerModal(false)

    try {
      const currentStatus = await ImagePicker.getCameraPermissionsAsync()

      if (currentStatus.status === 'denied' && !currentStatus.canAskAgain) {
        Alert.alert(
          'Camera Access Needed',
          Platform.select({
            ios: 'To take photos, please enable camera access in Settings > Rep AI > Camera.',
            android:
              'To take photos, please enable camera access in Settings > Apps > Rep AI > Permissions.',
          }),
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Open Settings',
              onPress: () => Linking.openSettings(),
            },
          ],
        )
        return
      }

      const permission = await ImagePicker.requestCameraPermissionsAsync()

      if (permission.status !== 'granted') {
        Alert.alert(
          'Camera Permission Required',
          'Rep AI needs camera access to take photos. You can enable this in your device settings.',
          [
            { text: 'Not Now', style: 'cancel' },
            {
              text: 'Open Settings',
              onPress: () => Linking.openSettings(),
            },
          ],
        )
        return
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: 'images' as any,
        allowsEditing: false,
        quality: 0.8,
      })

      if (!result.canceled && result.assets[0]) {
        if (selectedImages.length < MAX_IMAGES) {
          setSelectedImages((prev) => [...prev, result.assets[0].uri])
        } else {
          Alert.alert(
            'Maximum Images Reached',
            `You can only add up to ${MAX_IMAGES} images per message.`,
          )
        }
      }
    } catch (error) {
      console.error('Error launching camera:', error)
      Alert.alert(
        'Camera Error',
        'Failed to open camera. Please check your camera permissions in device settings.',
      )
    }
  }

  // Launch photo library
  const launchLibrary = async () => {
    setShowImagePickerModal(false)

    try {
      const currentStatus =
        await ImagePicker.getMediaLibraryPermissionsAsync()

      if (currentStatus.status === 'denied' && !currentStatus.canAskAgain) {
        Alert.alert(
          'Photo Library Access Needed',
          Platform.select({
            ios: 'To select photos, please enable photo library access in Settings > Rep AI > Photos.',
            android:
              'To select photos, please enable storage access in Settings > Apps > Rep AI > Permissions.',
          }),
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Open Settings',
              onPress: () => Linking.openSettings(),
            },
          ],
        )
        return
      }

      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync()

      if (permission.status !== 'granted') {
        Alert.alert(
          'Photo Library Permission Required',
          'Rep AI needs photo library access to select photos. You can enable this in your device settings.',
          [
            { text: 'Not Now', style: 'cancel' },
            {
              text: 'Open Settings',
              onPress: () => Linking.openSettings(),
            },
          ],
        )
        return
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images' as any,
        allowsEditing: false,
        quality: 0.8,
        allowsMultipleSelection: true,
        selectionLimit: MAX_IMAGES - selectedImages.length,
      })

      if (!result.canceled && result.assets.length > 0) {
        const newImages = result.assets.map((asset) => asset.uri)
        const totalImages = selectedImages.length + newImages.length

        if (totalImages <= MAX_IMAGES) {
          setSelectedImages((prev) => [...prev, ...newImages])
        } else {
          Alert.alert(
            'Maximum Images Reached',
            `You can only add up to ${MAX_IMAGES} images per message. Selected ${newImages.length} images would exceed the limit.`,
          )
        }
      }
    } catch (error) {
      console.error('Error launching library:', error)
      Alert.alert(
        'Photo Library Error',
        'Failed to open photo library. Please check your photo library permissions in device settings.',
      )
    }
  }

  // Remove image from selection
  const removeImage = (index: number) => {
    setSelectedImages((prev) => prev.filter((_, i) => i !== index))
  }

  // Open image viewer
  const openImageViewer = (images: string[], startIndex: number) => {
    setViewerImages(images)
    setViewerImageIndex(startIndex)
  }

  // Close image viewer
  const closeImageViewer = () => {
    setViewerImageIndex(null)
    setViewerImages([])
  }

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return

    // Check if user is pro member
    if (!isProMember) {
      setShowPaywall(true)
      trackEvent(AnalyticsEvents.PAYWALL_SHOWN, {
        feature: 'ai_chat',
      })
      return
    }

    // Store input and images before clearing
    const messageContent = input.trim()
    const imagesToSend = [...selectedImages]

    // Clear input immediately after validation
    setInput('')
    setSelectedImages([])

    // Force blur and clear the TextInput to prevent race conditions
    inputRef.current?.clear()
    Keyboard.dismiss()

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageContent,
      images: imagesToSend.length > 0 ? imagesToSend : undefined,
    }
    setMessages((prev) => [...prev, userMessage])
    setIsLoading(true)

    try {
      const { getSupabaseFunctionBaseUrl } = await import(
        '@/lib/supabase-functions-client'
      )

      // Convert images to base64 if any
      const imageBase64Array: string[] = []
      if (imagesToSend.length > 0) {
        for (const imageUri of imagesToSend) {
          try {
            const base64 = await convertImageToBase64(imageUri)
            imageBase64Array.push(base64)
          } catch (error) {
            console.error('Error converting image:', error)
          }
        }
      }

      // Format messages for API - keep content as string
      const formattedMessages = [...messages, userMessage].map((m) => ({
        role: m.role,
        content: m.content,
      }))

      // Prepare request body with images as separate field
      const requestBody: any = {
        messages: formattedMessages,
        userId: user?.id,
        weightUnit,
      }

      // Add images array if present
      if (imageBase64Array.length > 0) {
        requestBody.images = imageBase64Array.map((base64) => ({
          type: 'image_url',
          image_url: {
            url: `data:image/jpeg;base64,${base64}`,
          },
        }))
      }

      const response = await fetch(`${getSupabaseFunctionBaseUrl()}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-no-stream': '1',
          ...(session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : {}),
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Chat API error:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText,
        })
        throw new Error(
          `Failed to get response: ${response.status} ${response.statusText}`,
        )
      }

      const assistantMessageId = (Date.now() + 1).toString()
      // create placeholder assistant message for streaming
      setMessages((prev) => [
        ...prev,
        { id: assistantMessageId, role: 'assistant', content: '' },
      ])

      const reader = response.body?.getReader()
      if (!reader) {
        // Fallback: non-streaming response
        const assistantContent = await response.text()
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessageId
              ? {
                  ...m,
                  content:
                    assistantContent ||
                    'I received an empty response. Please try again.',
                }
              : m,
          ),
        )
      } else {
        const decoder = new TextDecoder()
        let buffer = ''
        let acc = ''
        let ndjsonMode: boolean | null = null

        while (true) {
          const { value, done } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value, { stream: true })

          if (ndjsonMode === null) {
            const firstNonWs = chunk.trimStart()[0]
            ndjsonMode = firstNonWs === '{' || chunk.startsWith('data:')
          }

          if (!ndjsonMode) {
            // plain text mode
            acc += chunk
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMessageId ? { ...m, content: acc } : m,
              ),
            )
            continue
          }

          buffer += chunk
          let newlineIndex: number
          while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
            let line = buffer.slice(0, newlineIndex).trim()
            buffer = buffer.slice(newlineIndex + 1)

            if (!line) continue
            if (line.startsWith('data:')) line = line.slice(5).trim()
            if (!line || line === '[DONE]') continue

            try {
              const evt = JSON.parse(line)
              // Accept common shapes
              if (
                evt.type === 'text-delta' &&
                typeof evt.textDelta === 'string'
              ) {
                acc += evt.textDelta
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMessageId ? { ...m, content: acc } : m,
                  ),
                )
              } else if (
                evt.type === 'message' &&
                typeof evt.text === 'string'
              ) {
                acc += evt.text
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMessageId ? { ...m, content: acc } : m,
                  ),
                )
              } else {
                // ignore tool-call/tool-result/status events for now
              }
            } catch {
              // Not JSON, treat as plain text fragment
              acc += line
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMessageId ? { ...m, content: acc } : m,
                ),
              )
            }
          }
        }

        // flush any remaining buffer in NDJSON mode (may be a final partial JSON or text)
        if (buffer && ndjsonMode) {
          const line = buffer.trim()
          if (line && line !== '[DONE]') {
            try {
              const evt = JSON.parse(line)
              if (
                evt.type === 'text-delta' &&
                typeof evt.textDelta === 'string'
              ) {
                acc += evt.textDelta
              } else if (
                evt.type === 'message' &&
                typeof evt.text === 'string'
              ) {
                acc += evt.text
              } else if (typeof line === 'string') {
                acc += line
              }
            } catch {
              acc += line
            }
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMessageId ? { ...m, content: acc } : m,
              ),
            )
          }
        }
      }
    } catch (error) {
      console.error('Chat error:', error)
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'assistant',
          content: "Sorry, I couldn't process that request. Please try again.",
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const handleExampleQuestion = (question: string) => {
    // Check if user is pro member
    if (!isProMember) {
      setShowPaywall(true)
      trackEvent(AnalyticsEvents.PAYWALL_SHOWN, {
        feature: 'ai_chat',
      })
      return
    }

    setInput(question)
  }

  const styles = createStyles(colors)

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 120 : 0}
    >
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        showsVerticalScrollIndicator={false}
        automaticallyAdjustKeyboardInsets={false}
        onContentSizeChange={() => messages.length > 0 && scrollToBottom()}
      >
        {messages.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.welcomeSection}>
              <Ionicons
                name="chatbubbles-outline"
                size={64}
                color={colors.primary}
              />
              <Text style={styles.welcomeTitle}>
                Chat with Your Personal AI
              </Text>
            </View>

            <View style={styles.examplesContainer}>
              <View style={styles.examplesGrid}>
                {displayedExamples.map((example, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.exampleCard}
                    onPress={() => handleExampleQuestion(example.text)}
                  >
                    {example.requiresImage && (
                      <View style={styles.exampleIconContainer}>
                        <Ionicons
                          name="camera"
                          size={16}
                          color={colors.primary}
                        />
                      </View>
                    )}
                    <Text style={styles.exampleText}>{example.text}</Text>
                    <Ionicons
                      name="arrow-forward"
                      size={16}
                      color={colors.primary}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.chatMessages}>
            {messages.map((message) => (
              <View
                key={message.id}
                style={[
                  message.role === 'user'
                    ? styles.userMessageContainer
                    : styles.assistantMessageContainer,
                ]}
              >
                {message.role === 'user' ? (
                  <View style={styles.userMessageBubble}>
                    <View style={styles.userMessageContent}>
                      {/* Display images for user messages */}
                      {message.images && message.images.length > 0 && (
                        <View style={styles.messageImagesGrid}>
                          {message.images.map((imageUri, index) => (
                            <TouchableOpacity
                              key={index}
                              style={styles.messageImageThumbnail}
                              onPress={() => openImageViewer(message.images!, index)}
                            >
                              <Image
                                source={{ uri: imageUri }}
                                style={styles.messageImage}
                                resizeMode="cover"
                              />
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                      <Text style={styles.userMessageText}>
                        {message.content}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.assistantMessageContent}>
                    <Markdown
                      style={{
                        body: {
                          fontSize: 15,
                          lineHeight: 22,
                          color: colors.text,
                          margin: 0,
                        },
                        paragraph: {
                          marginTop: 0,
                          marginBottom: 12,
                        },
                        heading1: {
                          fontSize: 20,
                          fontWeight: '700',
                          color: colors.text,
                          marginTop: 16,
                          marginBottom: 8,
                        },
                        heading2: {
                          fontSize: 18,
                          fontWeight: '700',
                          color: colors.text,
                          marginTop: 14,
                          marginBottom: 6,
                        },
                        heading3: {
                          fontSize: 16,
                          fontWeight: '600',
                          color: colors.text,
                          marginTop: 12,
                          marginBottom: 6,
                        },
                        code_inline: {
                          backgroundColor: colors.backgroundLight,
                          paddingHorizontal: 4,
                          paddingVertical: 2,
                          borderRadius: 4,
                          fontSize: 14,
                          fontFamily:
                            Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                          color: colors.text,
                        },
                        code_block: {
                          backgroundColor: colors.backgroundLight,
                          padding: 12,
                          borderRadius: 8,
                          fontSize: 14,
                          fontFamily:
                            Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                          color: colors.text,
                          marginVertical: 8,
                          overflow: 'hidden',
                        },
                        fence: {
                          backgroundColor: colors.backgroundLight,
                          padding: 12,
                          borderRadius: 8,
                          fontSize: 14,
                          fontFamily:
                            Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                          color: colors.text,
                          marginVertical: 8,
                        },
                        strong: {
                          fontWeight: '600',
                          color: colors.text,
                        },
                        em: {
                          fontStyle: 'italic',
                        },
                        bullet_list: {
                          marginTop: 0,
                          marginBottom: 12,
                        },
                        ordered_list: {
                          marginTop: 0,
                          marginBottom: 12,
                        },
                        list_item: {
                          marginTop: 4,
                          marginBottom: 4,
                        },
                        hr: {
                          backgroundColor: colors.border,
                          height: 1,
                          marginVertical: 16,
                        },
                        blockquote: {
                          borderLeftWidth: 3,
                          borderLeftColor: colors.primary,
                          paddingLeft: 12,
                          marginVertical: 8,
                          backgroundColor: colors.backgroundLight,
                          paddingVertical: 8,
                          paddingRight: 8,
                        },
                        link: {
                          color: colors.primary,
                          textDecorationLine: 'underline',
                        },
                      }}
                    >
                      {message.content}
                    </Markdown>
                  </View>
                )}
              </View>
            ))}
            {isLoading && (
              <View style={styles.loadingMessageContainer}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Input Area */}
      <View style={styles.inputContainer}>
        {/* Image Thumbnails Preview */}
        {selectedImages.length > 0 && (
          <ScrollView
            horizontal
            style={styles.imagePreviewContainer}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.imagePreviewContent}
          >
            {selectedImages.map((imageUri, index) => (
              <View key={index} style={styles.imageThumbnailContainer}>
                <Image
                  source={{ uri: imageUri }}
                  style={styles.imageThumbnail}
                  resizeMode="cover"
                />
                <TouchableOpacity
                  style={styles.removeImageButton}
                  onPress={() => removeImage(index)}
                >
                  <Ionicons name="close" size={14} color={colors.white} />
                </TouchableOpacity>
              </View>
            ))}
            <View style={styles.imageCountBadge}>
              <Text style={styles.imageCountText}>
                {selectedImages.length}/{MAX_IMAGES}
              </Text>
            </View>
          </ScrollView>
        )}

        {/* Input Row */}
        <View style={styles.inputWrapper}>
          {/* Add Image Button */}
          <TouchableOpacity
            style={styles.addImageButton}
            onPress={() => setShowImagePickerModal(true)}
            disabled={isLoading}
          >
            <Ionicons
              name="add"
              size={20}
              color={isLoading ? colors.textPlaceholder : colors.primary}
            />
          </TouchableOpacity>

          {/* Text Input */}
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder="Ask about your workouts..."
            placeholderTextColor={colors.textPlaceholder}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={handleSendMessage}
            blurOnSubmit={false}
            editable={!isLoading}
          />

          {/* Send Button */}
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!input.trim() || isLoading) && styles.sendButtonDisabled,
            ]}
            onPress={handleSendMessage}
            disabled={!input.trim() || isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={colors.textPlaceholder} />
            ) : (
              <Ionicons
                name="send"
                size={20}
                color={input.trim() ? colors.white : colors.textPlaceholder}
              />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Paywall Modal */}
      <Paywall
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        title="Try Pro for FREE!"
        message="AI chat is a Pro feature"
      />

      {/* Image Picker Bottom Sheet */}
      <Modal
        visible={showImagePickerModal}
        transparent
        animationType="fade"
        onRequestClose={closeImagePickerSheet}
      >
        <GestureHandlerRootView style={styles.modalContainer}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={closeImagePickerSheet}
          >
            <View style={styles.modalBackdrop} />
          </Pressable>

          <GestureDetector gesture={pan}>
            <AnimatedReanimated.View
              style={[styles.bottomSheet, animatedBottomSheetStyle]}
            >
              <View style={styles.bottomSheetHandleContainer}>
                <View style={styles.bottomSheetHandle} />
              </View>
              <Text style={styles.bottomSheetTitle}>Add Image</Text>

              <TouchableOpacity
                style={styles.bottomSheetOption}
                onPress={launchCamera}
              >
                <View style={styles.bottomSheetOptionIcon}>
                  <Ionicons name="camera" size={24} color={colors.primary} />
                </View>
                <Text style={styles.bottomSheetOptionText}>Take Photo</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.bottomSheetOption}
                onPress={launchLibrary}
              >
                <View style={styles.bottomSheetOptionIcon}>
                  <Ionicons name="images" size={24} color={colors.primary} />
                </View>
                <Text style={styles.bottomSheetOptionText}>
                  Choose from Library
                </Text>
              </TouchableOpacity>
            </AnimatedReanimated.View>
          </GestureDetector>
        </GestureHandlerRootView>
      </Modal>

      {/* Image Viewer Modal */}
      <Modal
        visible={viewerImageIndex !== null}
        transparent
        animationType="fade"
        onRequestClose={closeImageViewer}
      >
        <View style={styles.imageViewerContainer}>
          <TouchableOpacity
            style={styles.imageViewerCloseButton}
            onPress={closeImageViewer}
          >
            <Ionicons name="close" size={28} color={colors.white} />
          </TouchableOpacity>

          {viewerImages.length > 0 && viewerImageIndex !== null && (
            <>
              <FlatList
                data={viewerImages}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                initialScrollIndex={viewerImageIndex}
                getItemLayout={(_, index) => ({
                  length: 400,
                  offset: 400 * index,
                  index,
                })}
                renderItem={({ item }) => (
                  <View style={styles.imageViewerSlide}>
                    <Image
                      source={{ uri: item }}
                      style={styles.imageViewerImage}
                      resizeMode="contain"
                    />
                  </View>
                )}
                keyExtractor={(_, index) => index.toString()}
              />

              {viewerImages.length > 1 && (
                <View style={styles.imageViewerCounter}>
                  <Text style={styles.imageViewerCounterText}>
                    {(viewerImageIndex + 1)} of {viewerImages.length}
                  </Text>
                </View>
              )}
            </>
          )}
        </View>
      </Modal>
    </KeyboardAvoidingView>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    messagesContainer: {
      flex: 1,
    },
    messagesContent: {
      flexGrow: 1,
      padding: 16,
      paddingBottom: 32,
    },
    emptyState: {
      flex: 1,
      justifyContent: 'center',
      paddingBottom: 60,
    },
    welcomeSection: {
      alignItems: 'center',
      marginBottom: 24,
      marginTop: 20,
    },
    welcomeTitle: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text,
      marginTop: 16,
      marginBottom: 8,
    },
    welcomeSubtitle: {
      fontSize: 15,
      color: colors.textSecondary,
      textAlign: 'center',
      paddingHorizontal: 32,
    },
    examplesContainer: {
      marginTop: 8,
    },
    examplesTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 12,
    },
    examplesGrid: {
      gap: 8,
    },
    exampleCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.white,
      padding: 16,
      borderRadius: 9999,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    exampleIconContainer: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.primaryLight
        ? `${colors.primaryLight}40`
        : `${colors.primary}15`,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 8,
    },
    exampleText: {
      fontSize: 15,
      color: colors.text,
      flex: 1,
      marginRight: 12,
    },
    chatMessages: {
      gap: 24,
    },
    userMessageContainer: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'flex-start',
    },
    assistantMessageContainer: {
      flexDirection: 'row',
      justifyContent: 'flex-start',
      alignItems: 'flex-start',
    },
    userMessageBubble: {
      maxWidth: '80%',
    },
    userMessageContent: {
      backgroundColor: colors.primary,
      padding: 12,
      borderRadius: 16,
      borderBottomRightRadius: 4,
    },
    userMessageText: {
      fontSize: 15,
      lineHeight: 20,
      color: colors.white,
    },
    assistantMessageContent: {
      flex: 1,
      paddingVertical: 4,
    },
    inputContainer: {
      backgroundColor: colors.white,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 40, // Account for bottom tab bar
    },
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 8,
    },
    input: {
      flex: 1,
      backgroundColor: colors.backgroundLight,
      borderRadius: 9999,
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 10,
      fontSize: 15,
      lineHeight: 20,
      color: colors.text,
      maxHeight: 100,
      textAlignVertical: 'center',
    },
    sendButton: {
      width: 40,
      height: 40,
      borderRadius: 9999,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    sendButtonDisabled: {
      backgroundColor: colors.backgroundLight,
    },
    loadingMessageContainer: {
      flexDirection: 'row',
      justifyContent: 'flex-start',
      alignItems: 'center',
      paddingVertical: 8,
    },
    loadingText: {
      fontSize: 14,
      color: colors.textSecondary,
      fontStyle: 'italic',
    },
    // Image preview in input area
    imagePreviewContainer: {
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 8,
    },
    imagePreviewContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    imageThumbnailContainer: {
      position: 'relative',
    },
    imageThumbnail: {
      width: 60,
      height: 60,
      borderRadius: 8,
    },
    removeImageButton: {
      position: 'absolute',
      top: -6,
      right: -6,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: colors.error || '#FF3B30',
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 2,
      elevation: 2,
    },
    imageCountBadge: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: colors.backgroundLight,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    imageCountText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    addImageButton: {
      width: 40,
      height: 40,
      borderRadius: 9999,
      backgroundColor: colors.backgroundLight,
      justifyContent: 'center',
      alignItems: 'center',
    },
    // Images in messages
    messageImagesGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 4,
      marginBottom: 8,
    },
    messageImageThumbnail: {
      width: 80,
      height: 80,
      borderRadius: 8,
      overflow: 'hidden',
    },
    messageImage: {
      width: '100%',
      height: '100%',
    },
    // Bottom sheet modal
    modalContainer: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    modalBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    bottomSheet: {
      backgroundColor: colors.white,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingBottom: 32,
      paddingHorizontal: 16,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 12,
    },
    bottomSheetHandleContainer: {
      alignItems: 'center',
      paddingTop: 12,
      paddingBottom: 4,
    },
    bottomSheetHandle: {
      width: 36,
      height: 4,
      backgroundColor: colors.border,
      borderRadius: 2,
    },
    bottomSheetTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 16,
      textAlign: 'center',
    },
    bottomSheetOption: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      backgroundColor: colors.backgroundLight,
      borderRadius: 12,
      marginBottom: 8,
    },
    bottomSheetOptionIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.white,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    bottomSheetOptionText: {
      fontSize: 16,
      fontWeight: '500',
      color: colors.text,
    },
    // Image viewer modal
    imageViewerContainer: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.95)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    imageViewerCloseButton: {
      position: 'absolute',
      top: 50,
      right: 20,
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 10,
    },
    imageViewerSlide: {
      width: 400,
      height: 400,
      justifyContent: 'center',
      alignItems: 'center',
    },
    imageViewerImage: {
      width: '100%',
      height: '100%',
    },
    imageViewerCounter: {
      position: 'absolute',
      bottom: 50,
      alignSelf: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 16,
    },
    imageViewerCounterText: {
      color: colors.white,
      fontSize: 14,
      fontWeight: '600',
    },
  })
