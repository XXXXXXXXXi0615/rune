import Foundation
import Capacitor
import UIKit

@objc(ShellBridgePlugin)
public final class ShellBridgePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ShellBridgePlugin"
    public let jsName = "ShellBridge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "ready", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "accessStateChanged", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "routeChanged", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "themeChanged", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestHaptic", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getDockMetrics", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getSafeAreaInsets", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getTheme", returnType: CAPPluginReturnPromise),
    ]

    private let shell = ShellState.shared
    private var lastReadyGeneration: String = ""

    // MARK: - Lifecycle

    override public func load() {
        NotificationCenter.default.addObserver(
            self, selector: #selector(handleStateChange),
            name: .shellStateChanged, object: shell
        )
        NotificationCenter.default.addObserver(
            self, selector: #selector(handleKeyboardShow(_:)),
            name: UIResponder.keyboardWillShowNotification, object: nil
        )
        NotificationCenter.default.addObserver(
            self, selector: #selector(handleKeyboardHide(_:)),
            name: UIResponder.keyboardWillHideNotification, object: nil
        )
    }

    deinit { NotificationCenter.default.removeObserver(self) }

    // MARK: - Web → Native

    @objc func ready(_ call: CAPPluginCall) {
        let webGen = call.getString("generationId") ?? ""

        // Idempotent within the same generation (same web document)
        if !webGen.isEmpty && webGen == lastReadyGeneration {
            call.resolve(["bridgeVersion": "1", "readyCount": shell.currentReadyCount, "generationId": lastReadyGeneration, "dockInstallCount": shell.dockInstallCount])
            return
        }

        // New generation: increment counter
        if !webGen.isEmpty && webGen != lastReadyGeneration {
            shell.currentReadyCount = 0
        }

        let route = call.getString("route") ?? "/"
        let access = call.getString("accessState") ?? "onboarding"
        shell.webViewReady = true
        shell.currentRoute = route
        if let state = ShellAccessState(rawValue: access) { shell.accessState = state }
        shell.currentReadyCount += 1
        lastReadyGeneration = webGen
        shell.post()

        call.resolve([
            "bridgeVersion": "1",
            "readyCount": shell.currentReadyCount,
            "generationId": lastReadyGeneration,
            "dockInstallCount": shell.dockInstallCount,
        ])
    }

    @objc func accessStateChanged(_ call: CAPPluginCall) {
        guard let state = call.getString("state"),
              let accessState = ShellAccessState(rawValue: state) else {
            call.reject("Invalid access state")
            return
        }
        shell.accessState = accessState
        shell.post()
        call.resolve()
    }

    @objc func routeChanged(_ call: CAPPluginCall) {
        guard let route = call.getString("route") else {
            call.reject("Missing route")
            return
        }
        if shell.isNavigatingFromNative {
            shell.isNavigatingFromNative = false
            call.resolve()
            return
        }

        shell.currentRoute = route

        // Map route to tab
        if route.hasPrefix("/chat") { shell.selectedTab = .chat }
        else if route.hasPrefix("/music") { shell.selectedTab = .music }
        else if route.hasPrefix("/calendar") { shell.selectedTab = .calendar }
        else if route.hasPrefix("/settings") { shell.selectedTab = .console }
        else if route == "/" || !route.hasPrefix("/") { shell.selectedTab = .home }

        for tab in LunartideTab.allCases {
            if route.hasPrefix(tab.route) { shell.saveLastRoute(for: tab, route: route) }
        }

        shell.post()
        call.resolve()
    }

    @objc func themeChanged(_ call: CAPPluginCall) {
        if let mode = call.getString("mode") { shell.theme.mode = mode }
        if let dockBg = call.getString("dockBackground") { shell.theme.dockBackground = dockBg }
        if let dockBorder = call.getString("dockBorder") { shell.theme.dockBorder = dockBorder }
        if let textPrimary = call.getString("textPrimary") { shell.theme.textPrimary = textPrimary }
        if let textSecondary = call.getString("textSecondary") { shell.theme.textSecondary = textSecondary }
        if let icon = call.getString("icon") { shell.theme.icon = icon }
        if let accent = call.getString("accent") { shell.theme.accent = accent }
        if let pillBg = call.getString("selectedPillBackground") { shell.theme.selectedPillBackground = pillBg }
        if let selIcon = call.getString("selectedIcon") { shell.theme.selectedIcon = selIcon }
        shell.post()

        // Update Status Bar via Capacitor
        let style = shell.theme.mode == "dark" ? "DARK" : "LIGHT"
        bridge?.webView?.evaluateJavaScript(
            "window.dispatchEvent(new CustomEvent('nativeThemeChanged', { detail: { mode: '\(shell.theme.mode)' } }))",
            completionHandler: nil
        )

        call.resolve()
    }

    @objc func requestHaptic(_ call: CAPPluginCall) {
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        call.resolve()
    }

    // MARK: - Native → Web (query methods)

    @objc func getDockMetrics(_ call: CAPPluginCall) {
        let wv = bridge?.webView
        let insets = wv?.safeAreaInsets ?? .zero
        let metrics = shell.dockMetrics(safeAreaInsets: insets)
        call.resolve(metrics as [String: Any])
    }

    @objc func getSafeAreaInsets(_ call: CAPPluginCall) {
        let wv = bridge?.webView
        let insets = wv?.safeAreaInsets ?? .zero
        call.resolve([
            "top": insets.top, "bottom": insets.bottom,
            "left": insets.left, "right": insets.right,
        ])
    }

    @objc func getTheme(_ call: CAPPluginCall) {
        call.resolve([
            "mode": shell.theme.mode,
            "dockBackground": shell.theme.dockBackground,
            "dockBorder": shell.theme.dockBorder,
            "textPrimary": shell.theme.textPrimary,
            "textSecondary": shell.theme.textSecondary,
            "icon": shell.theme.icon,
            "accent": shell.theme.accent,
            "selectedPillBackground": shell.theme.selectedPillBackground,
            "selectedIcon": shell.theme.selectedIcon,
        ])
    }

    // MARK: - Keyboard

    @objc private func handleKeyboardShow(_ n: Notification) {
        guard let info = n.userInfo,
              let frame = (info[UIResponder.keyboardFrameEndUserInfoKey] as? NSValue)?.cgRectValue else { return }
        shell.keyboardFrame = frame
        shell.keyboardVisible = true
        shell.keyboardOccupiedBottom = frame.height
        shell.post()
        injectCSSVar("--native-keyboard-height", "\(frame.height)px")
    }

    @objc private func handleKeyboardHide(_ n: Notification) {
        shell.keyboardVisible = false
        shell.keyboardOccupiedBottom = 0
        shell.post()
        injectCSSVar("--native-keyboard-height", "0px")
    }

    // MARK: - State Push to Web

    @objc private func handleStateChange() {
        let wv = bridge?.webView
        let insets = wv?.safeAreaInsets ?? .zero
        let metrics = shell.dockMetrics(safeAreaInsets: insets)
        let occupiedBottom = shell.occupiedBottom(safeAreaBottom: insets.bottom)
        let dockH = metrics["height"] ?? 0
        let dw = metrics["width"] ?? 0
        let dx = metrics["x"] ?? 0
        let dy = metrics["y"] ?? 0

        // Inject CSS variables
        injectCSSVar("--native-safe-top", "\(insets.top)px")
        injectCSSVar("--native-safe-bottom", "\(insets.bottom)px")
        injectCSSVar("--native-dock-height", "\(dockH)px")
        injectCSSVar("--native-dock-gap", "8px")
        injectCSSVar("--native-occupied-bottom", "\(occupiedBottom)px")
        injectCSSVar("--native-keyboard-height", "\(shell.keyboardOccupiedBottom)px")

        // Set data attributes
        let attrJS = """
        (function(){
            var r=document.documentElement;
            r.dataset.nativeShell='ios';
            r.dataset.nativeDockVisible='\(shell.dockVisible ? "true" : "false")';
            r.dataset.accessState='\(shell.accessState.rawValue)';
        })();
        """
        wv?.evaluateJavaScript(attrJS, completionHandler: nil)

        // Dispatch CustomEvent with full state
        let eventJS = """
        window.dispatchEvent(new CustomEvent('nativeShellStateChanged', {
            detail: JSON.parse('{\(escape(jsonShellState(dockH:dockH,dx:dx,dy:dy,dw:dw, occupiedBottom:occupiedBottom))}')
        }));
        """
        wv?.evaluateJavaScript(eventJS, completionHandler: nil)
    }

    private func injectCSSVar(_ name: String, _ value: String) {
        bridge?.webView?.evaluateJavaScript(
            "document.documentElement.style.setProperty('\(name)','\(value)')",
            completionHandler: nil
        )
    }

    private func escape(_ s: String) -> String {
        s.replacingOccurrences(of: "\\", with: "\\\\")
         .replacingOccurrences(of: "'", with: "\\'")
         .replacingOccurrences(of: "\n", with: "\\n")
    }
}

// JSON serialization helper
private func jsonShellState(dockH: CGFloat, dx: CGFloat, dy: CGFloat, dw: CGFloat, occupiedBottom: CGFloat) -> String {
    let s = ShellState.shared
    let json = """
        "dockVisible":\(s.dockVisible),\
        "accessState":"\(s.accessState.rawValue)",\
        "selectedTab":"\(s.selectedTab.rawValue)",\
        "keyboardVisible":\(s.keyboardVisible),\
        "dockHeight":\(Int(dockH)),\
        "occupiedBottom":\(Int(occupiedBottom)),\
        "navigationGenerationId":\(s.navigationGenerationId),\
        "dockMetrics":{"x":\(Int(dx)),"y":\(Int(dy)),"width":\(Int(dw)),"height":\(Int(dockH))}
    """
    return json
}
