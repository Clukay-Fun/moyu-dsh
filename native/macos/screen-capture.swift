import AppKit
import CoreGraphics
import Foundation
import ScreenCaptureKit

enum CaptureError: LocalizedError {
    case invalidArguments
    case displayNotFound(UInt32)
    case pngEncodingFailed

    var errorDescription: String? {
        switch self {
        case .invalidArguments:
            return "用法：screen-capture <output.png> <display-id> <pixel-width> <pixel-height>"
        case .displayNotFound(let id):
            return "找不到显示器：\(id)"
        case .pngEncodingFailed:
            return "无法把屏幕快照编码为 PNG"
        }
    }
}

@main
struct ScreenCaptureSidecar {
    static func main() async {
        do {
            guard CommandLine.arguments.count == 5,
                  let requestedDisplayID = UInt32(CommandLine.arguments[2]),
                  let pixelWidth = Int(CommandLine.arguments[3]),
                  let pixelHeight = Int(CommandLine.arguments[4]) else {
                throw CaptureError.invalidArguments
            }
            let displayID = requestedDisplayID == 0 ? CGMainDisplayID() : requestedDisplayID

            let outputURL = URL(fileURLWithPath: CommandLine.arguments[1])
            let content = try await SCShareableContent.excludingDesktopWindows(
                false,
                onScreenWindowsOnly: false
            )
            guard let display = content.displays.first(where: { $0.displayID == displayID }) else {
                throw CaptureError.displayNotFound(displayID)
            }
            // 覆盖层在快照完成后才创建，因此这里可以包含工具箱本身，且不会形成
            // “截图里套截图”的递归画面。窗口位置、焦点与全屏状态都无需改变。
            let filter = SCContentFilter(display: display, excludingWindows: [])
            let configuration = SCStreamConfiguration()
            configuration.width = pixelWidth
            configuration.height = pixelHeight
            configuration.showsCursor = true
            configuration.captureResolution = .best

            let image = try await SCScreenshotManager.captureImage(
                contentFilter: filter,
                configuration: configuration
            )
            let representation = NSBitmapImageRep(cgImage: image)
            guard let png = representation.representation(using: .png, properties: [:]) else {
                throw CaptureError.pngEncodingFailed
            }
            try png.write(to: outputURL, options: .atomic)
            FileHandle.standardOutput.write(Data("{\"width\":\(image.width),\"height\":\(image.height)}\n".utf8))
        } catch {
            FileHandle.standardError.write(Data("\(error.localizedDescription)\n".utf8))
            exit(1)
        }
    }
}
