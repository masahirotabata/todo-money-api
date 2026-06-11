//
//  TaskMoneyWidget.swift
//  TaskMoneyWidget
//

import WidgetKit
import SwiftUI

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> SimpleEntry {
        SimpleEntry(date: Date())
    }

    func getSnapshot(in context: Context, completion: @escaping (SimpleEntry) -> Void) {
        completion(SimpleEntry(date: Date()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<SimpleEntry>) -> Void) {
        let entry = SimpleEntry(date: Date())
        let timeline = Timeline(entries: [entry], policy: .never)
        completion(timeline)
    }
}

struct SimpleEntry: TimelineEntry {
    let date: Date
}

struct TaskMoneyWidgetEntryView: View {
    var entry: Provider.Entry

    var body: some View {
        Link(destination: URL(string: "taskmoney://inbox?quickMemo=1")!) {
            VStack(spacing: 8) {
                Text("🌱")
                    .font(.system(size: 28))

                Text("瞬間メモ")
                    .font(.system(size: 15, weight: .bold))
                    .minimumScaleFactor(0.8)

                Text("すぐ保存")
                    .font(.system(size: 11, weight: .semibold))
                    .opacity(0.75)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }
}

struct TaskMoneyWidget: Widget {
    let kind: String = "TaskMoneyWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            if #available(iOS 17.0, *) {
                TaskMoneyWidgetEntryView(entry: entry)
                    .containerBackground(.green.gradient, for: .widget)
            } else {
                TaskMoneyWidgetEntryView(entry: entry)
                    .padding()
                    .background(Color.green.opacity(0.25))
            }
        }
        .configurationDisplayName("TaskMoney 瞬間メモ")
        .description("ロック画面から思いつきをすぐ記録できます。")
        .supportedFamilies([
            .systemSmall,
            .accessoryCircular,
            .accessoryRectangular
        ])
    }
}

#Preview(as: .systemSmall) {
    TaskMoneyWidget()
} timeline: {
    SimpleEntry(date: .now)
}
