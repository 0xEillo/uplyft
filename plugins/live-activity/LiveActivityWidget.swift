import ActivityKit
import SwiftUI
import WidgetKit
import os.log

private let logger = Logger(subsystem: "com.repai.liveactivity", category: "Widget")

struct LiveActivityAttributes: ActivityAttributes {
  struct ContentState: Codable, Hashable {
    var title: String
    var subtitle: String?
    var timerStartDateInMilliseconds: Double?
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

private func dateFromMilliseconds(_ milliseconds: Double?) -> Date? {
  guard let milliseconds = milliseconds else { return nil }
  return Date(timeIntervalSince1970: milliseconds / 1000)
}

@ViewBuilder
private func timerText(startMs: Double?, endMs: Double?, font: Font) -> some View {
  if let startDate = dateFromMilliseconds(startMs) {
    if let endDate = dateFromMilliseconds(endMs) {
      Text(timerInterval: startDate...endDate, countsDown: true)
        .font(font)
    } else {
      Text(startDate, style: .timer)
        .font(font)
    }
  } else if let endMs = endMs {
    Text(timerInterval: Date.toTimerInterval(miliseconds: endMs), countsDown: true)
      .font(font)
  } else {
    Text("--:--")
      .font(font)
  }
}

struct LiveActivityWidget: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: LiveActivityAttributes.self) { context in
      let _ = logger.info("[LA] ===== LOCKScreen RENDER ======")
      let _ = logger.info("[LA] lockscreen title=\(context.state.title, privacy: .public)")
      let _ = logger.info("[LA] lockscreen subtitle=\(context.state.subtitle ?? "nil", privacy: .public)")
      let _ = logger.info("[LA] lockscreen imageName=\(context.state.imageName ?? "nil", privacy: .public)")
      let _ = logger.info("[LA] lockscreen dynamicIslandImageName=\(context.state.dynamicIslandImageName ?? "nil", privacy: .public)")
      let _ = logger.info("[LA] lockscreen timerStartDateInMilliseconds=\(context.state.timerStartDateInMilliseconds ?? 0, privacy: .public)")
      let _ = logger.info("[LA] lockscreen timerEndDateInMilliseconds=\(context.state.timerEndDateInMilliseconds ?? 0, privacy: .public)")
      let _ = logger.info("[LA] lockscreen timerType=\(context.attributes.timerType?.rawValue ?? "nil", privacy: .public)")
      let _ = logger.info("[LA] lockscreen deepLinkUrl=\(context.attributes.deepLinkUrl ?? "nil", privacy: .public)")
      
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
      let _ = logger.info("[LA] island timerStartDateInMilliseconds=\(context.state.timerStartDateInMilliseconds ?? 0, privacy: .public)")
      let _ = logger.info("[LA] island timerEndDateInMilliseconds=\(context.state.timerEndDateInMilliseconds ?? 0, privacy: .public)")
      let _ = logger.info("[LA] island timerType=\(context.attributes.timerType?.rawValue ?? "nil", privacy: .public)")
      let _ = logger.info("[LA] island deepLinkUrl=\(context.attributes.deepLinkUrl ?? "nil", privacy: .public)")
      
      DynamicIsland {
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
          let _ = logger.info("[LA] island expandedBottom rendering")
          timerText(
            startMs: context.state.timerStartDateInMilliseconds,
            endMs: context.state.timerEndDateInMilliseconds,
            font: .system(size: 28, weight: .bold, design: .monospaced)
          )
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
        let _ = logger.info("[LA] island compactTrailing rendering")
        timerText(
          startMs: context.state.timerStartDateInMilliseconds,
          endMs: context.state.timerEndDateInMilliseconds,
          font: .system(size: 13, weight: .semibold, design: .monospaced)
        )
        .foregroundStyle(.white)
        .minimumScaleFactor(0.7)
        .lineLimit(1)
      } minimal: {
        let _ = logger.info("[LA] island minimal rendering")
        timerText(
          startMs: context.state.timerStartDateInMilliseconds,
          endMs: context.state.timerEndDateInMilliseconds,
          font: .system(size: 11, weight: .semibold, design: .monospaced)
        )
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
