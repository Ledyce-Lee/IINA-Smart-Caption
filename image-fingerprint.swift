import AppKit
import Foundation

enum FingerprintError: LocalizedError {
    case usage
    case unreadableImage
    case bitmapContext

    var errorDescription: String? {
        switch self {
        case .usage: return "Usage: image-fingerprint <image-file>"
        case .unreadableImage: return "Cannot read image"
        case .bitmapContext: return "Cannot create bitmap context"
        }
    }
}

func makeFingerprint(_ path: String) throws -> String {
    guard let image = NSImage(contentsOfFile: path),
          let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else { throw FingerprintError.unreadableImage }
    // 保留画面长宽比并采样 RGB，而非只比较灰度平均亮度：两段亮度相近但
    // 场景、人物或幻灯片内容不同的视频画面不应被误判为同一张截图。
    let width = 32
    let height = 18
    guard let context = CGContext(
        data: nil,
        width: width,
        height: height,
        bitsPerComponent: 8,
        bytesPerRow: width * 4,
        space: CGColorSpaceCreateDeviceRGB(),
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    ) else { throw FingerprintError.bitmapContext }
    context.interpolationQuality = .medium
    context.setFillColor(red: 0, green: 0, blue: 0, alpha: 1)
    context.fill(CGRect(x: 0, y: 0, width: width, height: height))
    let source = CGSize(width: cgImage.width, height: cgImage.height)
    let scale = min(CGFloat(width) / source.width, CGFloat(height) / source.height)
    let drawWidth = source.width * scale
    let drawHeight = source.height * scale
    let drawRect = CGRect(x: (CGFloat(width) - drawWidth) / 2, y: (CGFloat(height) - drawHeight) / 2, width: drawWidth, height: drawHeight)
    context.draw(cgImage, in: drawRect)
    guard let raw = context.data else { throw FingerprintError.bitmapContext }
    let values = raw.bindMemory(to: UInt8.self, capacity: width * height * 4)
    var result: [String] = []
    result.reserveCapacity(width * height * 3)
    for pixel in 0..<(width * height) {
        let offset = pixel * 4
        result.append(String(values[offset]))
        result.append(String(values[offset + 1]))
        result.append(String(values[offset + 2]))
    }
    return result.joined(separator: ",")
}

do {
    guard CommandLine.arguments.count == 2 else { throw FingerprintError.usage }
    print(try makeFingerprint(CommandLine.arguments[1]))
} catch {
    FileHandle.standardError.write(Data((error.localizedDescription + "\n").utf8))
    exit(1)
}
