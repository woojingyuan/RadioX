import Cocoa
import Darwin
import Foundation

private let radioXURL = URL(string: "http://127.0.0.1:8765")!
private var radioXBarLockDescriptor: Int32 = -1

private func radioXEndpoint(_ path: String) -> URL {
    URL(string: path, relativeTo: radioXURL)!.absoluteURL
}

private struct StationPayload: Decodable {
    struct Track: Decodable {
        let id: String
        let title: String
        let artist: String
        let energy: Int?
    }

    struct Context: Decodable {
        struct Now: Decodable {
            let dayPart: String
        }

        let weather: String
        let mood: String
        let intensity: Int
        let now: Now
    }

    struct State: Decodable {
        let playing: Bool?
        let favoriteIds: [String]?
    }

    let current: Track?
    let queue: [Track]
    let context: Context?
    let state: State?
}

private struct RestCueSelection {
    let index: Int
    let id: String
    let title: String
    let artist: String
}

private func claimSingleInstance() -> Bool {
    let fd = Darwin.open("/tmp/radiox-bar.lock", O_CREAT | O_RDWR, S_IRUSR | S_IWUSR)
    if fd < 0 {
        return true
    }
    if flock(fd, LOCK_EX | LOCK_NB) != 0 {
        Darwin.close(fd)
        return false
    }
    radioXBarLockDescriptor = fd
    return true
}

private enum BarMode {
    case hidden
    case minimal
    case detail
}

private enum ChromeRadioXOpenResult {
    case found
    case created
    case failed
}

private final class TrackingView: NSVisualEffectView {
    var onEnter: (() -> Void)?
    var onExit: (() -> Void)?
    var onSingleClick: (() -> Void)?
    var onDoubleClick: (() -> Void)?

    private let radioXBackgroundLayer = CAGradientLayer()
    private let radioXDotLayer = CAShapeLayer()
    private var trackingAreaRef: NSTrackingArea?
    private var cornerRadius: CGFloat = 24

    func applyRadioXStyle() {
        wantsLayer = true
        state = .active
        material = .underWindowBackground
        blendingMode = .withinWindow
        layer?.cornerCurve = .continuous
        layer?.cornerRadius = cornerRadius
        layer?.masksToBounds = true
        layer?.borderWidth = 1
        layer?.borderColor = NSColor(calibratedRed: 0.224, green: 0.961, blue: 0.690, alpha: 0.32).cgColor
        layer?.backgroundColor = NSColor(calibratedRed: 0.004, green: 0.008, blue: 0.007, alpha: 0.985).cgColor

        radioXBackgroundLayer.colors = [
            NSColor(calibratedRed: 0.019, green: 0.040, blue: 0.033, alpha: 0.99).cgColor,
            NSColor(calibratedRed: 0.008, green: 0.014, blue: 0.012, alpha: 0.99).cgColor,
            NSColor(calibratedRed: 0.002, green: 0.004, blue: 0.004, alpha: 0.99).cgColor
        ]
        radioXBackgroundLayer.startPoint = CGPoint(x: 0, y: 0)
        radioXBackgroundLayer.endPoint = CGPoint(x: 1, y: 1)
        radioXBackgroundLayer.cornerCurve = .continuous
        radioXBackgroundLayer.cornerRadius = cornerRadius

        radioXDotLayer.fillColor = NSColor(calibratedRed: 0.224, green: 0.961, blue: 0.690, alpha: 0.12).cgColor

        if radioXBackgroundLayer.superlayer == nil {
            layer?.insertSublayer(radioXBackgroundLayer, at: 0)
        }
        if radioXDotLayer.superlayer == nil {
            layer?.insertSublayer(radioXDotLayer, above: radioXBackgroundLayer)
        }
        needsLayout = true
    }

    func setRadioXCornerRadius(_ radius: CGFloat) {
        cornerRadius = radius
        layer?.cornerRadius = radius
        radioXBackgroundLayer.cornerRadius = radius
    }

    override func layout() {
        super.layout()
        radioXBackgroundLayer.frame = bounds
        radioXBackgroundLayer.cornerRadius = cornerRadius
        radioXDotLayer.frame = bounds

        let path = CGMutablePath()
        let spacing: CGFloat = 18
        let radius: CGFloat = 1.15
        var y: CGFloat = 10
        while y < bounds.height {
            var x: CGFloat = 10
            while x < bounds.width {
                path.addEllipse(in: CGRect(x: x - radius, y: y - radius, width: radius * 2, height: radius * 2))
                x += spacing
            }
            y += spacing
        }
        radioXDotLayer.path = path
    }

    override func updateTrackingAreas() {
        super.updateTrackingAreas()
        if let trackingAreaRef {
            removeTrackingArea(trackingAreaRef)
        }
        let area = NSTrackingArea(
            rect: bounds,
            options: [.mouseEnteredAndExited, .activeAlways, .inVisibleRect],
            owner: self,
            userInfo: nil
        )
        addTrackingArea(area)
        trackingAreaRef = area
    }

    override func mouseEntered(with event: NSEvent) {
        onEnter?()
    }

    override func mouseExited(with event: NSEvent) {
        onExit?()
    }

    override func mouseDown(with event: NSEvent) {
        if event.clickCount >= 2 {
            onDoubleClick?()
        } else {
            onSingleClick?()
        }
    }
}

private final class RadioXButton: NSButton {
    private let primary: Bool

    init(title: String, primary: Bool = false) {
        self.primary = primary
        super.init(frame: .zero)
        self.title = title
        isBordered = false
        wantsLayer = true
        font = .systemFont(ofSize: 11, weight: primary ? .semibold : .medium)
        setButtonType(.momentaryPushIn)
        bezelStyle = .regularSquare
        contentTintColor = primary
            ? NSColor(calibratedRed: 0.012, green: 0.020, blue: 0.016, alpha: 1)
            : NSColor(calibratedRed: 0.965, green: 0.957, blue: 0.910, alpha: 0.96)
        layer?.cornerRadius = 7
        layer?.masksToBounds = true
        applyStyle(enabled: true)
    }

    required init?(coder: NSCoder) {
        nil
    }

    override var isEnabled: Bool {
        didSet {
            applyStyle(enabled: isEnabled)
        }
    }

    override func updateLayer() {
        applyStyle(enabled: isEnabled)
    }

    private func applyStyle(enabled: Bool) {
        guard let layer else { return }
        let alpha: CGFloat = enabled ? 1 : 0.42
        if primary {
            layer.backgroundColor = NSColor(calibratedRed: 0.224, green: 0.961, blue: 0.690, alpha: alpha).cgColor
            layer.borderColor = NSColor(calibratedRed: 0.224, green: 0.961, blue: 0.690, alpha: alpha).cgColor
        } else {
            layer.backgroundColor = NSColor(calibratedRed: 0.012, green: 0.020, blue: 0.016, alpha: 0.84 * alpha).cgColor
            layer.borderColor = NSColor(calibratedRed: 0.965, green: 0.957, blue: 0.910, alpha: 0.28 * alpha).cgColor
        }
        layer.borderWidth = 1
    }
}

private final class RadioXIconButton: NSButton {
    private var symbolName: String

    init(symbolName: String, label: String) {
        self.symbolName = symbolName
        super.init(frame: .zero)
        title = ""
        toolTip = label
        isBordered = false
        wantsLayer = true
        setButtonType(.momentaryPushIn)
        bezelStyle = .regularSquare
        imagePosition = .imageOnly
        contentTintColor = NSColor(calibratedRed: 0.028, green: 0.030, blue: 0.026, alpha: 1)
        layer?.cornerRadius = 16
        layer?.masksToBounds = true
        setSymbol(symbolName)
        applyStyle(enabled: true)
    }

    required init?(coder: NSCoder) {
        nil
    }

    override var isEnabled: Bool {
        didSet {
            applyStyle(enabled: isEnabled)
        }
    }

    override func updateLayer() {
        applyStyle(enabled: isEnabled)
    }

    func setSymbol(_ name: String) {
        symbolName = name
        let symbol = NSImage(systemSymbolName: name, accessibilityDescription: toolTip)
        symbol?.isTemplate = true
        image = symbol
    }

    private func applyStyle(enabled: Bool) {
        guard let layer else { return }
        let alpha: CGFloat = enabled ? 1 : 0.42
        layer.backgroundColor = NSColor(calibratedRed: 0.934, green: 0.916, blue: 0.846, alpha: 0.96 * alpha).cgColor
        layer.borderColor = NSColor(calibratedRed: 0.180, green: 0.176, blue: 0.150, alpha: 0.22 * alpha).cgColor
        layer.borderWidth = 1
    }
}

private final class RainbowMusicNoteView: NSView {
    private let gradientLayer = CAGradientLayer()
    private let noteMask = CATextLayer()

    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        wantsLayer = true
        translatesAutoresizingMaskIntoConstraints = false
        gradientLayer.colors = [
            NSColor.systemPink.cgColor,
            NSColor.systemOrange.cgColor,
            NSColor.systemYellow.cgColor,
            NSColor.systemGreen.cgColor,
            NSColor.systemBlue.cgColor,
            NSColor.systemPurple.cgColor
        ]
        gradientLayer.startPoint = CGPoint(x: 0, y: 0.5)
        gradientLayer.endPoint = CGPoint(x: 1, y: 0.5)

        noteMask.string = "🎵"
        noteMask.alignmentMode = .center
        noteMask.contentsScale = NSScreen.main?.backingScaleFactor ?? 2
        noteMask.fontSize = 15
        noteMask.foregroundColor = NSColor.white.cgColor
        gradientLayer.mask = noteMask
        layer?.addSublayer(gradientLayer)
    }

    required init?(coder: NSCoder) {
        nil
    }

    override var intrinsicContentSize: NSSize {
        NSSize(width: 18, height: 18)
    }

    override func layout() {
        super.layout()
        gradientLayer.frame = bounds
        noteMask.frame = bounds
    }
}

private final class BarController: NSObject {
    private let panel: NSPanel
    private let rootView = TrackingView()
    private let stack = NSStackView()
    private let dot = NSView()
    private let trackRow = NSStackView()
    private let noteView = RainbowMusicNoteView()
    private let actionsRow = NSStackView()
    private let transportActions = NSStackView()
    private let restCueActions = NSStackView()
    private let actionDivider = NSView()
    private let playPauseButton = RadioXIconButton(symbolName: "play.fill", label: "Play or pause")
    private let prevButton = RadioXIconButton(symbolName: "backward.end.fill", label: "Previous track")
    private let nextButton = RadioXIconButton(symbolName: "forward.end.fill", label: "Next track")
    private let favoriteButton = RadioXIconButton(symbolName: "heart", label: "Favorite")
    private let titleField = NSTextField(labelWithString: "RadioX")
    private let trackField = NSTextField(labelWithString: "connecting...")
    private let detailField = NSTextField(labelWithString: "local station")
    private let cueField = NSTextField(labelWithString: "")
    private let moreField = NSTextField(labelWithString: "")
    private let acceptButton = RadioXButton(title: "REST")
    private let laterButton = RadioXButton(title: "LATER")
    private let quitButton = RadioXButton(title: "QUIT")
    private var mode = BarMode.hidden
    private var collapseWorkItem: DispatchWorkItem?
    private var pendingClickWorkItem: DispatchWorkItem?
    private var timer: Timer?
    private var latestPayload: StationPayload?
    private var restCueSelection: RestCueSelection?
    private var dismissedUntil: Date?

    override init() {
        NSLog("RadioXBar initializing")
        panel = NSPanel(
            contentRect: NSRect(x: 0, y: 0, width: 238, height: 40),
            styleMask: [.borderless, .nonactivatingPanel],
            backing: .buffered,
            defer: false
        )
        super.init()
        configurePanel()
        configureView()
        refresh()
        timer = Timer.scheduledTimer(withTimeInterval: 12, repeats: true) { [weak self] _ in
            self?.refresh()
        }
    }

    func show() {
        NSLog("RadioXBar showing panel")
        panel.orderFrontRegardless()
        setMode(.minimal)
        scheduleCollapse(after: 20.0)
    }

    private func configurePanel() {
        panel.isReleasedWhenClosed = false
        panel.isOpaque = false
        panel.backgroundColor = .clear
        panel.hasShadow = true
        panel.level = .statusBar
        panel.isFloatingPanel = true
        panel.hidesOnDeactivate = false
        panel.becomesKeyOnlyIfNeeded = true
        panel.isMovableByWindowBackground = true
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .stationary]
        panel.ignoresMouseEvents = false
        panel.title = "RadioX Bar"
        panel.setFrame(frame(for: .hidden), display: false)
    }

    private func configureView() {
        rootView.applyRadioXStyle()
        rootView.onEnter = { [weak self] in self?.showHoverToolbar() }
        rootView.onExit = { [weak self] in self?.scheduleCollapse() }
        rootView.onSingleClick = { [weak self] in self?.scheduleDetailsClick() }
        rootView.onDoubleClick = { [weak self] in self?.openRadioXFromDoubleClick() }
        panel.contentView = rootView

        stack.orientation = .vertical
        stack.alignment = .leading
        stack.spacing = 6
        stack.translatesAutoresizingMaskIntoConstraints = false
        rootView.addSubview(stack)

        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: rootView.leadingAnchor, constant: 22),
            stack.trailingAnchor.constraint(equalTo: rootView.trailingAnchor, constant: -22),
            stack.topAnchor.constraint(equalTo: rootView.topAnchor, constant: 8),
            stack.bottomAnchor.constraint(lessThanOrEqualTo: rootView.bottomAnchor, constant: -6)
        ])

        let header = NSStackView()
        header.orientation = .horizontal
        header.alignment = .centerY
        header.spacing = 8
        header.translatesAutoresizingMaskIntoConstraints = false

        dot.wantsLayer = true
        dot.layer?.backgroundColor = NSColor.systemGreen.cgColor
        dot.layer?.cornerRadius = 4
        dot.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            dot.widthAnchor.constraint(equalToConstant: 8),
            dot.heightAnchor.constraint(equalToConstant: 8)
        ])
        NSLayoutConstraint.activate([
            noteView.widthAnchor.constraint(equalToConstant: 18),
            noteView.heightAnchor.constraint(equalToConstant: 18)
        ])

        titleField.font = .monospacedSystemFont(ofSize: 12, weight: .semibold)
        titleField.textColor = .white

        trackField.font = .systemFont(ofSize: 13, weight: .semibold)
        trackField.textColor = .white
        trackField.lineBreakMode = .byTruncatingTail
        trackField.maximumNumberOfLines = 1

        detailField.font = .systemFont(ofSize: 11)
        detailField.textColor = NSColor(white: 0.78, alpha: 1)
        detailField.lineBreakMode = .byTruncatingTail
        detailField.maximumNumberOfLines = 2

        cueField.font = .systemFont(ofSize: 11, weight: .medium)
        cueField.textColor = NSColor(calibratedRed: 0.34, green: 1, blue: 0.74, alpha: 1)
        cueField.lineBreakMode = .byWordWrapping
        cueField.maximumNumberOfLines = 3

        moreField.font = .monospacedSystemFont(ofSize: 10, weight: .regular)
        moreField.textColor = NSColor(white: 0.70, alpha: 1)
        moreField.lineBreakMode = .byWordWrapping
        moreField.maximumNumberOfLines = 5

        header.addArrangedSubview(dot)
        header.addArrangedSubview(titleField)
        let headerSpacer = NSView()
        headerSpacer.setContentHuggingPriority(.defaultLow, for: .horizontal)
        header.addArrangedSubview(headerSpacer)
        header.addArrangedSubview(quitButton)

        trackRow.orientation = .horizontal
        trackRow.alignment = .centerY
        trackRow.spacing = 6
        trackRow.addArrangedSubview(noteView)
        trackRow.addArrangedSubview(trackField)

        stack.addArrangedSubview(header)
        header.widthAnchor.constraint(equalTo: stack.widthAnchor).isActive = true
        stack.addArrangedSubview(trackRow)
        stack.addArrangedSubview(detailField)
        stack.addArrangedSubview(cueField)
        stack.addArrangedSubview(moreField)

        actionsRow.orientation = .horizontal
        actionsRow.alignment = .top
        actionsRow.spacing = 18

        transportActions.orientation = .horizontal
        transportActions.spacing = 8
        restCueActions.orientation = .horizontal
        restCueActions.spacing = 8
        restCueActions.edgeInsets = NSEdgeInsets(top: 0, left: 10, bottom: 0, right: 0)

        actionDivider.wantsLayer = true
        actionDivider.layer?.backgroundColor = NSColor(calibratedRed: 0.965, green: 0.957, blue: 0.910, alpha: 0.18).cgColor
        actionDivider.translatesAutoresizingMaskIntoConstraints = false
        actionDivider.widthAnchor.constraint(equalToConstant: 1).isActive = true
        actionDivider.heightAnchor.constraint(equalToConstant: 32).isActive = true

        playPauseButton.target = self
        playPauseButton.action = #selector(togglePlayback)
        prevButton.target = self
        prevButton.action = #selector(previousTrack)
        nextButton.target = self
        nextButton.action = #selector(nextTrack)
        favoriteButton.target = self
        favoriteButton.action = #selector(toggleFavorite)
        acceptButton.target = self
        acceptButton.action = #selector(acceptRestCue)
        laterButton.target = self
        laterButton.action = #selector(dismissRestCue)
        quitButton.target = self
        quitButton.action = #selector(quit)
        [playPauseButton, prevButton, nextButton, favoriteButton, acceptButton, laterButton, quitButton].forEach { button in
            button.controlSize = .small
            button.translatesAutoresizingMaskIntoConstraints = false
            let isIcon = button is RadioXIconButton
            button.heightAnchor.constraint(equalToConstant: isIcon ? 32 : 24).isActive = true
            let minWidth: CGFloat = isIcon ? 32 : 54
            button.widthAnchor.constraint(equalToConstant: minWidth).isActive = true
        }
        transportActions.addArrangedSubview(prevButton)
        transportActions.addArrangedSubview(playPauseButton)
        transportActions.addArrangedSubview(nextButton)
        transportActions.addArrangedSubview(favoriteButton)
        restCueActions.addArrangedSubview(acceptButton)
        restCueActions.addArrangedSubview(laterButton)
        actionsRow.addArrangedSubview(transportActions)
        actionsRow.addArrangedSubview(actionDivider)
        actionsRow.addArrangedSubview(restCueActions)
        stack.addArrangedSubview(actionsRow)
        applyMode()
    }

    private func frame(for mode: BarMode) -> NSRect {
        let size: NSSize
        switch mode {
        case .hidden:
            size = NSSize(width: 420, height: 28)
        case .minimal:
            size = NSSize(width: 390, height: 58)
        case .detail:
            size = NSSize(width: 500, height: 242)
        }
        let screenFrame = NSScreen.main?.visibleFrame ?? NSRect(x: 0, y: 0, width: 1440, height: 900)
        let x = screenFrame.midX - size.width / 2
        let y = screenFrame.maxY - size.height
        return NSRect(origin: NSPoint(x: x, y: y), size: size)
    }

    private func applyMode() {
        let visible = mode != .hidden
        let showDetails = mode == .detail
        let radius: CGFloat
        switch mode {
        case .hidden:
            radius = 14
        case .minimal:
            radius = 29
        case .detail:
            radius = 38
        }
        rootView.setRadioXCornerRadius(radius)
        panel.alphaValue = visible ? 1.0 : 0.001
        panel.hasShadow = visible
        detailField.isHidden = !showDetails
        cueField.isHidden = !showDetails
        moreField.isHidden = !showDetails
        actionsRow.isHidden = !showDetails
        actionDivider.isHidden = !showDetails
        playPauseButton.isHidden = !showDetails
        prevButton.isHidden = !showDetails
        nextButton.isHidden = !showDetails
        favoriteButton.isHidden = !showDetails
        acceptButton.isHidden = !showDetails
        laterButton.isHidden = !showDetails
        quitButton.isHidden = !showDetails
        trackRow.isHidden = !visible
        panel.setFrame(frame(for: mode), display: true, animate: false)
    }

    private func setMode(_ next: BarMode) {
        collapseWorkItem?.cancel()
        guard mode != next else {
            applyMode()
            return
        }
        mode = next
        applyMode()
    }

    private func scheduleCollapse() {
        scheduleCollapse(after: 0.65)
    }

    private func scheduleCollapse(after delay: TimeInterval) {
        collapseWorkItem?.cancel()
        let item = DispatchWorkItem { [weak self] in
            guard let self else { return }
            if self.mouseIsInsidePanel() {
                return
            }
            self.setMode(.hidden)
        }
        collapseWorkItem = item
        DispatchQueue.main.asyncAfter(deadline: .now() + delay, execute: item)
    }

    private func mouseIsInsidePanel() -> Bool {
        panel.frame.insetBy(dx: -6, dy: -6).contains(NSEvent.mouseLocation)
    }

    private func showHoverToolbar() {
        pendingClickWorkItem?.cancel()
        if mode == .detail { return }
        setMode(.minimal)
    }

    private func scheduleDetailsClick() {
        pendingClickWorkItem?.cancel()
        let item = DispatchWorkItem { [weak self] in
            self?.showDetails()
        }
        pendingClickWorkItem = item
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.22, execute: item)
    }

    private func showDetails() {
        collapseWorkItem?.cancel()
        guard mouseIsInsidePanel() else { return }
        setMode(.detail)
    }

    private func openRadioXFromDoubleClick() {
        pendingClickWorkItem?.cancel()
        setMode(.hidden)
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.04) { [weak self] in
            self?.openRadioX()
        }
    }

    @objc private func openRadioX() {
        let chromeBundleId = "com.google.Chrome"
        if isApplicationRunning(bundleIdentifier: chromeBundleId) {
            switch openOrActivateChromeRadioXPage() {
            case .found, .created:
                activateApplication(bundleIdentifier: chromeBundleId)
                return
            case .failed:
                openRadioXInChrome()
                cueField.stringValue = "Chrome 自动化权限未允许，已用兜底方式打开 RadioX。若想复用已有标签页，请在系统设置里允许 RadioXBar 控制 Chrome。"
                return
            }
        }

        openRadioXInChrome()
    }

    private func openOrActivateChromeRadioXPage() -> ChromeRadioXOpenResult {
        let targetUrl = appleScriptString(radioXURL.absoluteString)
        let source = """
        set targetUrl to "\(targetUrl)"
        tell application id "com.google.Chrome"
            repeat with w in windows
                set tabIndex to 1
                repeat with t in tabs of w
                    set tabUrl to ""
                    try
                        set tabUrl to URL of t as text
                    end try
                    if tabUrl contains "127.0.0.1:8765" or tabUrl contains "localhost:8765" then
                        set active tab index of w to tabIndex
                        try
                            set minimized of w to false
                        end try
                        try
                            set index of w to 1
                        end try
                        activate
                        return "found"
                    end if
                    set tabIndex to tabIndex + 1
                end repeat
            end repeat

            if (count of windows) = 0 then
                make new window with properties {URL:targetUrl}
            else
                tell front window
                  make new tab at end of tabs with properties {URL:targetUrl}
                  set active tab index to count of tabs
              end tell
            end if
            activate
            return "created"
        end tell
        """
        if let result = runAppleScriptReturningString(source) {
            return chromeOpenResult(from: result)
        }
        if let result = runOsaScriptReturningString(source) {
            return chromeOpenResult(from: result)
        }
        return .failed
    }

    private func isApplicationRunning(bundleIdentifier: String) -> Bool {
        NSWorkspace.shared.runningApplications.contains { app in
            app.bundleIdentifier == bundleIdentifier
        }
    }

    @discardableResult
    private func activateApplication(bundleIdentifier: String) -> Bool {
        guard let app = NSWorkspace.shared.runningApplications.first(where: { $0.bundleIdentifier == bundleIdentifier }) else {
            return false
        }
        return app.activate(options: [.activateAllWindows])
    }

    private func activateChrome() {
        let chromeBundleId = "com.google.Chrome"
        activateApplication(bundleIdentifier: chromeBundleId)
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.18) { [weak self] in
            guard let self else { return }
            self.activateApplication(bundleIdentifier: chromeBundleId)
            _ = self.runAppleScript("""
            tell application id "com.google.Chrome"
                activate
            end tell
            """)
        }
    }

    private func openRadioXInChrome() {
        let ok = openUrlInApplication(named: "Google Chrome", url: radioXURL)
        if !ok {
            NSWorkspace.shared.open(radioXURL)
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.18) { [weak self] in
            self?.activateChrome()
        }
    }

    @discardableResult
    private func openUrlInApplication(named applicationName: String, url: URL) -> Bool {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/open")
        process.arguments = ["-a", applicationName, url.absoluteString]
        do {
            try process.run()
            process.waitUntilExit()
            return process.terminationStatus == 0
        } catch {
            NSLog("RadioXBar failed to open \(url.absoluteString) in \(applicationName): \(error.localizedDescription)")
            return false
        }
    }

    private func runAppleScript(_ source: String) -> Bool {
        runAppleScriptReturningString(source) != nil
    }

    private func runAppleScriptReturningString(_ source: String) -> String? {
        var error: NSDictionary?
        guard let script = NSAppleScript(source: source) else {
            return nil
        }
        let result = script.executeAndReturnError(&error)
        if let error {
            NSLog("RadioXBar AppleScript failed: \(error)")
            return nil
        }
        return result.stringValue ?? (result.booleanValue ? "true" : "false")
    }

    private func runOsaScriptReturningString(_ source: String) -> String? {
        let process = Process()
        let output = Pipe()
        let errors = Pipe()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/osascript")
        process.arguments = ["-e", source]
        process.standardOutput = output
        process.standardError = errors
        do {
            try process.run()
            process.waitUntilExit()
            let outputText = String(data: output.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8)?
                .trimmingCharacters(in: .whitespacesAndNewlines)
            if process.terminationStatus == 0, let outputText, !outputText.isEmpty {
                return outputText
            }
            let errorText = String(data: errors.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8)?
                .trimmingCharacters(in: .whitespacesAndNewlines)
            NSLog("RadioXBar osascript failed: \(errorText ?? "unknown error")")
            return nil
        } catch {
            NSLog("RadioXBar failed to run osascript: \(error.localizedDescription)")
            return nil
        }
    }

    private func chromeOpenResult(from value: String) -> ChromeRadioXOpenResult {
        switch value.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() {
        case "found":
            return .found
        case "created":
            return .created
        default:
            return .failed
        }
    }

    private func appleScriptString(_ value: String) -> String {
        value
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "\"", with: "\\\"")
    }

    @objc private func togglePlayback() {
        let nextPlaying = !(latestPayload?.state?.playing ?? false)
        playPauseButton.setSymbol(nextPlaying ? "pause.fill" : "play.fill")
        postJson(path: "api/play-state", body: ["playing": nextPlaying]) { [weak self] ok in
            DispatchQueue.main.async {
                guard let self else { return }
                if ok {
                    self.refresh()
                } else {
                    self.cueField.stringValue = "播放控制没有送达，本地 server 可能断开了。"
                }
            }
        }
    }

    @objc private func previousTrack() {
        prevButton.isEnabled = false
        postJson(path: "api/previous", body: [:]) { [weak self] ok in
            DispatchQueue.main.async {
                guard let self else { return }
                self.prevButton.isEnabled = self.latestPayload?.current != nil
                if ok {
                    self.refresh()
                } else {
                    self.cueField.stringValue = "上一首切换失败。"
                }
            }
        }
    }

    @objc private func nextTrack() {
        nextButton.isEnabled = false
        postJson(path: "api/next", body: [:]) { [weak self] ok in
            DispatchQueue.main.async {
                guard let self else { return }
                self.nextButton.isEnabled = self.latestPayload?.current != nil
                if ok {
                    self.refresh()
                } else {
                    self.cueField.stringValue = "下一首切换失败。"
                }
            }
        }
    }

    @objc private func toggleFavorite() {
        guard let current = latestPayload?.current else { return }
        let favoriteIds = latestPayload?.state?.favoriteIds ?? []
        let nextFavorite = !favoriteIds.contains(current.id)
        favoriteButton.setSymbol(nextFavorite ? "heart.fill" : "heart")
        postJson(path: "api/favorite", body: [
            "trackId": current.id,
            "favorite": nextFavorite,
            "source": "toolbar"
        ]) { [weak self] ok in
            DispatchQueue.main.async {
                guard let self else { return }
                if ok {
                    self.refresh()
                } else {
                    self.favoriteButton.setSymbol(nextFavorite ? "heart" : "heart.fill")
                    self.cueField.stringValue = "收藏没有送达，本地 server 可能断开了。"
                }
            }
        }
    }

    @objc private func acceptRestCue() {
        guard let selection = restCueSelection else {
            cueField.stringValue = "当前 Queue 里没有可切换的放松曲目。"
            return
        }

        acceptButton.isEnabled = false
        postJson(path: "api/jump", body: [
            "index": selection.index,
            "trackId": selection.id,
            "play": true
        ]) { [weak self] ok in
            DispatchQueue.main.async {
                guard let self else { return }
                if ok {
                    self.dismissedUntil = Date().addingTimeInterval(25 * 60)
                    self.restCueSelection = nil
                    self.acceptButton.isEnabled = false
                    self.cueField.stringValue = "已请求播放 \(selection.artist) 的 \(selection.title)。网页播放器会自动同步。"
                } else {
                    self.acceptButton.isEnabled = true
                    self.cueField.stringValue = "切歌失败，先确认 RadioX server 正在运行。"
                }
            }
        }
    }

    @objc private func dismissRestCue() {
        dismissedUntil = Date().addingTimeInterval(25 * 60)
        acceptButton.isEnabled = restCueSelection != nil
        laterButton.isEnabled = restCueSelection != nil
        trackField.stringValue = "25 分钟后再提醒"
        cueField.stringValue = "好，我先不打扰你。25 分钟后如果这一轮还在继续，我再轻轻提醒。"
        moreField.stringValue = "REST CUE snoozed for 25 minutes."
        setMode(.minimal)
        scheduleCollapse(after: 1.4)
    }

    @objc private func quit() {
        NSApp.terminate(nil)
    }

    private func postJson(path: String, body: [String: Any], completion: @escaping (Bool) -> Void) {
        let url = radioXEndpoint(path)
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        URLSession.shared.dataTask(with: request) { _, response, _ in
            let http = response as? HTTPURLResponse
            completion((200..<300).contains(http?.statusCode ?? 0))
        }.resume()
    }

    private func refresh() {
        loadStation(path: "api/snapshot", fallbackToNow: true)
    }

    private func loadStation(path: String, fallbackToNow: Bool) {
        let url = radioXEndpoint(path)
        URLSession.shared.dataTask(with: url) { [weak self] data, response, error in
            DispatchQueue.main.async {
                if let error {
                    self?.showOffline(error.localizedDescription)
                    return
                }
                if fallbackToNow, (response as? HTTPURLResponse)?.statusCode == 404 {
                    self?.loadStation(path: "api/now", fallbackToNow: false)
                    return
                }
                guard let data else {
                    self?.showOffline("no response")
                    return
                }
                do {
                    let payload = try JSONDecoder().decode(StationPayload.self, from: data)
                    self?.latestPayload = payload
                    self?.render(payload)
                } catch {
                    self?.showOffline("bad payload")
                }
            }
        }.resume()
    }

    private func render(_ payload: StationPayload) {
        dot.layer?.backgroundColor = NSColor.systemGreen.cgColor
        let current = payload.current
        trackField.stringValue = current.map { "\($0.title)" } ?? "tuning next queue"
        titleField.stringValue = "RadioX"
        playPauseButton.setSymbol((payload.state?.playing ?? false) ? "pause.fill" : "play.fill")
        playPauseButton.isEnabled = current != nil
        prevButton.isEnabled = current != nil
        nextButton.isEnabled = current != nil
        favoriteButton.isEnabled = current != nil
        let favoriteIds = payload.state?.favoriteIds ?? []
        favoriteButton.setSymbol(current.map { favoriteIds.contains($0.id) } == true ? "heart.fill" : "heart")

        if let current {
            detailField.stringValue = "\(current.artist) - \(current.title)"
        } else {
            detailField.stringValue = "正在整理下一批歌，优先避开最近听过的曲目。"
        }

        if let context = payload.context {
            let candidate = restCueCandidate(in: payload)
            restCueSelection = candidate.map {
                RestCueSelection(index: $0.index, id: $0.track.id, title: $0.track.title, artist: $0.track.artist)
            }
            acceptButton.isEnabled = restCueSelection != nil
            laterButton.isEnabled = restCueSelection != nil
            cueField.stringValue = restCueText(payload: payload, context: context)
            moreField.stringValue = detailedText(payload: payload, context: context)
        } else {
            restCueSelection = nil
            acceptButton.isEnabled = false
            laterButton.isEnabled = false
            cueField.stringValue = "连接本地电台，等你需要松一下时我会浮出来。"
            moreField.stringValue = "等待本地 RadioX 服务返回更多上下文。"
        }
    }

    private func showOffline(_ message: String) {
        latestPayload = nil
        restCueSelection = nil
        acceptButton.isEnabled = false
        laterButton.isEnabled = false
        playPauseButton.setSymbol("play.fill")
        playPauseButton.isEnabled = false
        prevButton.isEnabled = false
        nextButton.isEnabled = false
        favoriteButton.isEnabled = false
        favoriteButton.setSymbol("heart")
        dot.layer?.backgroundColor = NSColor.systemYellow.cgColor
        titleField.stringValue = "RadioX"
        trackField.stringValue = "offline"
        detailField.stringValue = "本地服务没有响应：\(message)"
        cueField.stringValue = "先启动 RadioX server，再打开这个工具条。"
        moreField.stringValue = "服务地址：\(radioXURL.absoluteString)"
    }

    private func restCueText(payload: StationPayload, context: StationPayload.Context) -> String {
        let busy = context.intensity >= 4 || ["workday", "night"].contains(context.now.dayPart)
        let candidate = restCueCandidate(in: payload)

        if let dismissedUntil, dismissedUntil > Date() {
            if let candidate {
                return "我先不主动提醒；如果你现在想切，仍可点 PLAY 切到 \(candidate.track.artist) 的 \(candidate.track.title)。"
            }
            return "我先不主动提醒。稍后如果这一轮还在继续，我再出现。"
        }

        if busy, let candidate {
            return "REST CUE：如果这轮工作有点久，可以切到 \(candidate.track.artist) 的 \(candidate.track.title)。"
        }
        if let current = payload.current {
            return "正在播放：\(current.artist)。"
        }
        return "RadioX 正在待命。"
    }

    private func restCueCandidate(in payload: StationPayload) -> (index: Int, track: StationPayload.Track)? {
        let currentTitle = payload.current?.title
        let currentArtist = payload.current?.artist
        return payload.queue
            .enumerated()
            .filter { _, track in
                !(track.title == currentTitle && track.artist == currentArtist)
            }
            .map { index, track in
                (index: index, track: track, score: relaxationScore(track))
            }
            .sorted { left, right in
                left.score > right.score
            }
            .first
            .map { (index: $0.index, track: $0.track) }
    }

    private func relaxationScore(_ track: StationPayload.Track) -> Int {
        let energy = track.energy ?? 50
        return max(0, 60 - energy) + (energy <= 55 ? 24 : 0) - (energy > 70 ? 30 : 0)
    }

    private func detailedText(payload: StationPayload, context: StationPayload.Context) -> String {
        let current = payload.current
        let trackLine = current.map { "\($0.artist) / \($0.title)" } ?? "no current track"
        let candidateLine = restCueCandidate(in: payload)
            .map { "\($0.track.artist) / \($0.track.title)" }
            ?? "no rest cue candidate"
        return [
            "track: \(trackLine)",
            "weather: \(context.weather) · mood: \(context.mood)",
            "rest cue: \(candidateLine)"
        ].joined(separator: "\n")
    }
}

private final class AppDelegate: NSObject, NSApplicationDelegate {
    private var barController: BarController?

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSLog("RadioXBar did finish launching")
        barController = BarController()
        barController?.show()
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        false
    }
}

private let app = NSApplication.shared
private let delegate = AppDelegate()
guard claimSingleInstance() else {
    NSLog("RadioXBar already running; exiting duplicate instance")
    exit(0)
}
app.delegate = delegate
app.setActivationPolicy(.accessory)
NSLog("RadioXBar starting run loop")
app.run()
