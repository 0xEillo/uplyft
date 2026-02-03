import SwiftUI
import WidgetKit
import os.log

#if canImport(ActivityKit)

  private let logger = Logger(subsystem: "com.repai.liveactivity", category: "Widget")

  struct ConditionalForegroundViewModifier: ViewModifier {
    let color: String?

    func body(content: Content) -> some View {
      if let color = color {
        content.foregroundStyle(Color(hex: color))
      } else {
        content
      }
    }
  }

  // Helper to extract just the timer part from subtitle like "0:30 • Rep AI" -> "0:30"
  private func extractTimer(from subtitle: String?) -> String {
    let _ = logger.info("[LA] LiveActivityView.extractTimer called with subtitle=\(subtitle ?? "nil", privacy: .public)")
    
    guard let subtitle = subtitle else {
      let _ = logger.warning("[LA] LiveActivityView.extractTimer: subtitle is nil, returning --:--")
      return "--:--"
    }
    
    if let range = subtitle.range(of: " • ") {
      let extracted = String(subtitle[..<range.lowerBound])
      let _ = logger.info("[LA] LiveActivityView.extractTimer: found separator, extracted=\(extracted, privacy: .public) from full=\(subtitle, privacy: .public)")
      return extracted
    }
    
    let _ = logger.info("[LA] LiveActivityView.extractTimer: no separator found, returning full subtitle=\(subtitle, privacy: .public)")
    return subtitle
  }

  struct LiveActivityView: View {
    let contentState: LiveActivityAttributes.ContentState
    let attributes: LiveActivityAttributes
    @State private var imageContainerSize: CGSize?

    var progressViewTint: Color? {
      attributes.progressViewTint.map { Color(hex: $0) }
    }

    private var imageAlignment: Alignment {
      switch attributes.imageAlign {
      case "center":
        return .center
      case "bottom":
        return .bottom
      default:
        return .top
      }
    }

    private func alignedImage(imageName: String) -> some View {
      let defaultHeight: CGFloat = 64
      let defaultWidth: CGFloat = 64
      let containerHeight = imageContainerSize?.height
      let containerWidth = imageContainerSize?.width
      let hasWidthConstraint = (attributes.imageWidthPercent != nil) || (attributes.imageWidth != nil)

      let computedHeight: CGFloat? = {
        if let percent = attributes.imageHeightPercent {
          let clamped = min(max(percent, 0), 100) / 100.0
          let base = (containerHeight ?? defaultHeight)
          return base * clamped
        } else if let size = attributes.imageHeight {
          return CGFloat(size)
        } else if hasWidthConstraint {
          return nil
        } else {
          return defaultHeight
        }
      }()

      let computedWidth: CGFloat? = {
        if let percent = attributes.imageWidthPercent {
          let clamped = min(max(percent, 0), 100) / 100.0
          let base = (containerWidth ?? defaultWidth)
          return base * clamped
        } else if let size = attributes.imageWidth {
          return CGFloat(size)
        } else {
          return nil
        }
      }()

      return ZStack(alignment: .center) {
        Group {
          let fit = attributes.contentFit ?? "cover"
          switch fit {
          case "contain":
            Image.dynamic(assetNameOrPath: imageName).resizable().scaledToFit().frame(width: computedWidth, height: computedHeight)
          case "fill":
            Image.dynamic(assetNameOrPath: imageName).resizable().frame(
              width: computedWidth,
              height: computedHeight
            )
          case "none":
            Image.dynamic(assetNameOrPath: imageName).renderingMode(.original).frame(width: computedWidth, height: computedHeight)
          case "scale-down":
            if let uiImage = UIImage.dynamic(assetNameOrPath: imageName) {
              let targetHeight = computedHeight ?? uiImage.size.height
              let targetWidth = computedWidth ?? uiImage.size.width
              let shouldScaleDown = uiImage.size.height > targetHeight || uiImage.size.width > targetWidth

              if shouldScaleDown {
                Image(uiImage: uiImage)
                  .resizable()
                  .scaledToFit()
                  .frame(width: computedWidth, height: computedHeight)
              } else {
                Image(uiImage: uiImage)
                  .renderingMode(.original)
                  .frame(width: min(uiImage.size.width, targetWidth), height: min(uiImage.size.height, targetHeight))
              }
            }
          case "cover":
            Image.dynamic(assetNameOrPath: imageName).resizable().scaledToFill().frame(
              width: computedWidth,
              height: computedHeight
            ).clipped()
          default:
            EmptyView()
          }
        }
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: imageAlignment)
      .background(
        GeometryReader { proxy in
          Color.clear
            .onAppear {
              let s = proxy.size
              if s.width > 0, s.height > 0 { imageContainerSize = s }
            }
            .onChange(of: proxy.size) { s in
              if s.width > 0, s.height > 0 { imageContainerSize = s }
            }
        }
      )
    }

    var body: some View {
      let _ = logger.info("[LA] ===== LiveActivityView.body RENDER ======")
      let _ = logger.info("[LA] LiveActivityView title=\(contentState.title, privacy: .public)")
      let _ = logger.info("[LA] LiveActivityView subtitle=\(contentState.subtitle ?? "nil", privacy: .public)")
      let _ = logger.info("[LA] LiveActivityView imageName=\(contentState.imageName ?? "nil", privacy: .public)")
      let _ = logger.info("[LA] LiveActivityView dynamicIslandImageName=\(contentState.dynamicIslandImageName ?? "nil", privacy: .public)")
      let _ = logger.info("[LA] LiveActivityView backgroundColor=\(attributes.backgroundColor ?? "nil", privacy: .public)")
      let _ = logger.info("[LA] LiveActivityView titleColor=\(attributes.titleColor ?? "nil", privacy: .public)")
      let _ = logger.info("[LA] LiveActivityView subtitleColor=\(attributes.subtitleColor ?? "nil", privacy: .public)")
      let _ = logger.info("[LA] LiveActivityView deepLinkUrl=\(attributes.deepLinkUrl ?? "nil", privacy: .public)")
      
      let extractedTimer = extractTimer(from: contentState.subtitle)
      let _ = logger.info("[LA] LiveActivityView extractedTimer=\(extractedTimer, privacy: .public)")
      
      let defaultPadding = 24

      let top = CGFloat(
        attributes.paddingDetails?.top
          ?? attributes.paddingDetails?.vertical
          ?? attributes.padding
          ?? defaultPadding
      )

      let bottom = CGFloat(
        attributes.paddingDetails?.bottom
          ?? attributes.paddingDetails?.vertical
          ?? attributes.padding
          ?? defaultPadding
      )

      let leading = CGFloat(
        attributes.paddingDetails?.left
          ?? attributes.paddingDetails?.horizontal
          ?? attributes.padding
          ?? defaultPadding
      )

      let trailing = CGFloat(
        attributes.paddingDetails?.right
          ?? attributes.paddingDetails?.horizontal
          ?? attributes.padding
          ?? defaultPadding
      )

      VStack(alignment: .leading, spacing: 12) {
        let position = attributes.imagePosition ?? "right"
        let isLeftImage = position.hasPrefix("left")
        let hasImage = contentState.imageName != nil

        // Top row: Title left, optional image right
        HStack(alignment: .center) {
          if hasImage, isLeftImage {
            if let imageName = contentState.imageName {
              alignedImage(imageName: imageName)
            }
          }

          VStack(alignment: .leading, spacing: 2) {
            Text(contentState.title)
              .font(.title2)
              .fontWeight(.semibold)
              .modifier(ConditionalForegroundViewModifier(color: attributes.titleColor))

            Text("Workout Active")
              .font(.subheadline)
              .modifier(ConditionalForegroundViewModifier(color: attributes.subtitleColor))
          }.layoutPriority(1)

          if hasImage, !isLeftImage {
            Spacer()
            if let imageName = contentState.imageName {
              alignedImage(imageName: imageName)
            }
          }
        }

        // Center: Big timer display
        HStack {
          Spacer()
          Text(extractedTimer)
            .font(.system(size: 48, weight: .bold, design: .monospaced))
            .modifier(ConditionalForegroundViewModifier(color: attributes.titleColor))
          Spacer()
        }

        // Bottom: Add exercise button
        if let deepLinkUrl = attributes.deepLinkUrl,
           let url = URL(string: deepLinkUrl) {
          Link(destination: url) {
            Text("Add exercise +")
              .font(.system(size: 15, weight: .semibold))
              .foregroundStyle(Color.black)
              .padding(.vertical, 10)
              .padding(.horizontal, 16)
              .frame(maxWidth: .infinity)
              .background(Color.white.opacity(0.9))
              .clipShape(Capsule())
          }
        } else {
          Text("Add exercise +")
            .font(.system(size: 15, weight: .semibold))
            .foregroundStyle(Color.black)
            .padding(.vertical, 10)
            .padding(.horizontal, 16)
            .frame(maxWidth: .infinity)
            .background(Color.white.opacity(0.9))
            .clipShape(Capsule())
        }
      }
      .padding(EdgeInsets(top: top, leading: leading, bottom: bottom, trailing: trailing))
    }
  }

#endif
