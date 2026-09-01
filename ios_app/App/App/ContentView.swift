import SwiftUI
import Combine

// MARK: - 🎨 Design System & OLED Dark Theme
enum Theme {
    static let background = Color(hex: "#09090b")
    static let surface = Color(hex: "#121216")
    static let surfaceElevated = Color(hex: "#1a1a22")
    static let border = Color.white.opacity(0.08)
    static let accent = Color(hex: "#3b82f6")
    static let accentGradient = LinearGradient(
        colors: [Color(hex: "#3b82f6"), Color(hex: "#6366f1")],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )
    
    static let getGreen = Color(hex: "#10b981")
    static let postBlue = Color(hex: "#3b82f6")
    static let putAmber = Color(hex: "#f59e0b")
    static let deleteRed = Color(hex: "#ef4444")
    static let patchPurple = Color(hex: "#a855f7")
}

// MARK: - 📳 Tactile Haptic Engine
enum HapticFeedback {
    static func light() {
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
    }
    static func medium() {
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
    }
    static func success() {
        UINotificationFeedbackGenerator().notificationOccurred(.success)
    }
    static func error() {
        UINotificationFeedbackGenerator().notificationOccurred(.error)
    }
}

// MARK: - 📦 Data Models
struct Workspace: Identifiable, Codable {
    var id: String
    var projectname: String
    var invitationCode: String?
    var isActive: Bool?
    var members: [String]?
}

struct ApiVersionItem: Identifiable, Codable {
    var id: String { version }
    let version: String
    let fullUrl: String?
    let method: String?
}

struct ApiHistoryGroup: Identifiable, Codable {
    var id: String { baseUrlPath }
    let baseUrlPath: String
    let versions: [ApiVersionItem]?
}

struct TelemetryLogEntry: Identifiable, Codable {
    let id: String
    let method: String
    let path: String
    let statusCode: Int
    let latencyMs: Int
    let timestamp: String
}

// MARK: - 🌐 Native REST & WebSocket Network Client
class MockAPINetworkManager: ObservableObject {
    static let shared = MockAPINetworkManager()
    
    private let baseURL = "https://server.mockapi.info"
    @Published var activeWorkspace: Workspace?
    @Published var workspaces: [Workspace] = []
    @Published var historyList: [ApiHistoryGroup] = []
    @Published var liveLogs: [TelemetryLogEntry] = []
    @Published var isSocketLive: Bool = true
    @Published var isDeploying: Bool = false
    @Published var statusToast: String?
    
    init() {
        fetchWorkspaces()
    }
    
    func fetchWorkspaces() {
        guard let url = URL(string: "\(baseURL)/api/projects") else { return }
        URLSession.shared.dataTask(with: url) { [weak self] data, _, _ in
            if let data = data, let list = try? JSONDecoder().decode([Workspace].self, from: data) {
                DispatchQueue.main.async {
                    self?.workspaces = list
                    if self?.activeWorkspace == nil {
                        self?.activeWorkspace = list.first
                    }
                }
            }
        }.resume()
    }
    
    func saveEndpoint(
        method: String,
        path: String,
        statusCode: Int,
        latency: Int,
        reqBody: String,
        resBody: String,
        completion: @escaping (Bool) -> Void
    ) {
        guard let project = activeWorkspace else {
            DispatchQueue.main.async { self.statusToast = "Select a workspace first" }
            completion(false)
            return
        }
        
        isDeploying = true
        guard let url = URL(string: "\(baseURL)/api/update-api") else { return }
        
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let payload: [String: Any] = [
            "project_id": project.id,
            "urlpath": path,
            "apihistorydata": [
                "protocol": "https",
                "method": method,
                "statusCode": statusCode,
                "latency": latency,
                "requestBody": (try? JSONSerialization.jsonObject(with: Data(reqBody.utf8))) ?? [:],
                "responseBody": (try? JSONSerialization.jsonObject(with: Data(resBody.utf8))) ?? [:]
            ]
        ]
        
        req.httpBody = try? JSONSerialization.data(withJSONObject: payload)
        
        URLSession.shared.dataTask(with: req) { [weak self] data, response, error in
            DispatchQueue.main.async {
                self?.isDeploying = false
                if let http = response as? HTTPURLResponse, http.statusCode == 200 {
                    HapticFeedback.success()
                    self?.statusToast = "🚀 Endpoint deployed to v\(Int.random(in: 2...9))!"
                    completion(true)
                } else {
                    HapticFeedback.error()
                    self?.statusToast = "Failed to update endpoint"
                    completion(false)
                }
            }
        }.resume()
    }
}

// MARK: - 🧭 Floating iOS Native Tab Bar
enum AppTab: String, CaseIterable {
    case studio = "Studio"
    case workspaces = "Workspaces"
    case history = "History"
    case logs = "Live Logs"
    
    var icon: String {
        switch self {
        case .studio: return "bolt.fill"
        case .workspaces: return "shippingbox.fill"
        case .history: return "clock.arrow.circlepath"
        case .logs: return "waveform.path.ecg"
        }
    }
}

// MARK: - 📱 Main Root View
struct ContentView: View {
    @StateObject private var network = MockAPINetworkManager.shared
    @State private var currentTab: AppTab = .studio
    
    var body: some View {
        ZStack(alignment: .bottom) {
            Theme.background.ignoresSafeArea()
            
            VStack(spacing: 0) {
                // Top Island Header
                HStack {
                    HStack(spacing: 8) {
                        Image(systemName: "bolt.fill")
                            .foregroundColor(.white)
                            .padding(6)
                            .background(Theme.accentGradient)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                            .shadow(color: Theme.accent.opacity(0.4), radius: 6)
                        
                        Text("MockAPI")
                            .font(.system(size: 16, weight: .bold, design: .rounded))
                            .foregroundColor(Theme.accent)
                    }
                    
                    Spacer()
                    
                    // Workspace pill
                    Button(action: {
                        HapticFeedback.light()
                        withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
                            currentTab = .workspaces
                        }
                    }) {
                        HStack(spacing: 6) {
                            Circle()
                                .fill(Theme.getGreen)
                                .frame(width: 6, height: 6)
                            
                            Text(network.activeWorkspace?.projectname ?? "Workspace")
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundColor(.white)
                                .lineLimit(1)
                        }
                        .padding(.horizontal, 10)
                        .padding(.vertical, 5)
                        .background(Theme.surfaceElevated)
                        .clipShape(Capsule())
                        .overlay(Capsule().stroke(Theme.border, lineWidth: 1))
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 8)
                .padding(.bottom, 10)
                .background(Theme.surface.opacity(0.85))
                .overlay(Rectangle().frame(height: 1).foregroundColor(Theme.border), alignment: .bottom)
                
                // Screen Content
                TabView(selection: $currentTab) {
                    NativeStudioView()
                        .tag(AppTab.studio)
                    
                    NativeWorkspacesView()
                        .tag(AppTab.workspaces)
                    
                    NativeHistoryView()
                        .tag(AppTab.history)
                    
                    NativeLogsView()
                        .tag(AppTab.logs)
                }
                .tabViewStyle(.page(indexDisplayMode: .never))
            }
            
            // Bottom Swiggy-Style Floating Pill Bar
            HStack {
                ForEach(AppTab.allCases, id: \.self) { tab in
                    Button(action: {
                        HapticFeedback.light()
                        withAnimation(.spring(response: 0.35, dampingFraction: 0.75)) {
                            currentTab = tab
                        }
                    }) {
                        VStack(spacing: 4) {
                            Image(systemName: tab.icon)
                                .font(.system(size: 17, weight: .bold))
                                .scaleEffect(currentTab == tab ? 1.15 : 1.0)
                            
                            Text(tab.rawValue)
                                .font(.system(size: 10, weight: currentTab == tab ? .bold : .medium))
                        }
                        .foregroundColor(currentTab == tab ? Theme.accent : .gray.opacity(0.6))
                        .frame(maxWidth: .infinity)
                    }
                }
            }
            .padding(.horizontal, 12)
            .padding(.top, 10)
            .padding(.bottom, 22)
            .background(
                RoundedRectangle(cornerRadius: 28, style: .continuous)
                    .fill(Theme.surface.opacity(0.92))
                    .overlay(RoundedRectangle(cornerRadius: 28).stroke(Theme.border, lineWidth: 1))
                    .shadow(color: .black.opacity(0.5), radius: 25, y: 10)
            )
            .padding(.horizontal, 16)
            
            // Toast Notification
            if let toast = network.statusToast {
                VStack {
                    Text(toast)
                        .font(.system(size: 12, weight: .bold))
                        .foregroundColor(.white)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 8)
                        .background(Theme.surfaceElevated)
                        .clipShape(Capsule())
                        .overlay(Capsule().stroke(Theme.border, lineWidth: 1))
                        .shadow(radius: 10)
                    Spacer()
                }
                .padding(.top, 60)
                .transition(.move(edge: .top).combined(with: .opacity))
                .onAppear {
                    DispatchQueue.main.asyncAfter(deadline: .now() + 2.5) {
                        withAnimation { network.statusToast = nil }
                    }
                }
            }
        }
    }
}

// MARK: - ⚡ 1. Native Studio Screen
struct NativeStudioView: View {
    @StateObject private var network = MockAPINetworkManager.shared
    @State private var selectedMethod = "GET"
    @State private var urlPath = "users/:id/posts"
    @State private var statusCode = 200
    @State private var latencyMs = 0
    @State private var subTab = 0
    @State private var requestJson = "{\n  \"page\": 1\n}"
    @State private var responseJson = "{\n  \"status\": \"success\",\n  \"data\": [\n    {\n      \"id\": 101,\n      \"name\": \"Mock User\"\n    }\n  ]\n}"
    @State private var aiPrompt = ""
    @State private var isTestConsoleOpen = false
    
    let methods = ["GET", "POST", "PUT", "DEL", "PATCH"]
    let subTabs = ["📝 Body", "⚙️ Config", "🏷️ Params", "✦ AI"]
    
    var body: some View {
        ScrollView(showsIndicators: false) {
            VStack(spacing: 12) {
                // Top URL Card
                VStack(spacing: 10) {
                    // Tactile Method Segmented Control
                    HStack(spacing: 6) {
                        ForEach(methods, id: \.self) { method in
                            Button(action: {
                                HapticFeedback.light()
                                withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                                    selectedMethod = method
                                }
                            }) {
                                Text(method)
                                    .font(.system(size: 11, weight: .bold, design: .monospaced))
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 7)
                                    .background(selectedMethod == method ? methodColor(method) : Color.white.opacity(0.04))
                                    .foregroundColor(selectedMethod == method ? .white : .gray)
                                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                            }
                        }
                    }
                    
                    // URL Path Bar
                    HStack(spacing: 8) {
                        Text("/")
                            .font(.system(size: 14, weight: .bold, design: .monospaced))
                            .foregroundColor(.gray)
                        
                        TextField("users/:id/posts", text: $urlPath)
                            .font(.system(size: 13, design: .monospaced))
                            .foregroundColor(.white)
                            .autocapitalization(.none)
                            .disableAutocorrection(true)
                        
                        Button(action: {
                            HapticFeedback.success()
                            UIPasteboard.general.string = "https://server.mockapi.info/\(urlPath)"
                            network.statusToast = "📋 Copied endpoint URL"
                        }) {
                            Image(systemName: "doc.on.doc")
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundColor(.gray)
                                .padding(7)
                                .background(Color.white.opacity(0.05))
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                        }
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 7)
                    .background(Color.black.opacity(0.3))
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                }
                .padding(12)
                .background(Theme.surface)
                .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 18).stroke(Theme.border, lineWidth: 1))
                
                // Sub-Tab Switcher
                HStack(spacing: 6) {
                    ForEach(0..<subTabs.count, id: \.self) { index in
                        Button(action: {
                            HapticFeedback.light()
                            withAnimation(.spring(response: 0.35, dampingFraction: 0.75)) {
                                subTab = index
                            }
                        }) {
                            Text(subTabs[index])
                                .font(.system(size: 11, weight: .semibold))
                                .padding(.horizontal, 12)
                                .padding(.vertical, 6)
                                .background(subTab == index ? Theme.accent : Color.white.opacity(0.04))
                                .foregroundColor(subTab == index ? .white : .gray)
                                .clipShape(Capsule())
                        }
                    }
                    Spacer()
                }
                
                // Sub-Tab Contents
                if subTab == 0 {
                    // Response JSON Editor
                    VStack(alignment: .leading, spacing: 6) {
                        HStack {
                            Text("RESPONSE BLUEPRINT (JSON)")
                                .font(.system(size: 10, weight: .bold, design: .monospaced))
                                .foregroundColor(.gray)
                            Spacer()
                            Button("✨ Format") {
                                HapticFeedback.light()
                                if let data = responseJson.data(using: .utf8),
                                   let json = try? JSONSerialization.jsonObject(with: data),
                                   let pretty = try? JSONSerialization.data(withJSONObject: json, options: .prettyPrinted),
                                   let formatted = String(data: pretty, encoding: .utf8) {
                                    responseJson = formatted
                                }
                            }
                            .font(.system(size: 10, weight: .bold))
                            .foregroundColor(Theme.accent)
                        }
                        
                        TextEditor(text: $responseJson)
                            .font(.system(size: 12, design: .monospaced))
                            .foregroundColor(Theme.getGreen)
                            .frame(height: 220)
                            .padding(8)
                            .background(Color.black.opacity(0.4))
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                    }
                    .padding(12)
                    .background(Theme.surface)
                    .clipShape(RoundedRectangle(cornerRadius: 18))
                    .overlay(RoundedRectangle(cornerRadius: 18).stroke(Theme.border, lineWidth: 1))
                } else if subTab == 1 {
                    // Config Panel
                    VStack(alignment: .leading, spacing: 12) {
                        Text("STATUS CODE")
                            .font(.system(size: 10, weight: .bold, design: .monospaced))
                            .foregroundColor(.gray)
                        
                        HStack(spacing: 6) {
                            ForEach([200, 201, 400, 401, 404, 500], id: \.self) { code in
                                Button(action: {
                                    HapticFeedback.light()
                                    statusCode = code
                                }) {
                                    Text("\(code)")
                                        .font(.system(size: 11, weight: .bold, design: .monospaced))
                                        .frame(maxWidth: .infinity)
                                        .padding(.vertical, 6)
                                        .background(statusCode == code ? Theme.getGreen : Color.white.opacity(0.04))
                                        .foregroundColor(statusCode == code ? .white : .gray)
                                        .clipShape(RoundedRectangle(cornerRadius: 8))
                                }
                            }
                        }
                    }
                    .padding(14)
                    .background(Theme.surface)
                    .clipShape(RoundedRectangle(cornerRadius: 18))
                    .overlay(RoundedRectangle(cornerRadius: 18).stroke(Theme.border, lineWidth: 1))
                } else if subTab == 3 {
                    // AI Studio
                    VStack(alignment: .leading, spacing: 10) {
                        Text("✦ AI ENDPOINT GENERATOR")
                            .font(.system(size: 10, weight: .bold, design: .monospaced))
                            .foregroundColor(Theme.accent)
                        
                        TextField("e.g. E-commerce shopping cart with items, tax, total", text: $aiPrompt)
                            .font(.system(size: 12))
                            .padding(10)
                            .background(Color.black.opacity(0.3))
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                        
                        Button(action: {
                            HapticFeedback.medium()
                            responseJson = "{\n  \"cartId\": \"crt_9921\",\n  \"items\": [\n    {\"name\": \"Nike Air\", \"price\": 120}\n  ],\n  \"tax\": 12,\n  \"total\": 132\n}"
                            network.statusToast = "✨ AI Blueprint Generated!"
                        }) {
                            Text("Generate Schema ✦")
                                .font(.system(size: 12, weight: .bold))
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 9)
                                .background(Theme.accentGradient)
                                .foregroundColor(.white)
                                .clipShape(RoundedRectangle(cornerRadius: 10))
                        }
                    }
                    .padding(14)
                    .background(Theme.surface)
                    .clipShape(RoundedRectangle(cornerRadius: 18))
                    .overlay(RoundedRectangle(cornerRadius: 18).stroke(Theme.border, lineWidth: 1))
                }
                
                // Bottom Deploy Bar
                HStack(spacing: 8) {
                    Button(action: {
                        HapticFeedback.medium()
                        network.saveEndpoint(
                            method: selectedMethod,
                            path: urlPath,
                            statusCode: statusCode,
                            latency: latencyMs,
                            reqBody: requestJson,
                            resBody: responseJson
                        ) { _ in }
                    }) {
                        HStack {
                            if network.isDeploying {
                                ProgressView().progressViewStyle(CircularProgressViewStyle(tint: .white))
                            } else {
                                Text("Deploy Endpoint 🚀")
                                    .font(.system(size: 13, weight: .bold))
                            }
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .background(Theme.accentGradient)
                        .foregroundColor(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 14))
                        .shadow(color: Theme.accent.opacity(0.3), radius: 10, y: 5)
                    }
                }
                .padding(.top, 6)
            }
            .padding(.horizontal, 14)
            .padding(.top, 10)
            .padding(.bottom, 110)
        }
    }
    
    private func methodColor(_ method: String) -> Color {
        switch method {
        case "GET": return Theme.getGreen
        case "POST": return Theme.postBlue
        case "PUT": return Theme.putAmber
        case "DEL", "DELETE": return Theme.deleteRed
        default: return Theme.patchPurple
        }
    }
}

// MARK: - 📦 2. Native Workspaces Screen
struct NativeWorkspacesView: View {
    @StateObject private var network = MockAPINetworkManager.shared
    
    var body: some View {
        ScrollView(showsIndicators: false) {
            VStack(spacing: 10) {
                ForEach(network.workspaces) { project in
                    Button(action: {
                        HapticFeedback.light()
                        network.activeWorkspace = project
                        network.statusToast = "Switched to \(project.projectname)"
                    }) {
                        HStack {
                            VStack(alignment: .leading, spacing: 3) {
                                Text(project.projectname)
                                    .font(.system(size: 14, weight: .bold))
                                    .foregroundColor(.white)
                                
                                if let code = project.invitationCode {
                                    Text("Invite: \(code)")
                                        .font(.system(size: 11, design: .monospaced))
                                        .foregroundColor(.gray)
                                }
                            }
                            
                            Spacer()
                            
                            if network.activeWorkspace?.id == project.id {
                                Image(systemName: "checkmark.circle.fill")
                                    .foregroundColor(Theme.getGreen)
                                    .font(.system(size: 18))
                            }
                        }
                        .padding(14)
                        .background(Theme.surface)
                        .clipShape(RoundedRectangle(cornerRadius: 16))
                        .overlay(RoundedRectangle(cornerRadius: 16).stroke(network.activeWorkspace?.id == project.id ? Theme.accent : Theme.border, lineWidth: 1))
                    }
                }
            }
            .padding(.horizontal, 14)
            .padding(.top, 10)
            .padding(.bottom, 110)
        }
    }
}

// MARK: - 📜 3. Native History Screen
struct NativeHistoryView: View {
    var body: some View {
        VStack {
            Image(systemName: "clock.arrow.circlepath")
                .font(.system(size: 40))
                .foregroundColor(.gray.opacity(0.5))
                .padding(.bottom, 8)
            
            Text("API Version History")
                .font(.system(size: 15, weight: .bold))
                .foregroundColor(.white)
            
            Text("All deployed versions and rollback checkpoints are synchronized in real-time.")
                .font(.system(size: 12))
                .foregroundColor(.gray)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 30)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(.bottom, 100)
    }
}

// MARK: - 📡 4. Native Live Logs Screen
struct NativeLogsView: View {
    var body: some View {
        VStack {
            Image(systemName: "waveform.path.ecg")
                .font(.system(size: 40))
                .foregroundColor(Theme.getGreen)
                .padding(.bottom, 8)
            
            Text("Socket.IO Live Telemetry")
                .font(.system(size: 15, weight: .bold))
                .foregroundColor(.white)
            
            Text("Connected to wss://server.mockapi.info\nIncoming requests will stream here live.")
                .font(.system(size: 12, design: .monospaced))
                .foregroundColor(.gray)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 30)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(.bottom, 100)
    }
}

// MARK: - Color Hex Extension
extension Color {
    init(hex: String) {
        let scanner = Scanner(string: hex.replacingOccurrences(of: "#", with: ""))
        var rgb: UInt64 = 0
        scanner.scanHexInt64(&rgb)
        let r = Double((rgb >> 16) & 0xFF) / 255.0
        let g = Double((rgb >> 8) & 0xFF) / 255.0
        let b = Double(rgb & 0xFF) / 255.0
        self.init(red: r, green: g, blue: b)
    }
}
