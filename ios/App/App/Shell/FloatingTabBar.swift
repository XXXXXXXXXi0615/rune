import UIKit
// Notification.Name defined in ShellState.swift

// MARK: - FloatingTabBar

final class FloatingTabBar: UIView {

    private let shell = ShellState.shared
    private var buttons: [LunartideTab: UIButton] = [:]
    private let selectedPill = UIView()
    private let blurView = UIVisualEffectView(effect: UIBlurEffect(style: .systemMaterialDark))

    // MARK: - Icons

    private func iconName(for tab: LunartideTab) -> String {
        switch tab {
        case .home:     return "house.fill"
        case .chat:     return "message.fill"
        case .music:    return "music.note"
        case .calendar: return "calendar"
        case .console:  return "gearshape.fill"
        }
    }

    // MARK: - Init

    override init(frame: CGRect) {
        super.init(frame: frame)
        setup()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setup()
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    private func setup() {
        backgroundColor = .clear
        translatesAutoresizingMaskIntoConstraints = false
        alpha = 0
        transform = CGAffineTransform(translationX: 0, y: 80)

        // Blur container
        blurView.layer.cornerRadius = 24
        blurView.layer.masksToBounds = true
        blurView.layer.borderWidth = 0.5
        blurView.translatesAutoresizingMaskIntoConstraints = false
        addSubview(blurView)

        // Buttons
        let stack = UIStackView()
        stack.axis = .horizontal
        stack.distribution = .fillEqually
        stack.spacing = 2
        stack.translatesAutoresizingMaskIntoConstraints = false
        blurView.contentView.addSubview(stack)

        for tab in LunartideTab.allCases {
            let btn = UIButton(type: .custom)
            btn.setImage(UIImage(systemName: iconName(for: tab)), for: .normal)
            btn.tag = LunartideTab.allCases.firstIndex(of: tab) ?? 0
            btn.addTarget(self, action: #selector(tabTapped(_:)), for: .touchUpInside)
            btn.translatesAutoresizingMaskIntoConstraints = false
            buttons[tab] = btn
            stack.addArrangedSubview(btn)
        }

        // Selected pill
        selectedPill.layer.cornerRadius = 18
        selectedPill.isHidden = true
        selectedPill.translatesAutoresizingMaskIntoConstraints = false
        blurView.contentView.insertSubview(selectedPill, at: 0)

        // Layout
        NSLayoutConstraint.activate([
            blurView.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 16),
            blurView.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -16),
            blurView.topAnchor.constraint(equalTo: topAnchor),
            blurView.bottomAnchor.constraint(equalTo: bottomAnchor),
            blurView.heightAnchor.constraint(equalToConstant: 56),

            stack.leadingAnchor.constraint(equalTo: blurView.contentView.leadingAnchor, constant: 4),
            stack.trailingAnchor.constraint(equalTo: blurView.contentView.trailingAnchor, constant: -4),
            stack.topAnchor.constraint(equalTo: blurView.contentView.topAnchor),
            stack.bottomAnchor.constraint(equalTo: blurView.contentView.bottomAnchor),
        ])

        updateSelection(animated: false)
        applyTheme()

        // Observe state changes
        NotificationCenter.default.addObserver(
            self, selector: #selector(handleStateChange),
            name: .shellStateChanged, object: shell
        )
    }

    // MARK: - State Observation

    @objc private func handleStateChange() {
        updateSelection(animated: true)
        applyTheme()

        let visible = shell.dockVisible
        UIView.animate(withDuration: 0.22, delay: 0, options: .curveEaseOut) {
            self.alpha = visible ? 1 : 0
            self.transform = visible ? .identity : CGAffineTransform(translationX: 0, y: 80)
        }
    }

    // MARK: - Actions

    @objc private func tabTapped(_ sender: UIButton) {
        guard let idx = LunartideTab.allCases.firstIndex(where: {
            LunartideTab.allCases.firstIndex(of: $0) == sender.tag
        }), let tab = LunartideTab.allCases[safe: idx] else { return }

        if tab == shell.selectedTab {
            // Re-tap same tab: navigate to root
            shell.isNavigatingFromNative = true
            shell.navigationGenerationId &+= 1
            NotificationCenter.default.post(name: .nativeTabChanged, object: tab)
            return
        }

        shell.selectedTab = tab
        shell.isNavigatingFromNative = true
        shell.navigationGenerationId &+= 1
        NotificationCenter.default.post(name: .nativeTabChanged, object: tab)
    }

    // MARK: - Visual Updates

    private func updateSelection(animated: Bool) {
        guard let selectedBtn = buttons[shell.selectedTab] else { return }
        let duration: TimeInterval = animated ? 0.22 : 0

        UIView.animate(withDuration: duration, delay: 0, options: .curveEaseOut) {
            self.selectedPill.isHidden = false
            self.selectedPill.frame = selectedBtn.frame.insetBy(dx: -2, dy: -2)

            for (tab, btn) in self.buttons {
                btn.tintColor = UIColor(
                    hex: tab == self.shell.selectedTab
                        ? self.shell.theme.selectedIcon
                        : self.shell.theme.icon
                )
            }
        }
    }

    func applyTheme() {
        let blurStyle: UIBlurEffect.Style = shell.theme.mode == "dark" ? .systemMaterialDark : .systemMaterialLight
        blurView.effect = UIBlurEffect(style: blurStyle)
        blurView.layer.borderColor = UIColor(hex: shell.theme.dockBorder).cgColor
        selectedPill.backgroundColor = UIColor(hex: shell.theme.selectedPillBackground)

        for (tab, btn) in buttons {
            btn.tintColor = UIColor(
                hex: tab == shell.selectedTab
                    ? shell.theme.selectedIcon
                    : shell.theme.icon
            )
        }
    }
}

// MARK: - Helpers

extension UIColor {
    convenience init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        guard hex.count >= 6 else { self.init(white: 0, alpha: 1); return }
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a = hex.count >= 8 ? CGFloat((int >> 24) & 0xFF) / 255 : 1.0
        let r = CGFloat((int >> 16) & 0xFF) / 255
        let g = CGFloat((int >> 8) & 0xFF) / 255
        let b = CGFloat(int & 0xFF) / 255
        self.init(red: r, green: g, blue: b, alpha: a)
    }
}

extension Array {
    subscript(safe index: Index) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}
