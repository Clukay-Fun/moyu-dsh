import AppKit
import CoreGraphics
import Foundation
import ScreenCaptureKit

enum CaptureError: LocalizedError {
    case invalidArguments
    case displayNotFound(UInt32)
    case excludedApplicationNotFound(pid_t)
    case pngEncodingFailed

    var errorDescription: String? {
        switch self {
        case .invalidArguments:
            return "用法：screen-capture <output.png> <display-id> <excluded-pid> <pixel-width> <pixel-height>"
        case .displayNotFound(let id):
            return "找不到显示器：\(id)"
        case .excludedApplicationNotFound(let pid):
            return "找不到要排除的应用进程：\(pid)"
        case .pngEncodingFailed:
            return "无法把屏幕快照编码为 PNG"
        }
    }
}

@main
struct ScreenCaptureSidecar {
    static func main() async {
        do {
            guard CommandLine.arguments.count == 6,
                  let requestedDisplayID = UInt32(CommandLine.arguments[2]),
                  let excludedPID = Int32(CommandLine.arguments[3]),
                  let pixelWidth = Int(CommandLine.arguments[4]),
                  let pixelHeight = Int(CommandLine.arguments[5]) else {
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
            guard let excludedApp = content.applications.first(where: {
                $0.processID == excludedPID
            }) else {
                throw CaptureError.excludedApplicationNotFound(excludedPID)
            }

            // 排除整个 Electron 应用，而不是只排除主窗口：截图覆盖层、DevTools、
            // 辅助窗口都不能进入冻结帧。ScreenCaptureKit 会合成其下方真实内容。
            let filter = SCContentFilter(
                display: display,
                excludingApplications: [excludedApp],
                exceptingWindows: []
            )
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
