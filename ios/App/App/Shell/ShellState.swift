import Foundation
import UIKit

// MARK: - Types

enum ShellAccessState: String, Codable {
    case onboarding, locked, unlocked, recovery
}

enum LunartideTab: String, Codable, CaseIterable {
    case home, chat, music, calendar, console
    var label: String {
        switch self {
        case .home: "首頁"; case .chat: "聊天"; case .music: "音樂"
        case .calendar: "日曆"; case .console: "控制台"
        }
    }
    var route: String {
        switch self {
        case .home: "/"; case .chat: "/chat"; case .music: "/music"
        case .calendar: "/calendar"; case .console: "/settings"
        }
    }
}

struct NativeThemeSnapshot: Codable {
    var mode = "dark"
    var dockBackground = "rgba(24, 23, 21, 0.92)"
    var dockBorder = "rgba(255, 255, 255, 0.07)"
    var textPrimary = "#faf9f5"
    var textSecondary = "#9a8878"
    var icon = "#9a8878"
    var accent = "#cc785c"
    var selectedPillBackground = "rgba(204, 120, 92, 0.18)"
    var selectedIcon = "#cc785c"
}

// MARK: - Singleton Shell State

final class ShellState {
    static let shared = ShellState()
    private init() {}

    // State
    var accessState: ShellAccessState = .onboarding { didSet { post() } }
    var selectedTab: LunartideTab = .home { didSet { post() } }
    var currentRoute = "/" { didSet { post() } }
    var keyboardVisible = false { didSet { post() } }
    var fullScreenPresentationActive = false { didSet { post() } }
    var dockVisible = false { didSet { updateDockMetrics() } }
    var theme = NativeThemeSnapshot() { didSet { post() } }
    var webViewReady = false { didSet { updateDockVisibility() } }

    // Sub-routes per tab
    var homeLastRoute = "/", chatLastRoute = "/chat", musicLastRoute = "/music"
    var calendarLastRoute = "/calendar", consoleLastRoute = "/settings"

    // Bridge guard
    var navigationGenerationId: UInt64 = 0
    var isNavigatingFromNative = false

    // Bridge handshake per generation (tracked in ShellBridgePlugin)
    var currentReadyCount: Int = 0
    var dockInstallCount: Int = 0

    // Keyboard
    var keyboardFrame: CGRect = .zero
    var keyboardOccupiedBottom: CGFloat = 0

    func lastRoute(for tab: LunartideTab) -> String {
        switch tab {
        case .home: homeLastRoute; case .chat: chatLastRoute
        case .music: musicLastRoute; case .calendar: calendarLastRoute
        case .console: consoleLastRoute
        }
    }

    func saveLastRoute(for tab: LunartideTab, route: String) {
        switch tab {
        case .home: homeLastRoute = route; case .chat: chatLastRoute = route
        case .music: musicLastRoute = route; case .calendar: calendarLastRoute = route
        case .console: consoleLastRoute = route
        }
    }

    // MARK: - Dock Visibility Policy

    func updateDockVisibility() {
        let routeDockAllowed = !currentRoute.contains("/login") &&
            !currentRoute.contains("/recovery") &&
            !currentRoute.contains("/onboarding") &&
            !currentRoute.contains("/setup")

        dockVisible = accessState == .unlocked
            && !keyboardVisible
            && !fullScreenPresentationActive
            && routeDockAllowed
            && webViewReady
    }

    // MARK: - Occupied Bottom

    func occupiedBottom(safeAreaBottom: CGFloat) -> CGFloat {
        if keyboardVisible { return keyboardOccupiedBottom }
        if dockVisible { return safeAreaBottom + 64 + 8 }
        return safeAreaBottom
    }

    // MARK: - Dock Metrics for Web

    func dockMetrics(safeAreaInsets: UIEdgeInsets) -> [String: CGFloat] {
        guard dockVisible else { return ["x": 0, "y": 0, "width": 0, "height": 0] }
        let screenW = UIScreen.main.bounds.width
        let screenH = UIScreen.main.bounds.height
        let dockH: CGFloat = 64
        let dockGap: CGFloat = 8
        let y = screenH - safeAreaInsets.bottom - dockH - dockGap
        return ["x": 16, "y": y, "width": screenW - 32, "height": dockH]
    }

    // MARK: - Notification

    func post() {
        updateDockVisibility()
        NotificationCenter.default.post(name: .shellStateChanged, object: self)
    }
}

extension Notification.Name {
    static let shellStateChanged = Notification.Name("shell.stateChanged")
    static let nativeTabChanged = Notification.Name("native.tabChanged")
}
