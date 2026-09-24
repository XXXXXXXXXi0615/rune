import Capacitor
import WebKit

final class LunartideBridgeViewController: CAPBridgeViewController {

    private var dockInstalled = false

    override func capacitorDidLoad() {
        super.capacitorDidLoad()

        // Register custom plugins
        bridge?.registerPluginInstance(MCPBridgePlugin())
        bridge?.registerPluginInstance(ShellBridgePlugin())

        // Native dock — install once, not on reload
        guard !dockInstalled else { return }
        dockInstalled = true
        ShellState.shared.dockInstallCount += 1

        let dockBar = FloatingTabBar()

        view.addSubview(dockBar)
        NSLayoutConstraint.activate([
            dockBar.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            dockBar.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            dockBar.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -4),
            dockBar.heightAnchor.constraint(equalToConstant: 64),
        ])

        // Observe native tab changes → navigate web
        NotificationCenter.default.addObserver(
            self, selector: #selector(handleNativeTabChange(_:)),
            name: .nativeTabChanged, object: nil
        )

        #if DEBUG
        let vcName = String(describing: type(of: self))
        let state = ShellState.shared
        print("[LunartideShell] VC=\(vcName) dock=\(dockInstalled) state=\(String(describing: state.accessState))")
        #endif
    }

    @objc private func handleNativeTabChange(_ n: Notification) {
        guard let tab = n.object as? LunartideTab else { return }
        let shell = ShellState.shared
        let route = shell.lastRoute(for: tab)
        let genId = shell.navigationGenerationId
        let js = """
        (function(){
            window.dispatchEvent(new CustomEvent('nativeNavigate', {
                detail: { route: '\(route)', tab: '\(tab.rawValue)', generationId: \(genId) }
            }));
        })();
        """
        (bridge?.webView as? WKWebView)?.evaluateJavaScript(js, completionHandler: nil)
    }
}
