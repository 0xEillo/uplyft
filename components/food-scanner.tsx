import { Ionicons } from '@expo/vector-icons'
import { CameraView, useCameraPermissions } from 'expo-camera'
import * as ImagePicker from 'expo-image-picker'
import React, { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useThemedColors } from '@/hooks/useThemedColors'

// Supported scanner modes inline with Rep AI
export type ScannerMode = 'scan_food' | 'barcode' | 'food_label'

interface FoodScannerProps {
  visible: boolean
  onClose: () => void
  onScanFood: (imageUri: string) => void
  onScanBarcode: (productData: any) => void
  onScanFoodLabel?: (imageUri: string) => void
}

export function FoodScannerModal({
  visible,
  onClose,
  onScanFood,
  onScanBarcode,
  onScanFoodLabel,
}: FoodScannerProps) {
  const themedColors = useThemedColors()
  const insets = useSafeAreaInsets()
  const colors = {
    ...themedColors,
    // Provide explicit transparent grays for camera overlays
    overlayAction: 'rgba(255,255,255,0.15)',
    overlayActionActive: 'rgba(255,255,255,0.3)',
    overlayText: '#FFFFFF',
  }
  const styles = createStyles(colors)

  const [cameraPermission, requestCameraPermission] = useCameraPermissions()
  const [activeMode, setActiveMode] = useState<ScannerMode>('scan_food')
  const [flash, setFlash] = useState<'off' | 'on'>('off')
  const [isProcessing, setIsProcessing] = useState(false)
  const cameraRef = useRef<CameraView>(null)

  // Barcode detatch to prevent multiple scans
  const isScanningBarcodeRef = useRef(false)

  useEffect(() => {
    if (
      visible &&
      !cameraPermission?.granted &&
      cameraPermission?.canAskAgain
    ) {
      requestCameraPermission()
    }
  }, [visible, cameraPermission, requestCameraPermission])

  const toggleFlash = () => {
    setFlash((prev) => (prev === 'off' ? 'on' : 'off'))
  }

  const handleCapture = async () => {
    if (activeMode === 'barcode') return
    if (!cameraRef.current || isProcessing) return

    setIsProcessing(true)
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        base64: false,
      })
      if (photo?.uri) {
        if (activeMode === 'food_label') {
          onScanFoodLabel?.(photo.uri)
        } else {
          onScanFood(photo.uri)
        }
      }
    } catch (err) {
      console.error('Failed to capture photo:', err)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleGalleryPick = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        quality: 0.9,
      })

      if (!result.canceled && result.assets[0]?.uri) {
        if (activeMode === 'food_label') {
          onScanFoodLabel?.(result.assets[0].uri)
        } else {
          onScanFood(result.assets[0].uri)
        }
      }
    } catch (error) {
      console.error('Error selecting image:', error)
    }
  }

  const handleBarcodeScanned = async ({
    type,
    data,
  }: {
    type: string
    data: string
  }) => {
    if (
      activeMode !== 'barcode' ||
      isScanningBarcodeRef.current ||
      isProcessing
    )
      return

    isScanningBarcodeRef.current = true
    setIsProcessing(true)

    try {
      // Fetch open food facts
      const res = await fetch(
        `https://world.openfoodfacts.org/api/v2/product/${data}.json`,
      )
      const responseData = await res.json()

      if (responseData.status === 1 && responseData.product) {
        onScanBarcode(responseData.product)
      } else {
        // Fallback: Just return the raw code if not found so the parent can handle it
        onScanBarcode({ code: data, not_found: true })
      }
    } catch (error) {
      console.error('Barcode lookup failed', error)
      onScanBarcode({ code: data, error: true })
    } finally {
      setIsProcessing(false)
      // Small timeout to prevent rapid-fire scans
      setTimeout(() => {
        isScanningBarcodeRef.current = false
      }, 2000)
    }
  }

  if (!cameraPermission?.granted) {
    return (
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="fullScreen"
      >
        <View
          style={[
            styles.permissionContainer,
            { paddingTop: insets.top, paddingBottom: insets.bottom },
          ]}
        >
          <Text style={styles.permissionText}>
            We need your permission to show the camera.
          </Text>
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={requestCameraPermission}
          >
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.closeButtonCenter} onPress={onClose}>
            <Text style={styles.permissionButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    )
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
    >
      <View style={styles.container}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="back"
          enableTorch={flash === 'on'}
          barcodeScannerSettings={{
            barcodeTypes: ['upc_a', 'upc_e', 'ean13', 'ean8', 'qr'],
          }}
          onBarcodeScanned={
            activeMode === 'barcode' ? handleBarcodeScanned : undefined
          }
        >
          {/* Top Bar Overlay */}
          <View
            style={[
              styles.safeArea,
              {
                paddingTop:
                  Platform.OS === 'android'
                    ? Math.max(insets.top, 40)
                    : Math.max(insets.top, 20),
                paddingBottom: Math.max(insets.bottom, 20),
              },
            ]}
          >
            <View style={styles.topBar}>
              <View style={styles.logoContainer}>
                <Ionicons
                  name="nutrition"
                  size={20}
                  color={colors.overlayText}
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.logoText}>Rep AI</Text>
              </View>

              <TouchableOpacity onPress={onClose} style={styles.iconButton}>
                <Ionicons name="close" size={24} color={colors.overlayText} />
              </TouchableOpacity>
            </View>

            {/* Middle Viewfinder / Scanning Area */}
            <View style={styles.middleContainer}>
              {isProcessing && (
                <View style={styles.processingOverlay}>
                  <ActivityIndicator size="large" color="#FFFFFF" />
                </View>
              )}
              {activeMode === 'barcode' && !isProcessing && (
                <View style={styles.barcodeFinder}>
                  <View style={[styles.corner, styles.cornerTL]} />
                  <View style={[styles.corner, styles.cornerTR]} />
                  <View style={[styles.corner, styles.cornerBL]} />
                  <View style={[styles.corner, styles.cornerBR]} />
                  <Text style={styles.barcodeHintText}>
                    Align barcode within frame
                  </Text>
                </View>
              )}
              {activeMode === 'food_label' && !isProcessing && (
                <View style={styles.labelFinder}>
                  <View style={[styles.corner, styles.cornerTL]} />
                  <View style={[styles.corner, styles.cornerTR]} />
                  <View style={[styles.corner, styles.cornerBL]} />
                  <View style={[styles.corner, styles.cornerBR]} />
                  <Text style={styles.barcodeHintText}>
                    Align nutrition label within frame
                  </Text>
                </View>
              )}
            </View>

            {/* Bottom Controls Area */}
            <View style={styles.bottomControls}>
              {/* Segmented Modes */}
              <View style={styles.segmentedControl}>
                <TouchableOpacity
                  style={[
                    styles.segmentButton,
                    activeMode === 'scan_food' && styles.segmentButtonActive,
                  ]}
                  onPress={() => setActiveMode('scan_food')}
                >
                  <Ionicons
                    name="scan-outline"
                    size={20}
                    color={activeMode === 'scan_food' ? '#000' : '#FFF'}
                  />
                  <Text
                    style={[
                      styles.segmentText,
                      activeMode === 'scan_food' && styles.segmentTextActive,
                    ]}
                  >
                    Scan Food
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.segmentButton,
                    activeMode === 'barcode' && styles.segmentButtonActive,
                  ]}
                  onPress={() => setActiveMode('barcode')}
                >
                  <Ionicons
                    name="barcode-outline"
                    size={20}
                    color={activeMode === 'barcode' ? '#000' : '#FFF'}
                  />
                  <Text
                    style={[
                      styles.segmentText,
                      activeMode === 'barcode' && styles.segmentTextActive,
                    ]}
                  >
                    Barcode
                  </Text>
                </TouchableOpacity>

                {/* Just for aesthetic parity */}
                <TouchableOpacity
                  style={[
                    styles.segmentButton,
                    activeMode === 'food_label' && styles.segmentButtonActive,
                  ]}
                  onPress={() => setActiveMode('food_label')}
                >
                  <Ionicons
                    name="list-outline"
                    size={20}
                    color={activeMode === 'food_label' ? '#000' : '#FFF'}
                  />
                  <Text
                    style={[
                      styles.segmentText,
                      activeMode === 'food_label' && styles.segmentTextActive,
                    ]}
                  >
                    Food Label
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Shutter & Icons */}
              <View style={styles.captureRow}>
                <TouchableOpacity
                  onPress={toggleFlash}
                  style={styles.sideButton}
                >
                  <Ionicons
                    name={flash === 'on' ? 'flash' : 'flash-off'}
                    size={24}
                    color={colors.overlayText}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.captureButtonOuter,
                    activeMode === 'barcode' && { opacity: 0.3 },
                  ]}
                  onPress={handleCapture}
                  disabled={activeMode === 'barcode'}
                >
                  <View style={styles.captureButtonInner} />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleGalleryPick}
                  style={styles.sideButton}
                >
                  <Ionicons
                    name="image-outline"
                    size={24}
                    color={colors.overlayText}
                  />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </CameraView>
      </View>

    </Modal>
  )
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#000',
    },
    camera: {
      flex: 1,
    },
    safeArea: {
      flex: 1,
      justifyContent: 'space-between',
    },
    permissionContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#000',
    },
    permissionText: {
      color: '#FFF',
      fontSize: 16,
      marginBottom: 20,
    },
    permissionButton: {
      backgroundColor: colors.brandPrimary,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 12,
      marginBottom: 16,
    },
    permissionButtonText: {
      color: '#FFF',
      fontWeight: '600',
      fontSize: 16,
    },
    closeButtonCenter: {
      padding: 12,
    },
    topBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 10,
    },
    iconButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.overlayAction,
      justifyContent: 'center',
      alignItems: 'center',
    },
    logoContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    logoText: {
      color: colors.overlayText,
      fontSize: 20,
      fontWeight: '700',
      letterSpacing: -0.5,
    },
    middleContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    processingOverlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.3)',
      borderRadius: 16,
    },
    barcodeFinder: {
      width: 250,
      height: 150,
      justifyContent: 'center',
      alignItems: 'center',
      position: 'relative',
    },
    labelFinder: {
      width: 280,
      height: 200,
      justifyContent: 'center',
      alignItems: 'center',
      position: 'relative',
    },
    barcodeHintText: {
      color: '#FFF',
      fontSize: 14,
      fontWeight: '500',
      textShadowColor: 'rgba(0,0,0,0.5)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 3,
    },
    corner: {
      position: 'absolute',
      width: 30,
      height: 30,
      borderColor: colors.brandPrimary || '#FFFFFF',
    },
    cornerTL: {
      top: 0,
      left: 0,
      borderTopWidth: 4,
      borderLeftWidth: 4,
      borderTopLeftRadius: 12,
    },
    cornerTR: {
      top: 0,
      right: 0,
      borderTopWidth: 4,
      borderRightWidth: 4,
      borderTopRightRadius: 12,
    },
    cornerBL: {
      bottom: 0,
      left: 0,
      borderBottomWidth: 4,
      borderLeftWidth: 4,
      borderBottomLeftRadius: 12,
    },
    cornerBR: {
      bottom: 0,
      right: 0,
      borderBottomWidth: 4,
      borderRightWidth: 4,
      borderBottomRightRadius: 12,
    },
    bottomControls: {
      paddingHorizontal: 20,
      alignItems: 'center',
      gap: 30,
    },
    segmentedControl: {
      flexDirection: 'row',
      backgroundColor: 'rgba(0,0,0,0.5)',
      borderRadius: 30,
      padding: 4,
    },
    segmentButton: {
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 26,
      gap: 4,
    },
    segmentButtonActive: {
      backgroundColor: '#FFFFFF',
    },
    segmentText: {
      color: '#FFFFFF',
      fontSize: 11,
      fontWeight: '600',
    },
    segmentTextActive: {
      color: '#000000',
    },
    captureRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
      paddingHorizontal: 30,
    },
    sideButton: {
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor: colors.overlayAction,
      justifyContent: 'center',
      alignItems: 'center',
    },
    captureButtonOuter: {
      width: 80,
      height: 80,
      borderRadius: 40,
      borderWidth: 4,
      borderColor: '#FFFFFF',
      justifyContent: 'center',
      alignItems: 'center',
    },
    captureButtonInner: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: '#FFFFFF',
    },
  })
