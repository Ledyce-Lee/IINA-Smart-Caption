import AVFoundation
import CoreMedia
import Foundation
import Speech

enum TranscriptionError: LocalizedError {
    case usage
    case unsupportedLocale(String)
    case noSegments

    var errorDescription: String? {
        switch self {
        case .usage:
            return "Usage: apple-speech-analyzer <audio-file> <output-srt> <BCP-47-language>"
        case let .unsupportedLocale(identifier):
            return "SpeechAnalyzer does not support \(identifier) on this Mac. Install the language asset in System Settings and try again."
        case .noSegments:
            return "SpeechAnalyzer returned no timestamped speech segments."
        }
    }
}

struct Segment {
    let start: Double
    let end: Double
    let text: String
}

struct Cue {
    let start: Double
    var end: Double
    var text: String
}

func srtTime(_ seconds: Double) -> String {
    let milliseconds = max(0, Int((seconds * 1000).rounded()))
    return String(format: "%02d:%02d:%02d,%03d", milliseconds / 3_600_000, (milliseconds % 3_600_000) / 60_000, (milliseconds % 60_000) / 1_000, milliseconds % 1_000)
}

func normalized(_ text: AttributedString) -> String {
    String(text.characters).replacingOccurrences(of: "\n", with: " ").split(whereSeparator: { $0.isWhitespace }).joined(separator: " ")
}

func isCJK(_ locale: Locale) -> Bool {
    ["zh", "ja", "ko"].contains(locale.language.languageCode?.identifier ?? "")
}

func punctuationOnly(_ text: String) -> Bool {
    !text.isEmpty && text.unicodeScalars.allSatisfy { CharacterSet.punctuationCharacters.contains($0) || CharacterSet.symbols.contains($0) }
}

func closesSentence(_ text: String) -> Bool {
    guard let last = text.last else { return false }
    return ".!?。！？…".contains(last)
}

func makeCues(_ segments: [Segment], locale: Locale) -> [Cue] {
    let cjk = isCJK(locale)
    let maxDuration = 5.8
    let maxCharacters = cjk ? 30 : 70
    var result: [Cue] = []
    var current: Cue?

    func finish() {
        guard let cue = current else { return }
        let text = cue.text.trimmingCharacters(in: .whitespacesAndNewlines)
        if !text.isEmpty { result.append(Cue(start: cue.start, end: cue.end, text: text)) }
        current = nil
    }

    for segment in segments {
        if let cue = current {
            let shouldSplit = segment.start - cue.end > 0.55 || (!punctuationOnly(segment.text) && (segment.end - cue.start > maxDuration || cue.text.count + segment.text.count > maxCharacters))
            if shouldSplit { finish() }
        }
        if var cue = current {
            cue.text += (cjk || punctuationOnly(segment.text)) ? segment.text : " " + segment.text
            cue.end = segment.end
            current = cue
        } else {
            current = Cue(start: segment.start, end: segment.end, text: segment.text)
        }
        if let cue = current, closesSentence(cue.text) { finish() }
    }
    finish()
    return result
}

@main
struct SmartCaptionSpeechAnalyzer {
    static func main() async {
        do {
            let arguments = CommandLine.arguments
            guard arguments.count == 4 else { throw TranscriptionError.usage }
            let inputURL = URL(fileURLWithPath: arguments[1])
            let outputURL = URL(fileURLWithPath: arguments[2])
            let requested = arguments[3]
            let requestedLocale = Locale(identifier: requested == "auto" ? "zh-Hans" : requested)
            guard let locale = await SpeechTranscriber.supportedLocale(equivalentTo: requestedLocale) else { throw TranscriptionError.unsupportedLocale(requested) }

            let transcriber = SpeechTranscriber(locale: locale, transcriptionOptions: [], reportingOptions: [], attributeOptions: [.audioTimeRange])
            if let installation = try await AssetInventory.assetInstallationRequest(supporting: [transcriber]) {
                try await installation.downloadAndInstall()
            }
            let audio = try AVAudioFile(forReading: inputURL)
            let analyzer = try await SpeechAnalyzer(inputAudioFile: audio, modules: [transcriber], finishAfterFile: true)
            var segments: [Segment] = []
            for try await result in transcriber.results {
                for run in result.text.runs {
                    guard let range = run.audioTimeRange else { continue }
                    let text = normalized(AttributedString(result.text[run.range]))
                    let start = CMTimeGetSeconds(range.start)
                    let end = CMTimeGetSeconds(range.end)
                    guard !text.isEmpty, start.isFinite, end.isFinite, end > start else { continue }
                    segments.append(Segment(start: start, end: end, text: text))
                }
            }
            _ = analyzer
            let cues = makeCues(segments, locale: locale)
            guard !cues.isEmpty else { throw TranscriptionError.noSegments }
            var srt = ""
            for (index, cue) in cues.enumerated() {
                srt += "\(index + 1)\n\(srtTime(cue.start)) --> \(srtTime(cue.end))\n\(cue.text)\n\n"
            }
            try srt.write(to: outputURL, atomically: true, encoding: .utf8)
        } catch {
            FileHandle.standardError.write(Data("Apple SpeechAnalyzer failed: \(error.localizedDescription)\n".utf8))
            exit(1)
        }
    }
}
