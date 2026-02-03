import ActivityKit
import SwiftUI
import WidgetKit
import os.log

private let logger = Logger(subsystem: "com.repai.liveactivity", category: "Widget")

struct LiveActivityAttributes: ActivityAttributes {
  struct ContentState: Codable, Hashable {
    var title: String
    var subtitle: String?
    var timerEndDateInMilliseconds: Double?
    var progress: Double?
    var imageName: String?
    var dynamicIslandImageName: String?
  }

  var name: String
  var backgroundColor: String?
  var titleColor: String?
  var subtitleColor: String?
  var progressViewTint: String?
  var progressViewLabelColor: String?
  var deepLinkUrl: String?
  var timerType: DynamicIslandTimerType?
  var padding: Int?
  var paddingDetails: PaddingDetails?
  var imagePosition: String?
  var imageWidth: Int?
  var imageHeight: Int?
  var imageWidthPercent: Double?
  var imageHeightPercent: Double?
  var imageAlign: String?
  var contentFit: String?

  enum DynamicIslandTimerType: String, Codable {
    case circular
    case digital
  }

  struct PaddingDetails: Codable, Hashable {
    var top: Int?
    var bottom: Int?
    var left: Int?
    var right: Int?
    var vertical: Int?
    var horizontal: Int?
  }
}

// Helper to extract just the timer part from subtitle like "0:30 • Rep AI" -> "0:30"
private func extractTimer(from subtitle: String?) -> String {
  let _ = logger.info("[LA] extractTimer called with subtitle=\(subtitle ?? "nil", privacy: .public)")
  
  guard let subtitle = subtitle else {
    let _ = logger.warning("[LA] extractTimer: subtitle is nil, returning --:--")
    return "--:--"
  }
  
  // Split by " • " and take first part
  if let range = subtitle.range(of: " • ") {
    let extracted = String(subtitle[..<range.lowerBound])
    let _ = logger.info("[LA] extractTimer: found separator, extracted=\(extracted, privacy: .public) from full=\(subtitle, privacy: .public)")
    return extracted
  }
  
  // If no separator, return whole subtitle (might just be the time)
  let _ = logger.info("[LA] extractTimer: no separator found, returning full subtitle=\(subtitle, privacy: .public)")
  return subtitle
}

struct LiveActivityWidget: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: LiveActivityAttributes.self) { context in
      let _ = logger.info("[LA] ===== LOCKScreen RENDER ======")
      let _ = logger.info("[LA] lockscreen title=\(context.state.title, privacy: .public)")
      let _ = logger.info("[LA] lockscreen subtitle=\(context.state.subtitle ?? "nil", privacy: .public)")
      let _ = logger.info("[LA] lockscreen imageName=\(context.state.imageName ?? "nil", privacy: .public)")
      let _ = logger.info("[LA] lockscreen dynamicIslandImageName=\(context.state.dynamicIslandImageName ?? "nil", privacy: .public)")
      let _ = logger.info("[LA] lockscreen timerEndDateInMilliseconds=\(context.state.timerEndDateInMilliseconds ?? 0, privacy: .public)")
      let _ = logger.info("[LA] lockscreen timerType=\(context.attributes.timerType?.rawValue ?? "nil", privacy: .public)")
      let _ = logger.info("[LA] lockscreen deepLinkUrl=\(context.attributes.deepLinkUrl ?? "nil", privacy: .public)")
      
      let extractedTimer = extractTimer(from: context.state.subtitle)
      let _ = logger.info("[LA] lockscreen extractedTimer=\(extractedTimer, privacy: .public)")
      
      LiveActivityView(contentState: context.state, attributes: context.attributes)
        .activityBackgroundTint(
          context.attributes.backgroundColor.map { Color(hex: $0) }
        )
        .activitySystemActionForegroundColor(Color.black)
        .applyWidgetURL(from: context.attributes.deepLinkUrl)
    } dynamicIsland: { context in
      let _ = logger.info("[LA] ===== DYNAMIC ISLAND RENDER ======")
      let _ = logger.info("[LA] island title=\(context.state.title, privacy: .public)")
      let _ = logger.info("[LA] island subtitle=\(context.state.subtitle ?? "nil", privacy: .public)")
      let _ = logger.info("[LA] island imageName=\(context.state.imageName ?? "nil", privacy: .public)")
      let _ = logger.info("[LA] island dynamicIslandImageName=\(context.state.dynamicIslandImageName ?? "nil", privacy: .public)")
      let _ = logger.info("[LA] island timerEndDateInMilliseconds=\(context.state.timerEndDateInMilliseconds ?? 0, privacy: .public)")
      let _ = logger.info("[LA] island timerType=\(context.attributes.timerType?.rawValue ?? "nil", privacy: .public)")
      let _ = logger.info("[LA] island deepLinkUrl=\(context.attributes.deepLinkUrl ?? "nil", privacy: .public)")
      
      let extractedTimer = extractTimer(from: context.state.subtitle)
      let _ = logger.info("[LA] island extractedTimer=\(extractedTimer, privacy: .public)")

      return DynamicIsland {
        DynamicIslandExpandedRegion(.leading, priority: 1) {
          let _ = logger.info("[LA] island expandedLeading rendering")
          dynamicIslandExpandedLeading(title: context.state.title, subtitle: context.state.subtitle)
            .dynamicIsland(verticalPlacement: .belowIfTooWide)
            .padding(.leading, 5)
            .applyWidgetURL(from: context.attributes.deepLinkUrl)
        }
        DynamicIslandExpandedRegion(.trailing) {
          let _ = logger.info("[LA] island expandedTrailing rendering, imageName=\(context.state.imageName ?? "nil", privacy: .public)")
          if let imageName = context.state.imageName {
            dynamicIslandExpandedTrailing(imageName: imageName)
              .padding(.trailing, 5)
              .applyWidgetURL(from: context.attributes.deepLinkUrl)
          }
        }
        DynamicIslandExpandedRegion(.bottom) {
          let _ = logger.info("[LA] island expandedBottom rendering, extractedTimer=\(extractedTimer, privacy: .public)")
          // Show large centered timer
          Text(extractedTimer)
            .font(.system(size: 28, weight: .bold, design: .monospaced))
            .foregroundStyle(.white)
            .padding(.top, 5)
            .applyWidgetURL(from: context.attributes.deepLinkUrl)
        }
      } compactLeading: {
        let _ = logger.info("[LA] island compactLeading rendering, dynamicIslandImageName=\(context.state.dynamicIslandImageName ?? "nil", privacy: .public)")
        if let dynamicIslandImageName = context.state.dynamicIslandImageName {
          resizableImage(imageName: dynamicIslandImageName)
            .frame(maxWidth: 23, maxHeight: 23)
            .applyWidgetURL(from: context.attributes.deepLinkUrl)
        }
      } compactTrailing: {
        let _ = logger.info("[LA] island compactTrailing rendering, extractedTimer=\(extractedTimer, privacy: .public)")
        // Show timer from subtitle (JS updates this every second)
        Text(extractedTimer)
          .font(.system(size: 13, weight: .semibold, design: .monospaced))
          .foregroundStyle(.white)
          .minimumScaleFactor(0.7)
          .lineLimit(1)
      } minimal: {
        let _ = logger.info("[LA] island minimal rendering, extractedTimer=\(extractedTimer, privacy: .public)")
        // Show timer from subtitle
        Text(extractedTimer)
          .font(.system(size: 11, weight: .semibold, design: .monospaced))
          .foregroundStyle(.white)
          .minimumScaleFactor(0.6)
          .lineLimit(1)
      }
    }
  }

  private func dynamicIslandExpandedLeading(title: String, subtitle: String?) -> some View {
    let _ = logger.info("[LA] dynamicIslandExpandedLeading: title=\(title, privacy: .public) subtitle=\(subtitle ?? "nil", privacy: .public)")
    return VStack(alignment: .leading) {
      Spacer()
      Text(title)
        .font(.title2)
        .foregroundStyle(.white)
        .fontWeight(.semibold)
      Text("Workout Active")
        .font(.subheadline)
        .foregroundStyle(.white.opacity(0.7))
      Spacer()
    }
  }

  private func dynamicIslandExpandedTrailing(imageName: String) -> some View {
    let _ = logger.info("[LA] dynamicIslandExpandedTrailing: imageName=\(imageName, privacy: .public)")
    return VStack {
      Spacer()
      resizableImage(imageName: imageName)
      Spacer()
    }
  }
}
