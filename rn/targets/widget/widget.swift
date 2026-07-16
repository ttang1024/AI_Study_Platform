import WidgetKit
import SwiftUI

// Written by the app (services/widgetBridge.ts, via @bacons/apple-targets'
// ExtensionStorage) into the shared App Group whenever the dashboard summary
// refreshes. Kept intentionally tiny — just what the widget's two faces need.
private let appGroup = "group.com.totoai.app.widget"
private let storageKey = "widgetData"

struct StudyWidgetData: Codable {
    var dueCount: Int
    var currentStreak: Int
    var freezesAvailable: Int
    var updatedAt: String
}

private func loadWidgetData() -> StudyWidgetData? {
    guard let data = UserDefaults(suiteName: appGroup)?.data(forKey: storageKey) else { return nil }
    return try? JSONDecoder().decode(StudyWidgetData.self, from: data)
}

struct StudyEntry: TimelineEntry {
    let date: Date
    let data: StudyWidgetData?
}

struct StudyTimelineProvider: TimelineProvider {
    func placeholder(in context: Context) -> StudyEntry {
        StudyEntry(date: Date(), data: StudyWidgetData(dueCount: 12, currentStreak: 4, freezesAvailable: 1, updatedAt: ""))
    }

    func getSnapshot(in context: Context, completion: @escaping (StudyEntry) -> Void) {
        completion(StudyEntry(date: Date(), data: loadWidgetData()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<StudyEntry>) -> Void) {
        let entry = StudyEntry(date: Date(), data: loadWidgetData())
        // The app pushes a fresh timeline (reloadWidget()) whenever the summary changes;
        // this hourly fallback just covers the case where the app hasn't been opened.
        let nextRefresh = Calendar.current.date(byAdding: .hour, value: 1, to: Date()) ?? Date().addingTimeInterval(3600)
        completion(Timeline(entries: [entry], policy: .after(nextRefresh)))
    }
}

struct StudyWidgetView: View {
    @Environment(\.widgetFamily) var family
    let entry: StudyEntry

    var body: some View {
        if let data = entry.data {
            switch family {
            case .systemSmall:
                SmallFace(data: data)
            default:
                MediumFace(data: data)
            }
        } else {
            EmptyFace()
        }
    }
}

private struct SmallFace: View {
    let data: StudyWidgetData
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 4) {
                Image(systemName: "flame.fill")
                    .foregroundStyle(data.currentStreak > 0 ? .orange : .secondary)
                    .font(.system(size: 13))
                Text("\(data.currentStreak)")
                    .font(.system(size: 15, weight: .bold))
            }
            Spacer()
            Text("\(data.dueCount)")
                .font(.system(size: 28, weight: .bold))
                .foregroundStyle(data.dueCount > 0 ? Color.accentColor : .secondary)
            Text(data.dueCount == 1 ? "card due" : "cards due")
                .font(.system(size: 11))
                .foregroundStyle(.secondary)
        }
        .padding(14)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .widgetURL(URL(string: "rn://study/flashcards/review"))
    }
}

private struct MediumFace: View {
    let data: StudyWidgetData
    var body: some View {
        HStack(spacing: 20) {
            VStack(alignment: .leading, spacing: 4) {
                Text("\(data.dueCount)")
                    .font(.system(size: 32, weight: .bold))
                    .foregroundStyle(data.dueCount > 0 ? Color.accentColor : .secondary)
                Text(data.dueCount == 1 ? "card due for review" : "cards due for review")
                    .font(.system(size: 12))
                    .foregroundStyle(.secondary)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 4) {
                HStack(spacing: 4) {
                    Image(systemName: "flame.fill").foregroundStyle(data.currentStreak > 0 ? .orange : .secondary)
                    Text("\(data.currentStreak) day\(data.currentStreak == 1 ? "" : "s")")
                        .font(.system(size: 14, weight: .semibold))
                }
                if data.freezesAvailable > 0 {
                    HStack(spacing: 4) {
                        Image(systemName: "snowflake").foregroundStyle(.blue)
                        Text("\(data.freezesAvailable) freeze\(data.freezesAvailable == 1 ? "" : "s")")
                            .font(.system(size: 11))
                            .foregroundStyle(.secondary)
                    }
                }
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .widgetURL(URL(string: "rn://study/flashcards/review"))
    }
}

private struct EmptyFace: View {
    var body: some View {
        VStack(spacing: 6) {
            Image(systemName: "book.closed")
                .font(.system(size: 20))
                .foregroundStyle(.secondary)
            Text("Open toto.ai to sync")
                .font(.system(size: 11))
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

struct StudyWidget: Widget {
    let kind: String = "StudyWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: StudyTimelineProvider()) { entry in
            StudyWidgetView(entry: entry)
                .containerBackground(.background, for: .widget)
        }
        .configurationDisplayName("Study Progress")
        .description("Cards due for review and your study streak.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

@main
struct StudyWidgetBundle: WidgetBundle {
    var body: some Widget {
        StudyWidget()
    }
}
