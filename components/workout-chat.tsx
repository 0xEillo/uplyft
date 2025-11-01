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
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import Markdown from 'react-native-markdown-display'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

const EXAMPLE_QUESTIONS = [
  "What's my 1 rep max for squat?",
  "What's my strongest exercise?",
  "How's my strength trending?",
  'Where do I rank on bench?',
  'What muscle groups am I neglecting?',
]

export function WorkoutChat() {
  const scrollViewRef = useRef<ScrollView>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showPaywall, setShowPaywall] = useState(false)
  const { user, session } = useAuth()
  const { isProMember } = useSubscription()
  const { trackEvent } = useAnalytics()
  const colors = useThemedColors()
  const { weightUnit } = useWeightUnits()

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

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
    }

    setInput('')
    setMessages((prev) => [...prev, userMessage])
    setIsLoading(true)

    try {
      const { getSupabaseFunctionBaseUrl } = await import(
        '@/lib/supabase-functions-client'
      )

      const response = await fetch(`${getSupabaseFunctionBaseUrl()}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-no-stream': '1',
          ...(session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : {}),
        },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          userId: user?.id,
          weightUnit,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to get response')
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
      keyboardVerticalOffset={Platform.OS === 'ios' ? 110 : 0}
    >
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        showsVerticalScrollIndicator={false}
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
                {EXAMPLE_QUESTIONS.map((question, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.exampleCard}
                    onPress={() => handleExampleQuestion(question)}
                  >
                    <Text style={styles.exampleText}>{question}</Text>
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
                  styles.messageBubble,
                  message.role === 'user'
                    ? styles.userMessage
                    : styles.assistantMessage,
                ]}
              >
                {message.role === 'assistant' && (
                  <View style={styles.aiAvatar}>
                    <Ionicons name="flash" size={16} color={colors.white} />
                  </View>
                )}
                <View
                  style={[
                    styles.messageContent,
                    message.role === 'user'
                      ? styles.userMessageContent
                      : styles.assistantMessageContent,
                  ]}
                >
                  {message.role === 'assistant' ? (
                    <Markdown
                      style={{
                        body: {
                          fontSize: 15,
                          lineHeight: 20,
                          color: colors.text,
                          margin: 0,
                        },
                        paragraph: {
                          marginTop: 0,
                          marginBottom: 0,
                        },
                        code_inline: {
                          backgroundColor: colors.backgroundLight,
                          paddingHorizontal: 4,
                          paddingVertical: 2,
                          borderRadius: 4,
                          fontSize: 14,
                          fontFamily:
                            Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                        },
                        code_block: {
                          backgroundColor: colors.backgroundLight,
                          padding: 12,
                          borderRadius: 8,
                          fontSize: 14,
                          fontFamily:
                            Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                        },
                        strong: {
                          fontWeight: '600',
                        },
                        em: {
                          fontStyle: 'italic',
                        },
                        bullet_list: {
                          marginTop: 0,
                          marginBottom: 0,
                        },
                        ordered_list: {
                          marginTop: 0,
                          marginBottom: 0,
                        },
                        list_item: {
                          marginTop: 0,
                          marginBottom: 0,
                        },
                      }}
                    >
                      {message.content}
                    </Markdown>
                  ) : (
                    <Text
                      style={[
                        styles.messageText,
                        message.role === 'user' && styles.userMessageText,
                      ]}
                    >
                      {message.content}
                    </Text>
                  )}
                </View>
              </View>
            ))}
            {isLoading && (
              <View style={styles.loadingMessageContainer}>
                <View style={styles.aiAvatar}>
                  <Ionicons name="flash" size={16} color={colors.white} />
                </View>
                <View style={styles.loadingBubble}>
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Input Area */}
      <View style={styles.inputContainer}>
        <View style={styles.inputWrapper}>
          <TextInput
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
        title="AI Chat is Premium"
        message="Chat with your personal AI assistant to analyze your workouts and get insights. Subscribe to unlock this feature."
      />
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
      paddingBottom: 24,
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
    exampleText: {
      fontSize: 15,
      color: colors.text,
      flex: 1,
      marginRight: 12,
    },
    chatMessages: {
      gap: 16,
    },
    messageBubble: {
      flexDirection: 'row',
      gap: 8,
    },
    userMessage: {
      justifyContent: 'flex-end',
    },
    assistantMessage: {
      justifyContent: 'flex-start',
    },
    aiAvatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      alignSelf: 'flex-end',
    },
    messageContent: {
      maxWidth: '80%',
      padding: 12,
      borderRadius: 9999,
    },
    userMessageContent: {
      backgroundColor: colors.primary,
    },
    assistantMessageContent: {
      backgroundColor: colors.white,
      borderWidth: 1,
      borderColor: colors.border,
    },
    messageText: {
      fontSize: 15,
      lineHeight: 20,
      color: colors.text,
    },
    userMessageText: {
      color: colors.white,
    },
    inputContainer: {
      backgroundColor: colors.white,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 12,
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
      gap: 8,
      marginTop: 16,
    },
    loadingBubble: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.white,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 9999,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    loadingText: {
      fontSize: 14,
      color: colors.textSecondary,
      fontStyle: 'italic',
    },
  })
