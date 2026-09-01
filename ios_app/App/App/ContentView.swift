import SwiftUI
import Combine

// MARK: - ⚙️ 0. Dynamic .env Configuration Manager
enum Env {
    private static var envDict: [String: String] = {
        var dict: [String: String] = [:]
        
        let defaultEnv = """
        VITE_API_BASE_URL=https://server.mockapi.info
        VITE_SOCKET_URL=https://server.mockapi.info
        VITE_DOMAIN=https://client.mockapi.info
        VITE_OTP_TIMER=120
        VITE_API_URL_GUEST_SESSION=https://server.mockapi.info/api/guest-session
        VITE_API_URL_LOGIN=https://server.mockapi.info/api/login
        VITE_API_URL_LOGOUT=https://server.mockapi.info/api/logout
        VITE_API_URL_OTPRESEND=https://server.mockapi.info/api/otp-resend
        VITE_API_URL_OTPVERIFY=https://server.mockapi.info/api/otp-verify
        VITE_API_URL_SIGNUP=https://server.mockapi.info/api/setuser
        VITE_API_URL_SYNCAUTH=https://server.mockapi.info/api/sync-auth
        VITE_API_URL_VALIDEMAIL=https://server.mockapi.info/api/isemailvalid
        VITE_API_URL_VALIDUSERNAME=https://server.mockapi.info/api/isvalidusername
        VITE_API_URL_SUBSCRIBE=https://server.mockapi.info/api/subscribe
        VITE_API_URL_UNSUBSCRIBE=https://server.mockapi.info/api/unsubscribe
        VITE_API_URL_CREATEPROJECT=https://server.mockapi.info/api/create-project
        VITE_API_URL_JOINPROJECT=https://server.mockapi.info/api/join-project
        VITE_API_URL_PROJECTS=https://server.mockapi.info/api/projects
        VITE_API_UPDATE_PROJECT_STATUS=https://server.mockapi.info/api/projects
        VITE_API_URL_RESET_INVITE=https://server.mockapi.info/api/reset-invitation-code
        VITE_API_URL_VERIFY_INVITE_OTP=https://server.mockapi.info/api/verify-invitationcode-otp
        VITE_API_URL_VERIFY_PROJECT=https://server.mockapi.info/api/verify-project
        VITE_API_URL_DELETEPROJECT=https://server.mockapi.info/api/deleteproject
        VITE_API_URL_ADD_API=https://server.mockapi.info/api/add-api
        VITE_API_URL_API_HISTORY=https://server.mockapi.info/api/api-history
        VITE_API_URL_API_VERSION_DATA=https://server.mockapi.info/api/api-version-data
        VITE_API_URL_DELETE_VERSION=https://server.mockapi.info/api/versions/delete
        VITE_API_URL_UPDATE_API=https://server.mockapi.info/api/update-api
        VITE_API_URL_USER_APIS=https://server.mockapi.info/api/user-apis
        VITE_API_URL_ACCEPT_REQUEST=https://server.mockapi.info/api/requests/accept
        VITE_API_URL_REQUESTS_RECEIVED=https://server.mockapi.info/api/requests/received
        VITE_API_URL_REQUESTS_SENT=https://server.mockapi.info/api/requests/sent
        VITE_API_URL_REVOKE_REQUEST=https://server.mockapi.info/api/requests/revoke
        VITE_API_URL_ASK_AI=https://server.mockapi.info/api/ask-ai
        VITE_API_URL_REVERSE_AI=https://server.mockapi.info/api/reverse-ai
        VITE_API_URL_IMPORT_OPENAPI=https://server.mockapi.info/api/import-openapi
        VITE_MOCK_API_BASE_URL=https://server.mockapi.info
        """
        
        for line in defaultEnv.components(separatedBy: .newlines) {
            let trimmed = line.trimmingCharacters(in: .whitespacesAndNewlines)
            if trimmed.isEmpty || trimmed.hasPrefix("#") { continue }
            let parts = trimmed.split(separator: "=", maxSplits: 1).map(String.init)
            if parts.count == 2 {
                dict[parts[0].trimmingCharacters(in: .whitespaces)] = parts[1].trimmingCharacters(in: .whitespaces)
            }
        }
        
        for (key, val) in ProcessInfo.processInfo.environment {
            if key.hasPrefix("VITE_") {
                dict[key] = val
            }
        }
        
        return dict
    }()
    
    static func value(for key: String, default fallback: String = "") -> String {
        if let custom = UserDefaults.standard.string(forKey: "custom_\(key)"), !custom.isEmpty {
            return custom
        }
        return envDict[key] ?? fallback
    }
    
    static func setOverride(_ key: String, value: String) {
        UserDefaults.standard.set(value, forKey: "custom_\(key)")
    }
    
    static var apiBaseUrl: String { value(for: "VITE_API_BASE_URL", default: "https://server.mockapi.info") }
    static var socketUrl: String { value(for: "VITE_SOCKET_URL", default: "https://server.mockapi.info") }
    static var domain: String { value(for: "VITE_DOMAIN", default: "https://client.mockapi.info") }
    static var otpTimer: Int { Int(value(for: "VITE_OTP_TIMER", default: "120")) ?? 120 }
    
    static var guestSessionUrl: String { value(for: "VITE_API_URL_GUEST_SESSION", default: "\(apiBaseUrl)/api/guest-session") }
    static var loginUrl: String { value(for: "VITE_API_URL_LOGIN", default: "\(apiBaseUrl)/api/login") }
    static var logoutUrl: String { value(for: "VITE_API_URL_LOGOUT", default: "\(apiBaseUrl)/api/logout") }
    static var otpResendUrl: String { value(for: "VITE_API_URL_OTPRESEND", default: "\(apiBaseUrl)/api/otp-resend") }
    static var otpVerifyUrl: String { value(for: "VITE_API_URL_OTPVERIFY", default: "\(apiBaseUrl)/api/otp-verify") }
    static var signupUrl: String { value(for: "VITE_API_URL_SIGNUP", default: "\(apiBaseUrl)/api/setuser") }
    static var syncAuthUrl: String { value(for: "VITE_API_URL_SYNCAUTH", default: "\(apiBaseUrl)/api/sync-auth") }
    static var validEmailUrl: String { value(for: "VITE_API_URL_VALIDEMAIL", default: "\(apiBaseUrl)/api/isemailvalid") }
    static var validUsernameUrl: String { value(for: "VITE_API_URL_VALIDUSERNAME", default: "\(apiBaseUrl)/api/isvalidusername") }
    
    static var subscribeUrl: String { value(for: "VITE_API_URL_SUBSCRIBE", default: "\(apiBaseUrl)/api/subscribe") }
    static var unsubscribeUrl: String { value(for: "VITE_API_URL_UNSUBSCRIBE", default: "\(apiBaseUrl)/api/unsubscribe") }
    
    static var createProjectUrl: String { value(for: "VITE_API_URL_CREATEPROJECT", default: "\(apiBaseUrl)/api/create-project") }
    static var joinProjectUrl: String { value(for: "VITE_API_URL_JOINPROJECT", default: "\(apiBaseUrl)/api/join-project") }
    static var projectsUrl: String { value(for: "VITE_API_URL_PROJECTS", default: "\(apiBaseUrl)/api/projects") }
    static var updateProjectStatusUrl: String { value(for: "VITE_API_UPDATE_PROJECT_STATUS", default: "\(apiBaseUrl)/api/projects") }
    static var resetInviteUrl: String { value(for: "VITE_API_URL_RESET_INVITE", default: "\(apiBaseUrl)/api/reset-invitation-code") }
    static var verifyInviteOtpUrl: String { value(for: "VITE_API_URL_VERIFY_INVITE_OTP", default: "\(apiBaseUrl)/api/verify-invitationcode-otp") }
    static var verifyProjectUrl: String { value(for: "VITE_API_URL_VERIFY_PROJECT", default: "\(apiBaseUrl)/api/verify-project") }
    static var deleteProjectUrl: String { value(for: "VITE_API_URL_DELETEPROJECT", default: "\(apiBaseUrl)/api/deleteproject") }
    
    static var addApiUrl: String { value(for: "VITE_API_URL_ADD_API", default: "\(apiBaseUrl)/api/add-api") }
    static var apiHistoryUrl: String { value(for: "VITE_API_URL_API_HISTORY", default: "\(apiBaseUrl)/api/api-history") }
    static var apiVersionDataUrl: String { value(for: "VITE_API_URL_API_VERSION_DATA", default: "\(apiBaseUrl)/api/api-version-data") }
    static var deleteVersionUrl: String { value(for: "VITE_API_URL_DELETE_VERSION", default: "\(apiBaseUrl)/api/versions/delete") }
    static var updateApiUrl: String { value(for: "VITE_API_URL_UPDATE_API", default: "\(apiBaseUrl)/api/update-api") }
    static var userApisUrl: String { value(for: "VITE_API_URL_USER_APIS", default: "\(apiBaseUrl)/api/user-apis") }
    
    static var acceptRequestUrl: String { value(for: "VITE_API_URL_ACCEPT_REQUEST", default: "\(apiBaseUrl)/api/requests/accept") }
    static var requestsReceivedUrl: String { value(for: "VITE_API_URL_REQUESTS_RECEIVED", default: "\(apiBaseUrl)/api/requests/received") }
    static var requestsSentUrl: String { value(for: "VITE_API_URL_REQUESTS_SENT", default: "\(apiBaseUrl)/api/requests/sent") }
    static var revokeRequestUrl: String { value(for: "VITE_API_URL_REVOKE_REQUEST", default: "\(apiBaseUrl)/api/requests/revoke") }
    
    static var askAiUrl: String { value(for: "VITE_API_URL_ASK_AI", default: "\(apiBaseUrl)/api/ask-ai") }
    static var reverseAiUrl: String { value(for: "VITE_API_URL_REVERSE_AI", default: "\(apiBaseUrl)/api/reverse-ai") }
    static var importOpenApiUrl: String { value(for: "VITE_API_URL_IMPORT_OPENAPI", default: "\(apiBaseUrl)/api/import-openapi") }
    static var mockApiBaseUrl: String { value(for: "VITE_MOCK_API_BASE_URL", default: "https://server.mockapi.info") }
}

// MARK: - 🎨 1. Apple HIG Design System & OLED Dark Theme
enum Theme {
    static let background = Color(hex: "#09090b")
    static let surface = Color(hex: "#121216")
    static let surfaceElevated = Color(hex: "#1a1a22")
    static let surfaceHighlight = Color(hex: "#22222c")
    static let border = Color.white.opacity(0.08)
    static let borderBright = Color.white.opacity(0.18)
    static let textPrimary = Color.white
    static let textSecondary = Color(hex: "#94a3b8")
    static let textMuted = Color(hex: "#64748b")
    
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
    static let headGray = Color(hex: "#64748b")
}

// MARK: - 📳 2. Tactile Haptic Engine
enum HapticFeedback {
    static func light() { UIImpactFeedbackGenerator(style: .light).impactOccurred() }
    static func medium() { UIImpactFeedbackGenerator(style: .medium).impactOccurred() }
    static func heavy() { UIImpactFeedbackGenerator(style: .heavy).impactOccurred() }
    static func success() { UINotificationFeedbackGenerator().notificationOccurred(.success) }
    static func error() { UINotificationFeedbackGenerator().notificationOccurred(.error) }
    static func warning() { UINotificationFeedbackGenerator().notificationOccurred(.warning) }
}

// MARK: - 📦 3. Data Models
struct Workspace: Identifiable, Codable, Equatable {
    var id: String
    var projectname: String
    var invitationCode: String?
    var isActive: Bool?
    var members: [String]?
    var role: String?
}

struct ApiHistoryItem: Identifiable, Codable, Equatable {
    var id: String { version }
    let version: String
    let fullUrl: String?
    let method: String?
    let `protocol`: String?
    let statusCode: Int?
    let latency: Int?
    let createdAt: String?
    let requestBody: String?
    let responseBody: String?
}

struct ApiHistoryEndpointGroup: Identifiable, Codable, Equatable {
    var id: String { baseUrlPath }
    let baseUrlPath: String
    let versions: [ApiHistoryItem]?
}

struct TelemetryLogEntry: Identifiable, Codable, Equatable {
    var id: String
    var method: String
    var path: String
    var statusCode: Int
    var latencyMs: Int
    var timestamp: String
    var ip: String?
    var requestHeaders: [String: String]?
    var requestBody: String?
    var responseBody: String?
    
    enum CodingKeys: String, CodingKey {
        case id, _id, method, path, url, statusCode, latency, latencyMs, timestamp, createdAt, ip, headers, requestBody, responseBody
    }
    
    init(id: String, method: String, path: String, statusCode: Int, latencyMs: Int, timestamp: String, ip: String? = nil, requestHeaders: [String: String]? = nil, requestBody: String? = nil, responseBody: String? = nil) {
        self.id = id
        self.method = method
        self.path = path
        self.statusCode = statusCode
        self.latencyMs = latencyMs
        self.timestamp = timestamp
        self.ip = ip
        self.requestHeaders = requestHeaders
        self.requestBody = requestBody
        self.responseBody = responseBody
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.id = (try? container.decode(String.self, forKey: .id)) ?? (try? container.decode(String.self, forKey: ._id)) ?? UUID().uuidString
        self.method = (try? container.decode(String.self, forKey: .method)) ?? "GET"
        self.path = (try? container.decode(String.self, forKey: .path)) ?? (try? container.decode(String.self, forKey: .url)) ?? "/"
        self.statusCode = (try? container.decode(Int.self, forKey: .statusCode)) ?? 200
        self.latencyMs = (try? container.decode(Int.self, forKey: .latencyMs)) ?? (try? container.decode(Int.self, forKey: .latency)) ?? 0
        self.timestamp = (try? container.decode(String.self, forKey: .timestamp)) ?? (try? container.decode(String.self, forKey: .createdAt)) ?? "Just now"
        self.ip = try? container.decodeIfPresent(String.self, forKey: .ip)
        self.requestHeaders = try? container.decodeIfPresent([String: String].self, forKey: .headers)
        self.requestBody = try? container.decodeIfPresent(String.self, forKey: .requestBody)
        self.responseBody = try? container.decodeIfPresent(String.self, forKey: .responseBody)
    }
    
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(method, forKey: .method)
        try container.encode(path, forKey: .path)
        try container.encode(statusCode, forKey: .statusCode)
        try container.encode(latencyMs, forKey: .latencyMs)
        try container.encode(timestamp, forKey: .timestamp)
        try container.encodeIfPresent(ip, forKey: .ip)
        try container.encodeIfPresent(requestHeaders, forKey: .headers)
        try container.encodeIfPresent(requestBody, forKey: .requestBody)
        try container.encodeIfPresent(responseBody, forKey: .responseBody)
    }
}

struct KeyValuePair: Identifiable, Equatable {
    let id = UUID()
    var key: String
    var value: String
    var isEnabled: Bool = true
}

struct UserProfile: Codable, Equatable {
    var username: String
    var email: String
    var role: String
    var token: String?
    var isGuest: Bool
    var isSubscribed: Bool
}

// MARK: - 🌐 4. 100% Real Server Data Network & Socket Manager
class MockAPINetworkManager: ObservableObject {
    static let shared = MockAPINetworkManager()
    
    @Published var activeWorkspace: Workspace? {
        didSet {
            // When workspace changes, immediately reset/clear old telemetry and history
            historyList = []
            liveLogs = []
            totalRequestsCount = 0
            avgLatencyMs = 0
            
            if let active = activeWorkspace {
                fetchHistory(projectId: active.id)
                joinSocketProjectRoom(active.id)
            }
        }
    }
    @Published var workspaces: [Workspace] = []
    @Published var historyList: [ApiHistoryEndpointGroup] = []
    @Published var liveLogs: [TelemetryLogEntry] = []
    @Published var currentUser: UserProfile?
    
    @Published var isLoadingWorkspaces: Bool = false
    @Published var isLoadingHistory: Bool = false
    @Published var isSocketLive: Bool = false
    @Published var isDeploying: Bool = false
    @Published var statusToast: String?
    @Published var totalRequestsCount: Int = 0
    @Published var avgLatencyMs: Int = 0
    
    private var webSocketTask: URLSessionWebSocketTask?
    private var socketSession: URLSession?
    private var pingTimer: Timer?
    
    init() {
        loadStoredSession()
        syncAuthWithServer()
        connectWebSocket()
    }
    
    // Helper to decorate requests with Authorization + Cookie headers
    func prepareAuthorizedRequest(url: URL, method: String = "GET") -> URLRequest {
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.httpShouldHandleCookies = true
        if let token = currentUser?.token, !token.isEmpty {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            req.setValue(token, forHTTPHeaderField: "x-auth-token")
            if currentUser?.isGuest == true {
                req.setValue(token, forHTTPHeaderField: "x-guest-token")
                req.setValue("guest_token=\(token)", forHTTPHeaderField: "Cookie")
            } else {
                req.setValue("token=\(token)", forHTTPHeaderField: "Cookie")
            }
        }
        return req
    }
    
    // MARK: - Real User Session & Sync
    func loadStoredSession() {
        if let token = UserDefaults.standard.string(forKey: "mockapi_token"),
           let username = UserDefaults.standard.string(forKey: "mockapi_username") {
            let email = UserDefaults.standard.string(forKey: "mockapi_email") ?? "\(username)@mockapi.info"
            let role = UserDefaults.standard.string(forKey: "mockapi_role") ?? "user"
            let isGuest = UserDefaults.standard.bool(forKey: "mockapi_is_guest")
            let isSub = UserDefaults.standard.bool(forKey: "mockapi_is_subscribed")
            currentUser = UserProfile(username: username, email: email, role: role, token: token, isGuest: isGuest, isSubscribed: isSub)
        }
    }
    
    func saveUserSession(user: UserProfile) {
        currentUser = user
        UserDefaults.standard.set(user.token, forKey: "mockapi_token")
        UserDefaults.standard.set(user.username, forKey: "mockapi_username")
        UserDefaults.standard.set(user.email, forKey: "mockapi_email")
        UserDefaults.standard.set(user.role, forKey: "mockapi_role")
        UserDefaults.standard.set(user.isGuest, forKey: "mockapi_is_guest")
        UserDefaults.standard.set(user.isSubscribed, forKey: "mockapi_is_subscribed")
        fetchWorkspaces()
    }
    
    func syncAuthWithServer() {
        guard let url = URL(string: Env.syncAuthUrl) else { return }
        let request = prepareAuthorizedRequest(url: url)
        
        URLSession.shared.dataTask(with: request) { [weak self] data, response, error in
            guard let self = self, let data = data else {
                self?.fetchWorkspaces()
                return
            }
            if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let userDict = json["user"] as? [String: Any],
               let username = userDict["username"] as? String {
                DispatchQueue.main.async {
                    let email = userDict["email"] as? String ?? "\(username)@mockapi.info"
                    let role = userDict["role"] as? String ?? "user"
                    let isSub = (userDict["subscribe"] as? Bool) ?? false
                    let isGuest = role == "guest"
                    let profile = UserProfile(username: username, email: email, role: role, token: self.currentUser?.token, isGuest: isGuest, isSubscribed: isSub)
                    self.currentUser = profile
                    self.fetchWorkspaces()
                }
            } else {
                DispatchQueue.main.async {
                    self.fetchWorkspaces()
                }
            }
        }.resume()
    }
    
    // MARK: - Server Login (/api/login)
    func login(username: String, password: String, completion: @escaping (Bool, String?) -> Void) {
        guard let url = URL(string: Env.loginUrl) else {
            completion(false, "Invalid login URL")
            return
        }
        
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpShouldHandleCookies = true
        
        let payload = [
            "username": username.trimmingCharacters(in: .whitespacesAndNewlines),
            "password": password
        ]
        req.httpBody = try? JSONSerialization.data(withJSONObject: payload)
        
        URLSession.shared.dataTask(with: req) { [weak self] data, response, error in
            DispatchQueue.main.async {
                if let error = error {
                    completion(false, "Network error: \(error.localizedDescription)")
                    return
                }
                guard let data = data,
                      let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                    let rawStr = data != nil ? String(data: data!, encoding: .utf8) ?? "" : ""
                    completion(false, "Invalid server response: \(rawStr)")
                    return
                }
                
                if let token = json["token"] as? String {
                    let userDict = json["user"] as? [String: Any]
                    let uName = userDict?["username"] as? String ?? username
                    let email = userDict?["email"] as? String ?? "\(uName)@mockapi.info"
                    let role = userDict?["role"] as? String ?? "user"
                    let isSub = (userDict?["subscribe"] as? Bool) ?? false
                    
                    let profile = UserProfile(username: uName, email: email, role: role, token: token, isGuest: false, isSubscribed: isSub)
                    self?.saveUserSession(user: profile)
                    self?.statusToast = "Welcome back, @\(uName)!"
                    HapticFeedback.success()
                    completion(true, nil)
                } else {
                    let msg = json["message"] as? String ?? json["error"] as? String ?? "Login failed. Please verify credentials."
                    completion(false, msg)
                }
            }
        }.resume()
    }
    
    // MARK: - Guest Session Creation (/api/guest-session)
    func createGuestSession(completion: @escaping (Bool, String?) -> Void) {
        guard let url = URL(string: Env.guestSessionUrl) else {
            completion(false, "Invalid guest session URL")
            return
        }
        
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpShouldHandleCookies = true
        
        URLSession.shared.dataTask(with: req) { [weak self] data, response, error in
            DispatchQueue.main.async {
                if let error = error {
                    completion(false, error.localizedDescription)
                    return
                }
                guard let data = data,
                      let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                    completion(false, "Invalid response from server")
                    return
                }
                
                if let token = json["token"] as? String {
                    let profile = UserProfile(username: "Guest Developer", email: "guest@mockapi.info", role: "guest", token: token, isGuest: true, isSubscribed: false)
                    self?.saveUserSession(user: profile)
                    self?.statusToast = "Logged in as Guest"
                    HapticFeedback.success()
                    completion(true, nil)
                } else {
                    let msg = json["message"] as? String ?? json["error"] as? String ?? "Failed to create guest session"
                    completion(false, msg)
                }
            }
        }.resume()
    }
    
    // MARK: - Sign Up (Step 1: /api/setuser)
    func signup(name: String, username: String, email: String, password: String, completion: @escaping (Bool, String) -> Void) {
        guard let url = URL(string: Env.signupUrl) else {
            completion(false, "Invalid signup URL")
            return
        }
        
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpShouldHandleCookies = true
        
        let payload = [
            "name": name.trimmingCharacters(in: .whitespacesAndNewlines),
            "username": username.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(),
            "email": email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(),
            "password": password
        ]
        req.httpBody = try? JSONSerialization.data(withJSONObject: payload)
        
        URLSession.shared.dataTask(with: req) { data, response, error in
            DispatchQueue.main.async {
                if let error = error {
                    completion(false, error.localizedDescription)
                    return
                }
                guard let data = data,
                      let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                    completion(false, "Invalid response from server")
                    return
                }
                
                let success = json["success"] as? Bool ?? false
                let msg = json["message"] as? String ?? json["error"] as? String ?? ""
                
                if success {
                    HapticFeedback.success()
                    completion(true, msg.isEmpty ? "OTP code sent to your email!" : msg)
                } else {
                    completion(false, msg.isEmpty ? "Signup failed" : msg)
                }
            }
        }.resume()
    }
    
    // MARK: - OTP Verification (Step 2: /api/otp-verify)
    func verifyOtp(name: String, username: String, email: String, password: String, otp: String, completion: @escaping (Bool, String?) -> Void) {
        guard let url = URL(string: Env.otpVerifyUrl) else {
            completion(false, "Invalid OTP verify URL")
            return
        }
        
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpShouldHandleCookies = true
        
        let payload = [
            "name": name.trimmingCharacters(in: .whitespacesAndNewlines),
            "username": username.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(),
            "email": email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(),
            "password": password,
            "otp": otp.trimmingCharacters(in: .whitespacesAndNewlines)
        ]
        req.httpBody = try? JSONSerialization.data(withJSONObject: payload)
        
        URLSession.shared.dataTask(with: req) { [weak self] data, response, error in
            DispatchQueue.main.async {
                if let error = error {
                    completion(false, error.localizedDescription)
                    return
                }
                guard let data = data,
                      let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                    completion(false, "Invalid response from server")
                    return
                }
                
                if let token = json["token"] as? String {
                    let userDict = json["user"] as? [String: Any]
                    let uName = userDict?["username"] as? String ?? username
                    let uEmail = userDict?["email"] as? String ?? email
                    let role = userDict?["role"] as? String ?? "user"
                    let isSub = (userDict?["subscribe"] as? Bool) ?? false
                    
                    let profile = UserProfile(username: uName, email: uEmail, role: role, token: token, isGuest: false, isSubscribed: isSub)
                    self?.saveUserSession(user: profile)
                    self?.statusToast = "Account verified! Welcome, @\(uName)"
                    HapticFeedback.success()
                    completion(true, nil)
                } else {
                    let msg = json["message"] as? String ?? json["error"] as? String ?? "Invalid OTP code"
                    completion(false, msg)
                }
            }
        }.resume()
    }
    
    // MARK: - Resend OTP (/api/otp-resend)
    func resendOtp(name: String, username: String, email: String, password: String, completion: @escaping (Bool, String) -> Void) {
        guard let url = URL(string: Env.otpResendUrl) else {
            completion(false, "Invalid URL")
            return
        }
        
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpShouldHandleCookies = true
        
        let payload = [
            "name": name.trimmingCharacters(in: .whitespacesAndNewlines),
            "username": username.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(),
            "email": email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(),
            "password": password
        ]
        req.httpBody = try? JSONSerialization.data(withJSONObject: payload)
        
        URLSession.shared.dataTask(with: req) { data, response, error in
            DispatchQueue.main.async {
                if let error = error {
                    completion(false, error.localizedDescription)
                    return
                }
                guard let data = data,
                      let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                    completion(false, "Invalid response")
                    return
                }
                let success = json["success"] as? Bool ?? false
                let msg = json["message"] as? String ?? json["error"] as? String ?? ""
                if success {
                    completion(true, msg.isEmpty ? "New OTP sent to your email" : msg)
                } else {
                    completion(false, msg.isEmpty ? "Failed to resend OTP" : msg)
                }
            }
        }.resume()
    }
    
    func logout() {
        if let url = URL(string: Env.logoutUrl) {
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            URLSession.shared.dataTask(with: request).resume()
        }
        
        currentUser = nil
        workspaces = []
        activeWorkspace = nil
        historyList = []
        liveLogs = []
        totalRequestsCount = 0
        avgLatencyMs = 0
        
        UserDefaults.standard.removeObject(forKey: "mockapi_token")
        UserDefaults.standard.removeObject(forKey: "mockapi_username")
        UserDefaults.standard.removeObject(forKey: "mockapi_email")
        UserDefaults.standard.removeObject(forKey: "mockapi_role")
        UserDefaults.standard.removeObject(forKey: "mockapi_is_guest")
        UserDefaults.standard.removeObject(forKey: "mockapi_is_subscribed")
        
        statusToast = "Signed out"
        HapticFeedback.light()
    }
    
    // MARK: - Real Workspaces Fetching (/api/projects)
    func fetchWorkspaces() {
        guard let url = URL(string: Env.projectsUrl) else { return }
        let request = prepareAuthorizedRequest(url: url)
        
        DispatchQueue.main.async { self.isLoadingWorkspaces = true }
        
        URLSession.shared.dataTask(with: request) { [weak self] data, _, error in
            DispatchQueue.main.async {
                self?.isLoadingWorkspaces = false
                guard let self = self, let data = data else { return }
                if let list = try? JSONDecoder().decode([Workspace].self, from: data) {
                    self.workspaces = list
                    if self.activeWorkspace == nil || !list.contains(where: { $0.id == self.activeWorkspace?.id }) {
                        self.activeWorkspace = list.first
                    }
                } else {
                    self.workspaces = []
                    self.activeWorkspace = nil
                }
            }
        }.resume()
    }
    
    // MARK: - Create Workspace (/api/create-project)
    func createWorkspace(name: String, completion: @escaping (Bool) -> Void) {
        guard !name.trimmingCharacters(in: .whitespaces).isEmpty else { return }
        guard let url = URL(string: Env.createProjectUrl) else { return }
        
        var request = prepareAuthorizedRequest(url: url, method: "POST")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let payload = ["projectname": name]
        request.httpBody = try? JSONSerialization.data(withJSONObject: payload)
        
        URLSession.shared.dataTask(with: request) { [weak self] data, res, error in
            DispatchQueue.main.async {
                if let data = data, let newProj = try? JSONDecoder().decode(Workspace.self, from: data) {
                    self?.workspaces.insert(newProj, at: 0)
                    self?.activeWorkspace = newProj
                    HapticFeedback.success()
                    self?.statusToast = "Created workspace \(newProj.projectname)"
                    completion(true)
                } else {
                    self?.fetchWorkspaces()
                    completion(true)
                }
            }
        }.resume()
    }
    
    // MARK: - Join Workspace (/api/join-project)
    func joinWorkspace(code: String, completion: @escaping (Bool) -> Void) {
        guard let url = URL(string: Env.joinProjectUrl) else { return }
        var request = prepareAuthorizedRequest(url: url, method: "POST")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let payload = ["invitationCode": code]
        request.httpBody = try? JSONSerialization.data(withJSONObject: payload)
        
        URLSession.shared.dataTask(with: request) { [weak self] _, _, _ in
            DispatchQueue.main.async {
                HapticFeedback.success()
                self?.statusToast = "Joined workspace \(code)"
                self?.fetchWorkspaces()
                completion(true)
            }
        }.resume()
    }
    
    // MARK: - Reset Invitation Code (/api/reset-invitation-code)
    func resetInvitationCode(projectId: String) {
        guard let url = URL(string: Env.resetInviteUrl) else { return }
        var req = prepareAuthorizedRequest(url: url, method: "POST")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try? JSONSerialization.data(withJSONObject: ["projectId": projectId])
        
        URLSession.shared.dataTask(with: req) { [weak self] data, _, _ in
            DispatchQueue.main.async {
                HapticFeedback.success()
                self?.statusToast = "Invitation code reset"
                self?.fetchWorkspaces()
            }
        }.resume()
    }
    
    // MARK: - Delete Workspace (/api/deleteproject - HTTP DELETE) with Full Cascade Data Vanishing
    func deleteWorkspace(projectId: String, invitationCode: String? = nil, completion: ((Bool, String?) -> Void)? = nil) {
        // Construct query parameters for maximum proxy compatibility
        var urlString = Env.deleteProjectUrl
        var queryItems: [String] = []
        queryItems.append("projectId=\(projectId)")
        if let code = invitationCode, !code.isEmpty {
            queryItems.append("invitationCode=\(code)")
        }
        if !queryItems.isEmpty {
            urlString += "?\(queryItems.joined(separator: "&"))"
        }
        
        guard let url = URL(string: urlString) else {
            completion?(false, "Invalid delete URL")
            return
        }
        
        // Strict HTTP DELETE method matching backend: app.delete('/api/deleteproject', authenticateToken, delete_project)
        var req = prepareAuthorizedRequest(url: url, method: "DELETE")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        var payload: [String: Any] = ["projectId": projectId]
        if let code = invitationCode, !code.isEmpty {
            payload["invitationCode"] = code
        }
        req.httpBody = try? JSONSerialization.data(withJSONObject: payload)
        
        print("[Delete Project] Sending DELETE to: \(url.absoluteString) with payload: \(payload)")
        
        URLSession.shared.dataTask(with: req) { [weak self] data, response, error in
            DispatchQueue.main.async {
                guard let self = self else { return }
                
                if let error = error {
                    print("[Delete Error]: \(error.localizedDescription)")
                    self.statusToast = "❌ Delete failed: \(error.localizedDescription)"
                    HapticFeedback.error()
                    completion?(false, error.localizedDescription)
                    return
                }
                
                if let http = response as? HTTPURLResponse, http.statusCode >= 400 {
                    var errorMsg = "Delete failed (HTTP \(http.statusCode))"
                    if let data = data, let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                        if let err = json["error"] as? String ?? json["message"] as? String {
                            errorMsg = err
                        }
                    }
                    print("[Delete HTTP Error]: \(errorMsg)")
                    self.statusToast = "❌ \(errorMsg)"
                    HapticFeedback.error()
                    completion?(false, errorMsg)
                    return
                }
                
                // 1. Remove project from local workspace array
                self.workspaces.removeAll { $0.id == projectId }
                
                // 2. Cascade wipe all related data from all other UI screens!
                if self.activeWorkspace?.id == projectId {
                    self.historyList.removeAll()
                    self.liveLogs.removeAll()
                    self.totalRequestsCount = 0
                    self.avgLatencyMs = 0
                    self.activeWorkspace = self.workspaces.first
                }
                
                HapticFeedback.warning()
                self.statusToast = "🗑️ Workspace and all related data deleted"
                completion?(true, nil)
            }
        }.resume()
    }
    
    // MARK: - Real API History Fetching (/api/api-history)
    func fetchHistory(projectId: String) {
        guard let url = URL(string: "\(Env.apiHistoryUrl)?projectId=\(projectId)") else { return }
        let request = prepareAuthorizedRequest(url: url)
        
        DispatchQueue.main.async { self.isLoadingHistory = true }
        
        URLSession.shared.dataTask(with: request) { [weak self] data, _, error in
            DispatchQueue.main.async {
                self?.isLoadingHistory = false
                guard let self = self, let data = data else { return }
                if let list = try? JSONDecoder().decode([ApiHistoryEndpointGroup].self, from: data) {
                    self.historyList = list
                } else {
                    self.historyList = []
                }
            }
        }.resume()
    }
    
    // MARK: - Delete Endpoint Version (/api/versions/delete)
    func deleteVersion(versionId: String, projectId: String) {
        guard let url = URL(string: "\(Env.deleteVersionUrl)/\(versionId)?projectId=\(projectId)") else { return }
        let request = prepareAuthorizedRequest(url: url, method: "DELETE")
        
        URLSession.shared.dataTask(with: request) { [weak self] _, _, _ in
            DispatchQueue.main.async {
                self?.fetchHistory(projectId: projectId)
                self?.statusToast = "Version \(versionId) deleted"
                HapticFeedback.warning()
            }
        }.resume()
    }
    
    // MARK: - Real Save & Deploy Endpoint (/api/update-api)
    func saveEndpoint(
        method: String,
        path: String,
        statusCode: Int,
        latency: Int,
        reqBody: String,
        resBody: String,
        headers: [KeyValuePair],
        queryParams: [KeyValuePair],
        pathParams: [KeyValuePair],
        completion: @escaping (Bool) -> Void
    ) {
        guard let project = activeWorkspace else {
            statusToast = "Please select or create a workspace first"
            completion(false)
            return
        }
        
        isDeploying = true
        guard let url = URL(string: Env.updateApiUrl) else {
            isDeploying = false
            completion(false)
            return
        }
        
        var req = prepareAuthorizedRequest(url: url, method: "POST")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        var customHeadersDict: [String: String] = [:]
        headers.filter { $0.isEnabled && !$0.key.isEmpty }.forEach { customHeadersDict[$0.key] = $0.value }
        
        let payload: [String: Any] = [
            "project_id": project.id,
            "urlpath": path,
            "apihistorydata": [
                "protocol": "https",
                "method": method,
                "statusCode": statusCode,
                "latency": latency,
                "headers": customHeadersDict,
                "requestBody": (try? JSONSerialization.jsonObject(with: Data(reqBody.utf8))) ?? reqBody,
                "responseBody": (try? JSONSerialization.jsonObject(with: Data(resBody.utf8))) ?? resBody
            ]
        ]
        
        req.httpBody = try? JSONSerialization.data(withJSONObject: payload)
        
        URLSession.shared.dataTask(with: req) { [weak self] data, response, error in
            DispatchQueue.main.async {
                self?.isDeploying = false
                if error == nil {
                    HapticFeedback.success()
                    self?.statusToast = "🚀 Endpoint deployed to server!"
                    self?.fetchHistory(projectId: project.id)
                    completion(true)
                } else {
                    HapticFeedback.error()
                    self?.statusToast = "Failed to deploy endpoint"
                    completion(false)
                }
            }
        }.resume()
    }
    
    // MARK: - Real Socket.IO Live Telemetry WebSocket
    func connectWebSocket() {
        let wsHost = Env.socketUrl.replacingOccurrences(of: "https://", with: "wss://").replacingOccurrences(of: "http://", with: "ws://")
        guard let url = URL(string: "\(wsHost)/socket.io/?EIO=4&transport=websocket") else { return }
        
        let session = URLSession(configuration: .default)
        self.socketSession = session
        let task = session.webSocketTask(with: url)
        self.webSocketTask = task
        task.resume()
        
        listenToWebSocket()
        startSocketPing()
    }
    
    func joinSocketProjectRoom(_ projectId: String) {
        guard isSocketLive else { return }
        let joinMsg = "42[\"join_project\",\"\(projectId)\"]"
        webSocketTask?.send(.string(joinMsg)) { _ in }
    }
    
    private func listenToWebSocket() {
        webSocketTask?.receive { [weak self] result in
            switch result {
            case .success(let message):
                switch message {
                case .string(let text): self?.handleSocketMessage(text)
                case .data(let data):
                    if let text = String(data: data, encoding: .utf8) { self?.handleSocketMessage(text) }
                @unknown default: break
                }
                self?.listenToWebSocket()
            case .failure:
                DispatchQueue.main.async { self?.isSocketLive = false }
                DispatchQueue.main.asyncAfter(deadline: .now() + 3.0) { self?.connectWebSocket() }
            }
        }
    }
    
    private func handleSocketMessage(_ text: String) {
        if text == "2" {
            webSocketTask?.send(.string("3")) { _ in }
            return
        }
        if text.starts(with: "0") {
            webSocketTask?.send(.string("40")) { _ in }
            DispatchQueue.main.async {
                self.isSocketLive = true
                if let activeId = self.activeWorkspace?.id {
                    self.joinSocketProjectRoom(activeId)
                }
            }
            return
        }
        
        if text.starts(with: "42") {
            let jsonString = String(text.dropFirst(2))
            guard let data = jsonString.data(using: .utf8),
                  let array = try? JSONSerialization.jsonObject(with: data) as? [Any],
                  let eventName = array.first as? String else { return }
            
            DispatchQueue.main.async {
                if eventName == "initial_logs", array.count > 1 {
                    if let rawLogs = array[1] as? [[String: Any]] {
                        let parsed = rawLogs.compactMap { dict -> TelemetryLogEntry? in
                            guard let jsonData = try? JSONSerialization.data(withJSONObject: dict) else { return nil }
                            return try? JSONDecoder().decode(TelemetryLogEntry.self, from: jsonData)
                        }
                        self.liveLogs = parsed
                        self.totalRequestsCount = parsed.count
                        if !parsed.isEmpty {
                            let totalLat = parsed.reduce(0) { $0 + $1.latencyMs }
                            self.avgLatencyMs = totalLat / parsed.count
                        }
                    }
                } else if eventName == "new_api_log", array.count > 1 {
                    if let rawLog = array[1] as? [String: Any],
                       let jsonData = try? JSONSerialization.data(withJSONObject: rawLog),
                       let log = try? JSONDecoder().decode(TelemetryLogEntry.self, from: jsonData) {
                        self.liveLogs.insert(log, at: 0)
                        self.totalRequestsCount += 1
                        HapticFeedback.light()
                    }
                } else if eventName == "api_history_update" {
                    if let id = self.activeWorkspace?.id {
                        self.fetchHistory(projectId: id)
                    }
                } else if eventName == "project_deleted", array.count > 1 {
                    if let payload = array[1] as? [String: Any],
                       let delId = payload["projectId"] as? String {
                        self.workspaces.removeAll { $0.id == delId }
                        if self.activeWorkspace?.id == delId {
                            self.historyList.removeAll()
                            self.liveLogs.removeAll()
                            self.totalRequestsCount = 0
                            self.avgLatencyMs = 0
                            self.activeWorkspace = self.workspaces.first
                        }
                        self.statusToast = "Project was removed"
                    }
                }
            }
        }
    }
    
    private func startSocketPing() {
        pingTimer?.invalidate()
        pingTimer = Timer.scheduledTimer(withTimeInterval: 25.0, repeats: true) { [weak self] _ in
            self?.webSocketTask?.sendPing { error in
                DispatchQueue.main.async {
                    if error == nil { self?.isSocketLive = true }
                }
            }
        }
    }
}

// MARK: - 🧭 5. Navigation Tab Definitions
enum AppTab: String, CaseIterable {
    case studio = "Studio"
    case workspaces = "Workspaces"
    case history = "History"
    case logs = "Live Logs"
    case dashboard = "Dashboard"
    case settings = "Settings"
    
    var icon: String {
        switch self {
        case .studio: return "bolt.fill"
        case .workspaces: return "shippingbox.fill"
        case .history: return "clock.arrow.circlepath"
        case .logs: return "waveform.path.ecg"
        case .dashboard: return "chart.xyaxis.line"
        case .settings: return "slider.horizontal.3"
        }
    }
}

// MARK: - 📱 6. Main Root View
struct ContentView: View {
    @StateObject private var network = MockAPINetworkManager.shared
    @State private var currentTab: AppTab = .studio
    @State private var showWorkspaceSwitcher = false
    
    var body: some View {
        ZStack(alignment: .bottom) {
            Theme.background.ignoresSafeArea()
            
            VStack(spacing: 0) {
                // Header
                HStack(spacing: 10) {
                    HStack(spacing: 8) {
                        Image(systemName: "bolt.fill")
                            .font(.system(size: 13, weight: .bold))
                            .foregroundColor(.white)
                            .padding(6)
                            .background(Theme.accentGradient)
                            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                            .shadow(color: Theme.accent.opacity(0.4), radius: 6, y: 2)
                        
                        Text("MockAPI")
                            .font(.system(size: 16, weight: .black, design: .rounded))
                            .foregroundColor(.white)
                    }
                    
                    Spacer()
                    
                    // Live Socket Pill
                    HStack(spacing: 5) {
                        Circle()
                            .fill(network.isSocketLive ? Theme.getGreen : Theme.putAmber)
                            .frame(width: 7, height: 7)
                            .shadow(color: network.isSocketLive ? Theme.getGreen : Theme.putAmber, radius: 4)
                        
                        Text(network.isSocketLive ? "WSS LIVE" : "OFFLINE")
                            .font(.system(size: 9, weight: .bold, design: .monospaced))
                            .foregroundColor(network.isSocketLive ? Theme.getGreen : Theme.putAmber)
                    }
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color.white.opacity(0.04))
                    .clipShape(Capsule())
                    .overlay(Capsule().stroke(Theme.border, lineWidth: 1))
                    
                    // Workspace Switcher Pill
                    Button(action: {
                        HapticFeedback.light()
                        showWorkspaceSwitcher = true
                    }) {
                        HStack(spacing: 6) {
                            Image(systemName: "cube.box.fill")
                                .font(.system(size: 10))
                                .foregroundColor(Theme.accent)
                            
                            Text(network.activeWorkspace?.projectname ?? (network.workspaces.isEmpty ? "No Project" : "Select"))
                                .font(.system(size: 11, weight: .bold))
                                .foregroundColor(.white)
                                .lineLimit(1)
                            
                            Image(systemName: "chevron.down")
                                .font(.system(size: 9, weight: .bold))
                                .foregroundColor(Theme.textMuted)
                        }
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(Theme.surfaceElevated)
                        .clipShape(Capsule())
                        .overlay(Capsule().stroke(Theme.borderBright, lineWidth: 1))
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 10)
                .padding(.bottom, 12)
                .background(Theme.surface.opacity(0.95))
                .overlay(Rectangle().frame(height: 1).foregroundColor(Theme.border), alignment: .bottom)
                
                // Screen Tabs
                TabView(selection: $currentTab) {
                    NativeStudioView()
                        .tag(AppTab.studio)
                    
                    NativeWorkspacesView()
                        .tag(AppTab.workspaces)
                    
                    NativeHistoryView()
                        .tag(AppTab.history)
                    
                    NativeLogsView()
                        .tag(AppTab.logs)
                    
                    NativeDashboardAnalyticsView()
                        .tag(AppTab.dashboard)
                    
                    NativeSettingsView()
                        .tag(AppTab.settings)
                }
                .tabViewStyle(.page(indexDisplayMode: .never))
            }
            
            // Floating Pill Tab Bar
            HStack(spacing: 2) {
                ForEach(AppTab.allCases, id: \.self) { tab in
                    Button(action: {
                        HapticFeedback.light()
                        withAnimation(.spring(response: 0.35, dampingFraction: 0.75)) {
                            currentTab = tab
                        }
                    }) {
                        VStack(spacing: 3) {
                            ZStack {
                                if currentTab == tab {
                                    Circle()
                                        .fill(Theme.accent.opacity(0.15))
                                        .frame(width: 28, height: 28)
                                }
                                Image(systemName: tab.icon)
                                    .font(.system(size: 14, weight: .bold))
                                    .foregroundColor(currentTab == tab ? Theme.accent : Theme.textMuted)
                                    .scaleEffect(currentTab == tab ? 1.15 : 1.0)
                            }
                            .frame(height: 22)
                            
                            Text(tab.rawValue)
                                .font(.system(size: 8.5, weight: currentTab == tab ? .bold : .medium))
                                .foregroundColor(currentTab == tab ? .white : Theme.textMuted)
                                .lineLimit(1)
                        }
                        .frame(maxWidth: .infinity)
                    }
                }
            }
            .padding(.horizontal, 8)
            .padding(.top, 8)
            .padding(.bottom, 20)
            .background(
                RoundedRectangle(cornerRadius: 30, style: .continuous)
                    .fill(Theme.surface.opacity(0.96))
                    .overlay(RoundedRectangle(cornerRadius: 30).stroke(Theme.borderBright, lineWidth: 1))
                    .shadow(color: .black.opacity(0.6), radius: 24, y: 12)
            )
            .padding(.horizontal, 10)
            .padding(.bottom, 4)
            
            // Toast Notification
            if let toast = network.statusToast {
                VStack {
                    HStack(spacing: 8) {
                        Image(systemName: "sparkles")
                            .foregroundColor(Theme.accent)
                        Text(toast)
                            .font(.system(size: 12, weight: .bold))
                            .foregroundColor(.white)
                    }
                    .padding(.horizontal, 18)
                    .padding(.vertical, 10)
                    .background(Theme.surfaceHighlight)
                    .clipShape(Capsule())
                    .overlay(Capsule().stroke(Theme.accent.opacity(0.4), lineWidth: 1))
                    .shadow(color: .black.opacity(0.5), radius: 12, y: 6)
                    Spacer()
                }
                .padding(.top, 65)
                .transition(.move(edge: .top).combined(with: .opacity))
                .onAppear {
                    DispatchQueue.main.asyncAfter(deadline: .now() + 2.8) {
                        withAnimation { network.statusToast = nil }
                    }
                }
            }
        }
        .sheet(isPresented: $showWorkspaceSwitcher) {
            WorkspaceSwitcherSheet(isPresented: $showWorkspaceSwitcher)
        }
    }
}

// MARK: - ⚡ 7. Native Studio Screen
struct NativeStudioView: View {
    @StateObject private var network = MockAPINetworkManager.shared
    
    @State private var selectedMethod = "GET"
    @State private var selectedProtocol = "https://"
    @State private var urlPath = "api/v1/resource"
    @State private var statusCode = 200
    @State private var latencyMs = 0
    @State private var selectedSubTab = 0
    
    @State private var responseJson = "{\n  \"status\": \"success\",\n  \"data\": {}\n}"
    @State private var requestJson = "{}"
    
    @State private var headers: [KeyValuePair] = [
        KeyValuePair(key: "Content-Type", value: "application/json", isEnabled: true)
    ]
    @State private var queryParams: [KeyValuePair] = []
    @State private var pathParams: [KeyValuePair] = []
    
    @State private var aiPrompt = ""
    @State private var showHttpTester = false
    @State private var showCodeExport = false
    
    let methods = ["GET", "POST", "PUT", "DEL", "PATCH", "HEAD", "OPT"]
    let subTabs = ["📝 Response", "📥 Request", "🏷️ Params", "⚙️ Config", "✦ AI Studio"]
    let aiPresets = ["E-Commerce Cart", "User Auth & JWT", "Social Feed", "Crypto Wallet", "IoT Sensors", "Delivery Tracking"]
    
    var body: some View {
        ScrollView(showsIndicators: false) {
            VStack(spacing: 12) {
                if network.activeWorkspace == nil {
                    HStack(spacing: 8) {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .foregroundColor(Theme.putAmber)
                        Text("No active workspace. Create or select a project in Workspaces tab.")
                            .font(.system(size: 11, weight: .medium))
                            .foregroundColor(Theme.textSecondary)
                    }
                    .padding(10)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Theme.putAmber.opacity(0.1))
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                }
                
                // URL Builder Hero Card
                VStack(spacing: 10) {
                    HStack(spacing: 4) {
                        ForEach(methods, id: \.self) { method in
                            Button(action: {
                                HapticFeedback.light()
                                withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                                    selectedMethod = method == "DEL" ? "DELETE" : (method == "OPT" ? "OPTIONS" : method)
                                }
                            }) {
                                Text(method)
                                    .font(.system(size: 10, weight: .bold, design: .monospaced))
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 7)
                                    .background((selectedMethod == method || (method == "DEL" && selectedMethod == "DELETE") || (method == "OPT" && selectedMethod == "OPTIONS")) ? methodColor(method) : Color.white.opacity(0.04))
                                    .foregroundColor((selectedMethod == method || (method == "DEL" && selectedMethod == "DELETE") || (method == "OPT" && selectedMethod == "OPTIONS")) ? .white : Theme.textMuted)
                                    .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                            }
                        }
                    }
                    
                    HStack(spacing: 8) {
                        Menu {
                            Button("https://") { selectedProtocol = "https://" }
                            Button("http://") { selectedProtocol = "http://" }
                        } label: {
                            HStack(spacing: 3) {
                                Text(selectedProtocol)
                                    .font(.system(size: 11, weight: .bold, design: .monospaced))
                                    .foregroundColor(Theme.accent)
                                Image(systemName: "chevron.down")
                                    .font(.system(size: 8, weight: .bold))
                                    .foregroundColor(Theme.textMuted)
                            }
                            .padding(.horizontal, 8)
                            .padding(.vertical, 5)
                            .background(Color.white.opacity(0.05))
                            .clipShape(RoundedRectangle(cornerRadius: 6))
                        }
                        
                        Text("/")
                            .font(.system(size: 13, weight: .bold, design: .monospaced))
                            .foregroundColor(Theme.textMuted)
                        
                        TextField("path/to/resource", text: $urlPath)
                            .font(.system(size: 13, design: .monospaced))
                            .foregroundColor(.white)
                            .autocapitalization(.none)
                            .disableAutocorrection(true)
                            .onChange(of: urlPath) { newPath in
                                extractPathParams(from: newPath)
                            }
                        
                        Button(action: {
                            HapticFeedback.success()
                            let full = "\(Env.mockApiBaseUrl)/\(urlPath)"
                            UIPasteboard.general.string = full
                            network.statusToast = "📋 Copied endpoint URL"
                        }) {
                            Image(systemName: "doc.on.doc")
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundColor(Theme.textSecondary)
                                .padding(7)
                                .background(Color.white.opacity(0.06))
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                        }
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 7)
                    .background(Color.black.opacity(0.4))
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.border, lineWidth: 1))
                }
                .padding(12)
                .background(Theme.surface)
                .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 18).stroke(Theme.border, lineWidth: 1))
                
                // Studio Action Buttons
                HStack(spacing: 8) {
                    Button(action: {
                        HapticFeedback.medium()
                        showHttpTester = true
                    }) {
                        HStack(spacing: 6) {
                            Image(systemName: "play.circle.fill")
                                .foregroundColor(Theme.getGreen)
                            Text("Test API Runner")
                                .font(.system(size: 12, weight: .bold))
                                .foregroundColor(.white)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 9)
                        .background(Theme.surfaceElevated)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.border, lineWidth: 1))
                    }
                    
                    Button(action: {
                        HapticFeedback.medium()
                        showCodeExport = true
                    }) {
                        HStack(spacing: 6) {
                            Image(systemName: "curlybraces.square.fill")
                                .foregroundColor(Theme.accent)
                            Text("Code Export")
                                .font(.system(size: 12, weight: .bold))
                                .foregroundColor(.white)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 9)
                        .background(Theme.surfaceElevated)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.border, lineWidth: 1))
                    }
                }
                
                // Sub-Tab Selector
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        ForEach(0..<subTabs.count, id: \.self) { index in
                            Button(action: {
                                HapticFeedback.light()
                                withAnimation(.spring(response: 0.35, dampingFraction: 0.75)) {
                                    selectedSubTab = index
                                }
                            }) {
                                Text(subTabs[index])
                                    .font(.system(size: 11, weight: .bold))
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 7)
                                    .background(selectedSubTab == index ? Theme.accent : Color.white.opacity(0.04))
                                    .foregroundColor(selectedSubTab == index ? .white : Theme.textSecondary)
                                    .clipShape(Capsule())
                                    .overlay(
                                        Capsule().stroke(selectedSubTab == index ? Color.white.opacity(0.2) : Theme.border, lineWidth: 1)
                                    )
                            }
                        }
                    }
                }
                
                // Sub-Tab Panels
                if selectedSubTab == 0 {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text("RESPONSE BLUEPRINT (JSON)")
                                .font(.system(size: 10, weight: .bold, design: .monospaced))
                                .foregroundColor(Theme.textMuted)
                            Spacer()
                            Button("✨ Format") {
                                HapticFeedback.light()
                                responseJson = formatJson(responseJson)
                            }
                            .font(.system(size: 10, weight: .bold))
                            .foregroundColor(Theme.accent)
                        }
                        
                        TextEditor(text: $responseJson)
                            .font(.system(size: 12, design: .monospaced))
                            .foregroundColor(Theme.getGreen)
                            .frame(height: 220)
                            .padding(8)
                            .background(Color.black.opacity(0.45))
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.border, lineWidth: 1))
                    }
                    .padding(12)
                    .background(Theme.surface)
                    .clipShape(RoundedRectangle(cornerRadius: 18))
                    .overlay(RoundedRectangle(cornerRadius: 18).stroke(Theme.border, lineWidth: 1))
                    
                } else if selectedSubTab == 1 {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text("REQUEST PAYLOAD (JSON)")
                                .font(.system(size: 10, weight: .bold, design: .monospaced))
                                .foregroundColor(Theme.textMuted)
                            Spacer()
                            Button("✨ Format") {
                                HapticFeedback.light()
                                requestJson = formatJson(requestJson)
                            }
                            .font(.system(size: 10, weight: .bold))
                            .foregroundColor(Theme.accent)
                        }
                        
                        TextEditor(text: $requestJson)
                            .font(.system(size: 12, design: .monospaced))
                            .foregroundColor(Theme.postBlue)
                            .frame(height: 180)
                            .padding(8)
                            .background(Color.black.opacity(0.45))
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.border, lineWidth: 1))
                    }
                    .padding(12)
                    .background(Theme.surface)
                    .clipShape(RoundedRectangle(cornerRadius: 18))
                    .overlay(RoundedRectangle(cornerRadius: 18).stroke(Theme.border, lineWidth: 1))
                    
                } else if selectedSubTab == 2 {
                    VStack(alignment: .leading, spacing: 14) {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("PATH PARAMETERS")
                                .font(.system(size: 10, weight: .bold, design: .monospaced))
                                .foregroundColor(Theme.textMuted)
                            
                            if pathParams.isEmpty {
                                Text("No :pathVariables found in URL (e.g. /users/:id)")
                                    .font(.system(size: 11))
                                    .foregroundColor(Theme.textMuted)
                                    .padding(.vertical, 4)
                            } else {
                                ForEach($pathParams) { $param in
                                    HStack {
                                        Text(":\(param.key)")
                                            .font(.system(size: 12, weight: .bold, design: .monospaced))
                                            .foregroundColor(Theme.accent)
                                            .frame(width: 80, alignment: .leading)
                                        
                                        TextField("value", text: $param.value)
                                            .font(.system(size: 12, design: .monospaced))
                                            .padding(6)
                                            .background(Color.black.opacity(0.3))
                                            .clipShape(RoundedRectangle(cornerRadius: 6))
                                    }
                                }
                            }
                        }
                        
                        Divider().background(Theme.border)
                        
                        VStack(alignment: .leading, spacing: 6) {
                            HStack {
                                Text("QUERY PARAMETERS (?key=value)")
                                    .font(.system(size: 10, weight: .bold, design: .monospaced))
                                    .foregroundColor(Theme.textMuted)
                                Spacer()
                                Button("＋ Add") {
                                    HapticFeedback.light()
                                    queryParams.append(KeyValuePair(key: "key", value: "value", isEnabled: true))
                                }
                                .font(.system(size: 10, weight: .bold))
                                .foregroundColor(Theme.accent)
                            }
                            
                            ForEach($queryParams) { $q in
                                HStack {
                                    Toggle("", isOn: $q.isEnabled).labelsHidden().scaleEffect(0.7)
                                    TextField("key", text: $q.key)
                                        .font(.system(size: 12, design: .monospaced))
                                        .padding(6)
                                        .background(Color.black.opacity(0.3))
                                        .clipShape(RoundedRectangle(cornerRadius: 6))
                                    Text("=")
                                        .foregroundColor(Theme.textMuted)
                                    TextField("value", text: $q.value)
                                        .font(.system(size: 12, design: .monospaced))
                                        .padding(6)
                                        .background(Color.black.opacity(0.3))
                                        .clipShape(RoundedRectangle(cornerRadius: 6))
                                }
                            }
                        }
                    }
                    .padding(14)
                    .background(Theme.surface)
                    .clipShape(RoundedRectangle(cornerRadius: 18))
                    .overlay(RoundedRectangle(cornerRadius: 18).stroke(Theme.border, lineWidth: 1))
                    
                } else if selectedSubTab == 3 {
                    VStack(alignment: .leading, spacing: 14) {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("MOCK HTTP STATUS CODE")
                                .font(.system(size: 10, weight: .bold, design: .monospaced))
                                .foregroundColor(Theme.textMuted)
                            
                            HStack(spacing: 6) {
                                ForEach([200, 201, 204, 400, 401, 404, 500], id: \.self) { code in
                                    Button(action: {
                                        HapticFeedback.light()
                                        statusCode = code
                                    }) {
                                        Text("\(code)")
                                            .font(.system(size: 11, weight: .bold, design: .monospaced))
                                            .frame(maxWidth: .infinity)
                                            .padding(.vertical, 6)
                                            .background(statusCode == code ? statusCodeColor(code) : Color.white.opacity(0.04))
                                            .foregroundColor(statusCode == code ? .white : Theme.textSecondary)
                                            .clipShape(RoundedRectangle(cornerRadius: 8))
                                    }
                                }
                            }
                        }
                        
                        Divider().background(Theme.border)
                        
                        VStack(alignment: .leading, spacing: 6) {
                            HStack {
                                Text("ARTIFICIAL LATENCY DELAY")
                                    .font(.system(size: 10, weight: .bold, design: .monospaced))
                                    .foregroundColor(Theme.textMuted)
                                Spacer()
                                Text("\(latencyMs) ms")
                                    .font(.system(size: 11, weight: .bold, design: .monospaced))
                                    .foregroundColor(Theme.accent)
                            }
                            
                            Slider(value: Binding(
                                get: { Double(latencyMs) },
                                set: { latencyMs = Int($0) }
                            ), in: 0...2000, step: 50)
                            .accentColor(Theme.accent)
                        }
                        
                        Divider().background(Theme.border)
                        
                        VStack(alignment: .leading, spacing: 6) {
                            HStack {
                                Text("CUSTOM RESPONSE HEADERS")
                                    .font(.system(size: 10, weight: .bold, design: .monospaced))
                                    .foregroundColor(Theme.textMuted)
                                Spacer()
                                Button("＋ Add Header") {
                                    HapticFeedback.light()
                                    headers.append(KeyValuePair(key: "X-Header", value: "value", isEnabled: true))
                                }
                                .font(.system(size: 10, weight: .bold))
                                .foregroundColor(Theme.accent)
                            }
                            
                            ForEach($headers) { $h in
                                HStack {
                                    TextField("Header", text: $h.key)
                                        .font(.system(size: 11, design: .monospaced))
                                        .padding(6)
                                        .background(Color.black.opacity(0.3))
                                        .clipShape(RoundedRectangle(cornerRadius: 6))
                                    Text(":")
                                        .foregroundColor(Theme.textMuted)
                                    TextField("Value", text: $h.value)
                                        .font(.system(size: 11, design: .monospaced))
                                        .padding(6)
                                        .background(Color.black.opacity(0.3))
                                        .clipShape(RoundedRectangle(cornerRadius: 6))
                                }
                            }
                        }
                    }
                    .padding(14)
                    .background(Theme.surface)
                    .clipShape(RoundedRectangle(cornerRadius: 18))
                    .overlay(RoundedRectangle(cornerRadius: 18).stroke(Theme.border, lineWidth: 1))
                    
                } else if selectedSubTab == 4 {
                    VStack(alignment: .leading, spacing: 12) {
                        HStack {
                            Image(systemName: "sparkles")
                                .foregroundColor(Theme.accent)
                            Text("AI ENDPOINT GENERATOR (\(Env.askAiUrl))")
                                .font(.system(size: 10, weight: .black, design: .monospaced))
                                .foregroundColor(Theme.accent)
                                .lineLimit(1)
                        }
                        
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 6) {
                                ForEach(aiPresets, id: \.self) { preset in
                                    Button(action: {
                                        HapticFeedback.light()
                                        aiPrompt = "Create mock API for \(preset)"
                                    }) {
                                        Text(preset)
                                            .font(.system(size: 10, weight: .semibold))
                                            .padding(.horizontal, 10)
                                            .padding(.vertical, 5)
                                            .background(Color.white.opacity(0.05))
                                            .foregroundColor(.white)
                                            .clipShape(Capsule())
                                    }
                                }
                            }
                        }
                        
                        TextField("Describe requirements...", text: $aiPrompt)
                            .font(.system(size: 12))
                            .padding(10)
                            .background(Color.black.opacity(0.35))
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                        
                        Button(action: {
                            HapticFeedback.medium()
                            generateAISchema()
                        }) {
                            HStack {
                                Image(systemName: "sparkles")
                                Text("Generate Schema with AI ✦")
                                    .font(.system(size: 12, weight: .bold))
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 10)
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
                
                // Bottom Deploy Button
                Button(action: {
                    HapticFeedback.heavy()
                    network.saveEndpoint(
                        method: selectedMethod,
                        path: urlPath,
                        statusCode: statusCode,
                        latency: latencyMs,
                        reqBody: requestJson,
                        resBody: responseJson,
                        headers: headers,
                        queryParams: queryParams,
                        pathParams: pathParams
                    ) { _ in }
                }) {
                    HStack(spacing: 8) {
                        if network.isDeploying {
                            ProgressView().progressViewStyle(CircularProgressViewStyle(tint: .white))
                        } else {
                            Image(systemName: "arrow.up.circle.fill")
                                .font(.system(size: 16, weight: .bold))
                            Text("Deploy Endpoint 🚀")
                                .font(.system(size: 14, weight: .black))
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 13)
                    .background(Theme.accentGradient)
                    .foregroundColor(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    .shadow(color: Theme.accent.opacity(0.4), radius: 12, y: 6)
                }
                .padding(.top, 4)
            }
            .padding(.horizontal, 14)
            .padding(.top, 10)
            .padding(.bottom, 120)
        }
        .sheet(isPresented: $showHttpTester) {
            HttpTesterSheet(method: selectedMethod, path: urlPath, mockResponse: responseJson, statusCode: statusCode, isPresented: $showHttpTester)
        }
        .sheet(isPresented: $showCodeExport) {
            CodeExportSheet(method: selectedMethod, path: urlPath, headers: headers, reqBody: requestJson, isPresented: $showCodeExport)
        }
    }
    
    private func methodColor(_ method: String) -> Color {
        switch method {
        case "GET": return Theme.getGreen
        case "POST": return Theme.postBlue
        case "PUT": return Theme.putAmber
        case "DEL", "DELETE": return Theme.deleteRed
        case "PATCH": return Theme.patchPurple
        default: return Theme.headGray
        }
    }
    
    private func statusCodeColor(_ code: Int) -> Color {
        switch code {
        case 200..<300: return Theme.getGreen
        case 300..<400: return Theme.putAmber
        case 400..<500: return Theme.putAmber
        default: return Theme.deleteRed
        }
    }
    
    private func formatJson(_ raw: String) -> String {
        guard let data = raw.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data),
              let pretty = try? JSONSerialization.data(withJSONObject: json, options: .prettyPrinted),
              let formatted = String(data: pretty, encoding: .utf8) else {
            return raw
        }
        return formatted
    }
    
    private func extractPathParams(from path: String) {
        let segments = path.split(separator: "/")
        var found: [KeyValuePair] = []
        for seg in segments {
            if seg.starts(with: ":") {
                let key = String(seg.dropFirst())
                found.append(KeyValuePair(key: key, value: "", isEnabled: true))
            }
        }
        pathParams = found
    }
    
    private func generateAISchema() {
        guard let url = URL(string: Env.askAiUrl) else { return }
        var req = network.prepareAuthorizedRequest(url: url, method: "POST")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try? JSONSerialization.data(withJSONObject: ["prompt": aiPrompt])
        
        URLSession.shared.dataTask(with: req) { data, _, _ in
            DispatchQueue.main.async {
                if let data = data,
                   let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                   let res = json["response"] as? String {
                    self.responseJson = res
                    self.network.statusToast = "✨ AI Blueprint Generated!"
                } else {
                    self.network.statusToast = "✨ Blueprint Ready"
                }
            }
        }.resume()
    }
}

// MARK: - 📦 8. Native Workspaces Screen
struct NativeWorkspacesView: View {
    @StateObject private var network = MockAPINetworkManager.shared
    @State private var showCreateModal = false
    @State private var showJoinModal = false
    @State private var newProjectName = ""
    @State private var joinInviteCode = ""
    @State private var projectToDelete: Workspace?
    @State private var showDeleteConfirmation = false
    
    var body: some View {
        ScrollView(showsIndicators: false) {
            VStack(spacing: 12) {
                // Top Action Row
                HStack(spacing: 8) {
                    Button(action: {
                        HapticFeedback.light()
                        showCreateModal = true
                    }) {
                        HStack {
                            Image(systemName: "plus.circle.fill")
                                .foregroundColor(Theme.accent)
                            Text("New Workspace")
                                .font(.system(size: 12, weight: .bold))
                                .foregroundColor(.white)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                        .background(Theme.surfaceElevated)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.border, lineWidth: 1))
                    }
                    
                    Button(action: {
                        HapticFeedback.light()
                        showJoinModal = true
                    }) {
                        HStack {
                            Image(systemName: "person.badge.plus")
                                .foregroundColor(Theme.getGreen)
                            Text("Join with Code")
                                .font(.system(size: 12, weight: .bold))
                                .foregroundColor(.white)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                        .background(Theme.surfaceElevated)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.border, lineWidth: 1))
                    }
                }
                
                // Loading or Empty State
                if network.isLoadingWorkspaces {
                    VStack(spacing: 10) {
                        ProgressView().progressViewStyle(CircularProgressViewStyle(tint: Theme.accent))
                        Text("Loading workspaces from server...")
                            .font(.system(size: 11))
                            .foregroundColor(Theme.textMuted)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(30)
                } else if network.workspaces.isEmpty {
                    VStack(spacing: 8) {
                        Image(systemName: "cube.box")
                            .font(.system(size: 36))
                            .foregroundColor(Theme.textMuted)
                        Text("No Workspaces Found on Server")
                            .font(.system(size: 13, weight: .bold))
                            .foregroundColor(.white)
                        Text("Create your first workspace or join with a 6-digit invitation code to start mocking APIs.")
                            .font(.system(size: 11))
                            .foregroundColor(Theme.textMuted)
                            .multilineTextAlignment(.center)
                        
                        Button("Refresh from Server") {
                            network.fetchWorkspaces()
                        }
                        .font(.system(size: 11, weight: .bold))
                        .foregroundColor(Theme.accent)
                        .padding(.top, 4)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(30)
                    .background(Theme.surface)
                    .clipShape(RoundedRectangle(cornerRadius: 16))
                } else {
                    ForEach(network.workspaces) { project in
                        let isSelected = network.activeWorkspace?.id == project.id
                        
                        VStack(alignment: .leading, spacing: 10) {
                            HStack {
                                VStack(alignment: .leading, spacing: 3) {
                                    HStack(spacing: 6) {
                                        Text(project.projectname)
                                            .font(.system(size: 15, weight: .bold))
                                            .foregroundColor(.white)
                                        
                                        if isSelected {
                                            Text("ACTIVE")
                                                .font(.system(size: 9, weight: .black))
                                                .padding(.horizontal, 6)
                                                .padding(.vertical, 2)
                                                .background(Theme.accent)
                                                .foregroundColor(.white)
                                                .clipShape(Capsule())
                                        }
                                    }
                                    
                                    if let code = project.invitationCode {
                                        HStack(spacing: 4) {
                                            Text("Invite Code:")
                                                .font(.system(size: 11))
                                                .foregroundColor(Theme.textMuted)
                                            Text(code)
                                                .font(.system(size: 11, weight: .bold, design: .monospaced))
                                                .foregroundColor(Theme.accent)
                                        }
                                    }
                                }
                                
                                Spacer()
                                
                                Button(action: {
                                    HapticFeedback.light()
                                    network.activeWorkspace = project
                                    network.statusToast = "Switched to \(project.projectname)"
                                }) {
                                    Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                                        .font(.system(size: 20))
                                        .foregroundColor(isSelected ? Theme.getGreen : Theme.textMuted)
                                }
                            }
                            
                            Divider().background(Theme.border)
                            
                            HStack {
                                HStack(spacing: 4) {
                                    Image(systemName: "person.2.fill")
                                        .font(.system(size: 10))
                                        .foregroundColor(Theme.textMuted)
                                    Text("\(project.members?.count ?? 1) members")
                                        .font(.system(size: 11))
                                        .foregroundColor(Theme.textMuted)
                                }
                                
                                Spacer()
                                
                                if let code = project.invitationCode {
                                    Button(action: {
                                        HapticFeedback.success()
                                        UIPasteboard.general.string = code
                                        network.statusToast = "📋 Copied code: \(code)"
                                    }) {
                                        HStack(spacing: 4) {
                                            Image(systemName: "doc.on.doc")
                                                .font(.system(size: 10))
                                            Text("Copy")
                                                .font(.system(size: 11, weight: .semibold))
                                        }
                                        .foregroundColor(Theme.textSecondary)
                                        .padding(.horizontal, 8)
                                        .padding(.vertical, 4)
                                        .background(Color.white.opacity(0.05))
                                        .clipShape(Capsule())
                                    }
                                    
                                    Button(action: {
                                        network.resetInvitationCode(projectId: project.id)
                                    }) {
                                        Image(systemName: "arrow.triangle.2.circlepath")
                                            .font(.system(size: 11))
                                            .foregroundColor(Theme.putAmber)
                                            .padding(6)
                                            .background(Theme.putAmber.opacity(0.1))
                                            .clipShape(Circle())
                                    }
                                }
                                
                                // Delete Project Button with Confirmation
                                Button(action: {
                                    HapticFeedback.warning()
                                    projectToDelete = project
                                    showDeleteConfirmation = true
                                }) {
                                    HStack(spacing: 4) {
                                        Image(systemName: "trash.fill")
                                            .font(.system(size: 11))
                                        Text("Delete")
                                            .font(.system(size: 11, weight: .bold))
                                    }
                                    .foregroundColor(Theme.deleteRed)
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 4)
                                    .background(Theme.deleteRed.opacity(0.12))
                                    .clipShape(Capsule())
                                }
                            }
                        }
                        .padding(14)
                        .background(Theme.surface)
                        .clipShape(RoundedRectangle(cornerRadius: 16))
                        .overlay(
                            RoundedRectangle(cornerRadius: 16)
                                .stroke(isSelected ? Theme.accent : Theme.border, lineWidth: isSelected ? 1.5 : 1)
                        )
                    }
                }
            }
            .padding(.horizontal, 14)
            .padding(.top, 10)
            .padding(.bottom, 120)
        }
        .confirmationDialog(
            "Delete Workspace?",
            isPresented: $showDeleteConfirmation,
            titleVisibility: .visible,
            presenting: projectToDelete
        ) { target in
            Button("Delete '\(target.projectname)' & Purge All Data", role: .destructive) {
                network.deleteWorkspace(projectId: target.id, invitationCode: target.invitationCode)
            }
            Button("Cancel", role: .cancel) {}
        } message: { target in
            Text("This will permanently delete '\(target.projectname)' from the server. All endpoints, history snapshots, and telemetry logs will immediately vanish from your app.")
        }
        .sheet(isPresented: $showCreateModal) {
            VStack(spacing: 16) {
                Text("Create New Workspace")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundColor(.white)
                
                TextField("Workspace Name (e.g. Auth Service)", text: $newProjectName)
                    .font(.system(size: 13))
                    .padding(12)
                    .background(Theme.surfaceHighlight)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                
                Button(action: {
                    network.createWorkspace(name: newProjectName) { _ in
                        showCreateModal = false
                        newProjectName = ""
                    }
                }) {
                    Text("Create Workspace 🚀")
                        .font(.system(size: 13, weight: .bold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .background(Theme.accentGradient)
                        .foregroundColor(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                }
            }
            .padding(24)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Theme.background.ignoresSafeArea())
        }
        .sheet(isPresented: $showJoinModal) {
            VStack(spacing: 16) {
                Text("Join Team Workspace")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundColor(.white)
                
                TextField("6-Digit Invitation Code (e.g. EC-8921)", text: $joinInviteCode)
                    .font(.system(size: 14, weight: .bold, design: .monospaced))
                    .padding(12)
                    .background(Theme.surfaceHighlight)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                
                Button(action: {
                    network.joinWorkspace(code: joinInviteCode) { _ in
                        showJoinModal = false
                        joinInviteCode = ""
                    }
                }) {
                    Text("Join Project ⎋")
                        .font(.system(size: 13, weight: .bold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .background(Theme.getGreen)
                        .foregroundColor(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                }
            }
            .padding(24)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Theme.background.ignoresSafeArea())
        }
    }
}

// MARK: - 📜 9. Native History & Rollback Screen
struct NativeHistoryView: View {
    @StateObject private var network = MockAPINetworkManager.shared
    
    var body: some View {
        ScrollView(showsIndicators: false) {
            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    Text("API VERSIONS & ROLLBACK")
                        .font(.system(size: 11, weight: .bold, design: .monospaced))
                        .foregroundColor(Theme.textMuted)
                    Spacer()
                    if network.isLoadingHistory {
                        ProgressView().scaleEffect(0.7)
                    } else {
                        Text("\(network.historyList.count) endpoints")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundColor(Theme.accent)
                    }
                }
                
                if network.isLoadingHistory {
                    VStack(spacing: 10) {
                        ProgressView().progressViewStyle(CircularProgressViewStyle(tint: Theme.accent))
                        Text("Loading history from server...")
                            .font(.system(size: 11))
                            .foregroundColor(Theme.textMuted)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(30)
                } else if network.historyList.isEmpty {
                    VStack(spacing: 8) {
                        Image(systemName: "clock.arrow.circlepath")
                            .font(.system(size: 36))
                            .foregroundColor(Theme.textMuted)
                        Text("No Endpoint History Recorded on Server")
                            .font(.system(size: 13, weight: .bold))
                            .foregroundColor(.white)
                        Text("Deploy an endpoint from the Studio tab to create your first server version snapshot.")
                            .font(.system(size: 11))
                            .foregroundColor(Theme.textMuted)
                            .multilineTextAlignment(.center)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(30)
                    .background(Theme.surface)
                    .clipShape(RoundedRectangle(cornerRadius: 16))
                } else {
                    ForEach(network.historyList) { group in
                        VStack(alignment: .leading, spacing: 8) {
                            HStack {
                                Text("/\(group.baseUrlPath)")
                                    .font(.system(size: 13, weight: .bold, design: .monospaced))
                                    .foregroundColor(.white)
                                Spacer()
                                Text("\(group.versions?.count ?? 0) versions")
                                    .font(.system(size: 10, weight: .bold))
                                    .foregroundColor(Theme.textMuted)
                            }
                            
                            if let versions = group.versions {
                                ForEach(versions) { ver in
                                    HStack(spacing: 6) {
                                        Text(ver.version)
                                            .font(.system(size: 11, weight: .black, design: .monospaced))
                                            .padding(.horizontal, 6)
                                            .padding(.vertical, 2)
                                            .background(Theme.accent.opacity(0.2))
                                            .foregroundColor(Theme.accent)
                                            .clipShape(RoundedRectangle(cornerRadius: 4))
                                        
                                        Text(ver.method ?? "GET")
                                            .font(.system(size: 10, weight: .bold, design: .monospaced))
                                            .foregroundColor(Theme.getGreen)
                                        
                                        Spacer()
                                        
                                        Button("Rollback ⚡") {
                                            HapticFeedback.success()
                                            network.statusToast = "⚡ Rolled back to \(ver.version)"
                                        }
                                        .font(.system(size: 10, weight: .bold))
                                        .foregroundColor(Theme.accent)
                                        .padding(.horizontal, 8)
                                        .padding(.vertical, 4)
                                        .background(Theme.surfaceHighlight)
                                        .clipShape(Capsule())
                                        
                                        Button(action: {
                                            if let pId = network.activeWorkspace?.id {
                                                network.deleteVersion(versionId: ver.version, projectId: pId)
                                            }
                                        }) {
                                            Image(systemName: "trash")
                                                .font(.system(size: 10))
                                                .foregroundColor(Theme.deleteRed.opacity(0.8))
                                                .padding(6)
                                                .background(Theme.deleteRed.opacity(0.1))
                                                .clipShape(Circle())
                                        }
                                    }
                                    .padding(8)
                                    .background(Color.black.opacity(0.25))
                                    .clipShape(RoundedRectangle(cornerRadius: 8))
                                }
                            }
                        }
                        .padding(12)
                        .background(Theme.surface)
                        .clipShape(RoundedRectangle(cornerRadius: 16))
                        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1))
                    }
                }
            }
            .padding(.horizontal, 14)
            .padding(.top, 10)
            .padding(.bottom, 120)
        }
    }
}

// MARK: - 📡 10. Native Live Logs Screen
struct NativeLogsView: View {
    @StateObject private var network = MockAPINetworkManager.shared
    @State private var filterMethod = "ALL"
    @State private var selectedLog: TelemetryLogEntry?
    
    let filterOptions = ["ALL", "2xx", "4xx", "5xx"]
    
    var filteredLogs: [TelemetryLogEntry] {
        if filterMethod == "ALL" { return network.liveLogs }
        if filterMethod == "2xx" { return network.liveLogs.filter { $0.statusCode >= 200 && $0.statusCode < 300 } }
        if filterMethod == "4xx" { return network.liveLogs.filter { $0.statusCode >= 400 && $0.statusCode < 500 } }
        return network.liveLogs.filter { $0.statusCode >= 500 }
    }
    
    var body: some View {
        VStack(spacing: 10) {
            // KPI Stats Bar
            HStack(spacing: 8) {
                KPIStatCard(title: "TOTAL CALLS", value: "\(network.totalRequestsCount)", color: Theme.accent)
                KPIStatCard(title: "AVG LATENCY", value: network.avgLatencyMs > 0 ? "\(network.avgLatencyMs)ms" : "—", color: Theme.getGreen)
                KPIStatCard(title: "SUCCESS", value: network.totalRequestsCount > 0 ? "100%" : "—", color: Theme.getGreen)
                KPIStatCard(title: "STATUS", value: network.isSocketLive ? "LIVE" : "OFF", color: network.isSocketLive ? Theme.getGreen : Theme.deleteRed)
            }
            .padding(.horizontal, 14)
            .padding(.top, 10)
            
            // Filter Pills
            HStack(spacing: 6) {
                ForEach(filterOptions, id: \.self) { opt in
                    Button(action: {
                        HapticFeedback.light()
                        filterMethod = opt
                    }) {
                        Text(opt)
                            .font(.system(size: 10, weight: .bold))
                            .padding(.horizontal, 12)
                            .padding(.vertical, 5)
                            .background(filterMethod == opt ? Theme.accent : Theme.surfaceHighlight)
                            .foregroundColor(filterMethod == opt ? .white : Theme.textSecondary)
                            .clipShape(Capsule())
                    }
                }
                Spacer()
                Button("Clear") {
                    HapticFeedback.light()
                    network.liveLogs.removeAll()
                }
                .font(.system(size: 10, weight: .bold))
                .foregroundColor(Theme.textMuted)
            }
            .padding(.horizontal, 14)
            
            // Real Socket Stream or Real Empty State
            if network.liveLogs.isEmpty {
                VStack(spacing: 8) {
                    Image(systemName: "waveform.path.ecg")
                        .font(.system(size: 36))
                        .foregroundColor(Theme.textMuted)
                    Text(network.isSocketLive ? "Connected to Socket.IO. Waiting for traffic..." : "Connecting to Socket.IO...")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundColor(.white)
                    Text("Execute requests from the Studio tab or send HTTP calls to your endpoint to view real-time telemetry streaming.")
                        .font(.system(size: 11))
                        .foregroundColor(Theme.textMuted)
                        .multilineTextAlignment(.center)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .padding(30)
            } else {
                ScrollView(showsIndicators: false) {
                    LazyVStack(spacing: 8) {
                        ForEach(filteredLogs) { log in
                            Button(action: {
                                HapticFeedback.light()
                                selectedLog = log
                            }) {
                                HStack(spacing: 8) {
                                    Text(log.method)
                                        .font(.system(size: 10, weight: .bold, design: .monospaced))
                                        .padding(.horizontal, 6)
                                        .padding(.vertical, 3)
                                        .background(logMethodColor(log.method).opacity(0.15))
                                        .foregroundColor(logMethodColor(log.method))
                                        .clipShape(RoundedRectangle(cornerRadius: 6))
                                    
                                    Text(log.path)
                                        .font(.system(size: 12, weight: .medium, design: .monospaced))
                                        .foregroundColor(.white)
                                        .lineLimit(1)
                                    
                                    Spacer()
                                    
                                    Text("\(log.statusCode)")
                                        .font(.system(size: 10, weight: .bold, design: .monospaced))
                                        .foregroundColor(logStatusColor(log.statusCode))
                                    
                                    Text("\(log.latencyMs)ms")
                                        .font(.system(size: 10, design: .monospaced))
                                        .foregroundColor(Theme.textMuted)
                                }
                                .padding(10)
                                .background(Theme.surface)
                                .clipShape(RoundedRectangle(cornerRadius: 12))
                                .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.border, lineWidth: 1))
                            }
                        }
                    }
                    .padding(.horizontal, 14)
                    .padding(.bottom, 120)
                }
            }
        }
        .sheet(item: $selectedLog) { log in
            LogDetailSheet(log: log)
        }
    }
    
    private func logMethodColor(_ m: String) -> Color {
        switch m {
        case "GET": return Theme.getGreen
        case "POST": return Theme.postBlue
        case "PUT": return Theme.putAmber
        case "DELETE": return Theme.deleteRed
        default: return Theme.patchPurple
        }
    }
    
    private func logStatusColor(_ s: Int) -> Color {
        switch s {
        case 200..<300: return Theme.getGreen
        case 400..<500: return Theme.putAmber
        default: return Theme.deleteRed
        }
    }
}

// MARK: - 📊 11. Native Analytics & Dashboard View
struct NativeDashboardAnalyticsView: View {
    @StateObject private var network = MockAPINetworkManager.shared
    @State private var timeRange = "24h"
    @State private var showLatencyTestSheet = false
    
    let timeRanges = ["1h", "6h", "24h", "7d"]
    
    var body: some View {
        ScrollView(showsIndicators: false) {
            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    Text("API ANALYTICS")
                        .font(.system(size: 11, weight: .bold, design: .monospaced))
                        .foregroundColor(Theme.textMuted)
                    Spacer()
                    HStack(spacing: 4) {
                        ForEach(timeRanges, id: \.self) { range in
                            Button(action: {
                                HapticFeedback.light()
                                timeRange = range
                            }) {
                                Text(range)
                                    .font(.system(size: 10, weight: .bold))
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 4)
                                    .background(timeRange == range ? Theme.accent : Theme.surfaceHighlight)
                                    .foregroundColor(timeRange == range ? .white : Theme.textMuted)
                                    .clipShape(Capsule())
                            }
                        }
                    }
                }
                
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("NETWORK RTT BENCHMARK")
                                .font(.system(size: 10, weight: .bold, design: .monospaced))
                                .foregroundColor(Theme.textMuted)
                            Text(network.avgLatencyMs > 0 ? "\(network.avgLatencyMs) ms" : "Run Test")
                                .font(.system(size: 20, weight: .black, design: .monospaced))
                                .foregroundColor(Theme.getGreen)
                        }
                        Spacer()
                        Button(action: {
                            HapticFeedback.medium()
                            showLatencyTestSheet = true
                        }) {
                            HStack(spacing: 4) {
                                Image(systemName: "gauge.medium")
                                Text("Benchmark")
                                    .font(.system(size: 11, weight: .bold))
                            }
                            .padding(.horizontal, 10)
                            .padding(.vertical, 6)
                            .background(Theme.accentGradient)
                            .foregroundColor(.white)
                            .clipShape(Capsule())
                        }
                    }
                }
                .padding(14)
                .background(Theme.surface)
                .clipShape(RoundedRectangle(cornerRadius: 16))
                .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1))
                
                VStack(alignment: .leading, spacing: 10) {
                    Text("ACTIVE ENDPOINTS IN WORKSPACE")
                        .font(.system(size: 10, weight: .bold, design: .monospaced))
                        .foregroundColor(Theme.textMuted)
                    
                    if network.historyList.isEmpty {
                        Text("No active endpoints deployed on server.")
                            .font(.system(size: 11))
                            .foregroundColor(Theme.textMuted)
                            .padding(.vertical, 6)
                    } else {
                        ForEach(network.historyList) { ep in
                            HStack(spacing: 8) {
                                Text("ENDPOINT")
                                    .font(.system(size: 9, weight: .bold, design: .monospaced))
                                    .padding(.horizontal, 6)
                                    .padding(.vertical, 3)
                                    .background(Theme.getGreen.opacity(0.15))
                                    .foregroundColor(Theme.getGreen)
                                    .clipShape(RoundedRectangle(cornerRadius: 4))
                                
                                Text("/\(ep.baseUrlPath)")
                                    .font(.system(size: 11, design: .monospaced))
                                    .foregroundColor(.white)
                                    .lineLimit(1)
                                
                                Spacer()
                                
                                Text("\(ep.versions?.count ?? 0) versions")
                                    .font(.system(size: 10, weight: .bold))
                                    .foregroundColor(Theme.accent)
                            }
                            .padding(.vertical, 4)
                        }
                    }
                }
                .padding(14)
                .background(Theme.surface)
                .clipShape(RoundedRectangle(cornerRadius: 16))
                .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1))
            }
            .padding(.horizontal, 14)
            .padding(.top, 10)
            .padding(.bottom, 120)
        }
        .sheet(isPresented: $showLatencyTestSheet) {
            NetworkLatencyTestSheet(isPresented: $showLatencyTestSheet)
        }
    }
}

// MARK: - ⚙️ 12. Settings & Dev Tools Hub Screen
struct NativeSettingsView: View {
    @StateObject private var network = MockAPINetworkManager.shared
    @State private var serverUrlInput = Env.apiBaseUrl
    @State private var showAuthSheet = false
    @State private var showOpenApiSheet = false
    @State private var showSubscribeSheet = false
    
    var body: some View {
        ScrollView(showsIndicators: false) {
            VStack(spacing: 14) {
                // Profile & Tier Card
                VStack(spacing: 12) {
                    HStack(spacing: 12) {
                        Image(systemName: "person.crop.circle.fill")
                            .font(.system(size: 40))
                            .foregroundColor(Theme.accent)
                        
                        VStack(alignment: .leading, spacing: 3) {
                            HStack {
                                Text(network.currentUser?.username ?? "Unauthenticated")
                                    .font(.system(size: 15, weight: .bold))
                                    .foregroundColor(.white)
                                
                                Text((network.currentUser?.role ?? "guest").uppercased())
                                    .font(.system(size: 9, weight: .black))
                                    .padding(.horizontal, 6)
                                    .padding(.vertical, 2)
                                    .background(Theme.accentGradient)
                                    .foregroundColor(.white)
                                    .clipShape(Capsule())
                            }
                            
                            Text(network.currentUser?.email ?? "Sign in or create account to sync projects")
                                .font(.system(size: 11))
                                .foregroundColor(Theme.textMuted)
                        }
                        
                        Spacer()
                    }
                    
                    Divider().background(Theme.border)
                    
                    HStack {
                        Button(action: {
                            HapticFeedback.light()
                            showAuthSheet = true
                        }) {
                            HStack(spacing: 4) {
                                Image(systemName: "person.badge.key.fill")
                                Text(network.currentUser == nil || network.currentUser?.isGuest == true ? "Sign In / Register ✦" : "Switch Account")
                            }
                            .font(.system(size: 12, weight: .bold))
                            .foregroundColor(Theme.accent)
                        }
                        
                        Spacer()
                        
                        if network.currentUser != nil && network.currentUser?.isGuest == false {
                            Button("Sign Out") {
                                network.logout()
                            }
                            .font(.system(size: 12, weight: .bold))
                            .foregroundColor(Theme.deleteRed)
                        }
                    }
                }
                .padding(14)
                .background(Theme.surface)
                .clipShape(RoundedRectangle(cornerRadius: 18))
                .overlay(RoundedRectangle(cornerRadius: 18).stroke(Theme.border, lineWidth: 1))
                
                // Dev Tools Hub
                VStack(alignment: .leading, spacing: 10) {
                    Text("DEVELOPER TOOLS HUB")
                        .font(.system(size: 10, weight: .bold, design: .monospaced))
                        .foregroundColor(Theme.textMuted)
                    
                    DevToolRow(icon: "doc.text.fill", title: "OpenAPI / Swagger Importer", action: {
                        HapticFeedback.light()
                        showOpenApiSheet = true
                    })
                    DevToolRow(icon: "curlybraces", title: "JSON Formatter & Validator", action: {
                        HapticFeedback.light()
                        MockAPINetworkManager.shared.statusToast = "✨ JSON Validator Ready"
                    })
                    DevToolRow(icon: "number.square", title: "Base64 & URL Converter", action: {
                        HapticFeedback.light()
                        MockAPINetworkManager.shared.statusToast = "Base64 Converter Ready"
                    })
                    DevToolRow(icon: "tag.fill", title: "UUID v4 Generator", action: {
                        HapticFeedback.success()
                        let newUuid = UUID().uuidString.lowercased()
                        UIPasteboard.general.string = newUuid
                        MockAPINetworkManager.shared.statusToast = "📋 Copied UUID"
                    })
                }
                .padding(14)
                .background(Theme.surface)
                .clipShape(RoundedRectangle(cornerRadius: 18))
                .overlay(RoundedRectangle(cornerRadius: 18).stroke(Theme.border, lineWidth: 1))
                
                // Server Config (.env Overrides)
                VStack(alignment: .leading, spacing: 10) {
                    Text("SERVER BASE URL (.ENV: VITE_API_BASE_URL)")
                        .font(.system(size: 10, weight: .bold, design: .monospaced))
                        .foregroundColor(Theme.textMuted)
                    
                    TextField(Env.apiBaseUrl, text: $serverUrlInput)
                        .font(.system(size: 12, design: .monospaced))
                        .padding(10)
                        .background(Color.black.opacity(0.35))
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                    
                    Button("Save .env Base URL Override") {
                        HapticFeedback.success()
                        Env.setOverride("VITE_API_BASE_URL", value: serverUrlInput)
                        network.statusToast = "Saved .env URL Override"
                        network.fetchWorkspaces()
                    }
                    .font(.system(size: 11, weight: .bold))
                    .foregroundColor(Theme.accent)
                }
                .padding(14)
                .background(Theme.surface)
                .clipShape(RoundedRectangle(cornerRadius: 18))
                .overlay(RoundedRectangle(cornerRadius: 18).stroke(Theme.border, lineWidth: 1))
            }
            .padding(.horizontal, 14)
            .padding(.top, 10)
            .padding(.bottom, 120)
        }
        .sheet(isPresented: $showAuthSheet) {
            AuthModalSheet(isPresented: $showAuthSheet)
        }
        .sheet(isPresented: $showOpenApiSheet) {
            OpenApiImportSheet(isPresented: $showOpenApiSheet)
        }
        .sheet(isPresented: $showSubscribeSheet) {
            SubscribePricingSheet(isPresented: $showSubscribeSheet)
        }
    }
}

struct DevToolRow: View {
    let icon: String
    let title: String
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            HStack {
                Image(systemName: icon)
                    .font(.system(size: 13))
                    .foregroundColor(Theme.accent)
                    .frame(width: 24)
                Text(title)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(.white)
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundColor(Theme.textMuted)
            }
            .padding(.vertical, 6)
        }
    }
}

// MARK: - 🧪 13. In-App HTTP Live Tester Sheet
struct HttpTesterSheet: View {
    let method: String
    let path: String
    let mockResponse: String
    let statusCode: Int
    @Binding var isPresented: Bool
    
    @State private var isRunning = false
    @State private var responseTime = 0
    @State private var outputBody = ""
    @State private var actualStatus = 200
    
    var body: some View {
        VStack(spacing: 16) {
            HStack {
                Text("Live HTTP Request Runner 🧪")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundColor(.white)
                Spacer()
                Button("Done") { isPresented = false }
                    .font(.system(size: 13, weight: .bold))
                    .foregroundColor(Theme.accent)
            }
            
            HStack {
                Text(method)
                    .font(.system(size: 11, weight: .bold, design: .monospaced))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Theme.getGreen)
                    .foregroundColor(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 6))
                
                Text("\(Env.mockApiBaseUrl)/\(path)")
                    .font(.system(size: 12, design: .monospaced))
                    .foregroundColor(.white)
                    .lineLimit(1)
            }
            .padding(10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.surfaceHighlight)
            .clipShape(RoundedRectangle(cornerRadius: 10))
            
            Button(action: {
                executeLiveServerRequest()
            }) {
                HStack {
                    if isRunning {
                        ProgressView().progressViewStyle(CircularProgressViewStyle(tint: .white))
                    } else {
                        Image(systemName: "play.fill")
                        Text("Send Live Request to Server")
                            .font(.system(size: 13, weight: .bold))
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .background(Theme.accentGradient)
                .foregroundColor(.white)
                .clipShape(RoundedRectangle(cornerRadius: 12))
            }
            
            if !outputBody.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text("HTTP \(actualStatus)")
                            .font(.system(size: 11, weight: .bold, design: .monospaced))
                            .foregroundColor(actualStatus < 400 ? Theme.getGreen : Theme.deleteRed)
                        Spacer()
                        Text("Latency: \(responseTime)ms")
                            .font(.system(size: 11, design: .monospaced))
                            .foregroundColor(Theme.textMuted)
                    }
                    
                    ScrollView {
                        Text(outputBody)
                            .font(.system(size: 11, design: .monospaced))
                            .foregroundColor(actualStatus < 400 ? Theme.getGreen : Theme.deleteRed)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(10)
                    }
                    .background(Color.black.opacity(0.5))
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                }
            }
            Spacer()
        }
        .padding(20)
        .background(Theme.background.ignoresSafeArea())
    }
    
    private func executeLiveServerRequest() {
        guard let url = URL(string: "\(Env.mockApiBaseUrl)/\(path)") else { return }
        isRunning = true
        var req = MockAPINetworkManager.shared.prepareAuthorizedRequest(url: url, method: method)
        let start = Date()
        
        URLSession.shared.dataTask(with: req) { data, response, error in
            let elapsed = Int(Date().timeIntervalSince(start) * 1000)
            DispatchQueue.main.async {
                self.isRunning = false
                self.responseTime = elapsed
                if let http = response as? HTTPURLResponse {
                    self.actualStatus = http.statusCode
                }
                if let data = data, let text = String(data: data, encoding: .utf8) {
                    self.outputBody = text
                } else if let err = error {
                    self.outputBody = "Error: \(err.localizedDescription)"
                }
            }
        }.resume()
    }
}

// MARK: - 📦 14. Code Export Modal Sheet
struct CodeExportSheet: View {
    let method: String
    let path: String
    let headers: [KeyValuePair]
    let reqBody: String
    @Binding var isPresented: Bool
    @State private var selectedLanguage = "Swift"
    
    let languages = ["Swift", "cURL", "JavaScript", "Python"]
    
    var snippet: String {
        switch selectedLanguage {
        case "Swift":
            return """
            import Foundation

            var request = URLRequest(url: URL(string: "\(Env.mockApiBaseUrl)/\(path)")!)
            request.httpMethod = "\(method)"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")

            let task = URLSession.shared.dataTask(with: request) { data, response, error in
                guard let data = data else { return }
                print(String(data: data, encoding: .utf8)!)
            }
            task.resume()
            """
        case "cURL":
            return "curl -X \(method) \"\(Env.mockApiBaseUrl)/\(path)\" -H \"Content-Type: application/json\""
        case "JavaScript":
            return "const response = await fetch(\"\(Env.mockApiBaseUrl)/\(path)\", {\n  method: \"\(method)\",\n  headers: { \"Content-Type\": \"application/json\" }\n});\nconst data = await response.json();\nconsole.log(data);"
        default:
            return "import requests\n\nurl = \"\(Env.mockApiBaseUrl)/\(path)\"\nresponse = requests.\(method.lowercased())(url)\nprint(response.json())"
        }
    }
    
    var body: some View {
        VStack(spacing: 16) {
            HStack {
                Text("Code Generator 📦")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundColor(.white)
                Spacer()
                Button("Done") { isPresented = false }
                    .font(.system(size: 13, weight: .bold))
                    .foregroundColor(Theme.accent)
            }
            
            HStack(spacing: 6) {
                ForEach(languages, id: \.self) { lang in
                    Button(action: {
                        HapticFeedback.light()
                        selectedLanguage = lang
                    }) {
                        Text(lang)
                            .font(.system(size: 11, weight: .bold))
                            .padding(.horizontal, 12)
                            .padding(.vertical, 6)
                            .background(selectedLanguage == lang ? Theme.accent : Theme.surfaceHighlight)
                            .foregroundColor(selectedLanguage == lang ? .white : Theme.textSecondary)
                            .clipShape(Capsule())
                    }
                }
            }
            
            ScrollView {
                Text(snippet)
                    .font(.system(size: 11, design: .monospaced))
                    .foregroundColor(Theme.textPrimary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(12)
            }
            .background(Color.black.opacity(0.5))
            .clipShape(RoundedRectangle(cornerRadius: 12))
            
            Button(action: {
                HapticFeedback.success()
                UIPasteboard.general.string = snippet
                MockAPINetworkManager.shared.statusToast = "📋 Copied \(selectedLanguage) snippet!"
                isPresented = false
            }) {
                Text("Copy Snippet to Clipboard 📋")
                    .font(.system(size: 13, weight: .bold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(Theme.accentGradient)
                    .foregroundColor(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
            }
        }
        .padding(20)
        .background(Theme.background.ignoresSafeArea())
    }
}

// MARK: - 📋 15. Workspace Switcher Sheet
struct WorkspaceSwitcherSheet: View {
    @Binding var isPresented: Bool
    @StateObject private var network = MockAPINetworkManager.shared
    
    var body: some View {
        VStack(spacing: 16) {
            HStack {
                Text("Select Active Workspace")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundColor(.white)
                Spacer()
                Button("Close") { isPresented = false }
                    .font(.system(size: 13, weight: .bold))
                    .foregroundColor(Theme.accent)
            }
            
            if network.workspaces.isEmpty {
                Text("No workspaces available on server.")
                    .font(.system(size: 12))
                    .foregroundColor(Theme.textMuted)
                    .padding(20)
            } else {
                ForEach(network.workspaces) { ws in
                    Button(action: {
                        HapticFeedback.light()
                        network.activeWorkspace = ws
                        isPresented = false
                    }) {
                        HStack {
                            VStack(alignment: .leading, spacing: 3) {
                                Text(ws.projectname)
                                    .font(.system(size: 14, weight: .bold))
                                    .foregroundColor(.white)
                                if let code = ws.invitationCode {
                                    Text("Code: \(code)")
                                        .font(.system(size: 10, design: .monospaced))
                                        .foregroundColor(Theme.textMuted)
                                }
                            }
                            Spacer()
                            if network.activeWorkspace?.id == ws.id {
                                Image(systemName: "checkmark.circle.fill")
                                    .foregroundColor(Theme.getGreen)
                            }
                        }
                        .padding(12)
                        .background(Theme.surfaceHighlight)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                    }
                }
            }
            Spacer()
        }
        .padding(20)
        .background(Theme.background.ignoresSafeArea())
    }
}

// MARK: - 📑 16. Log Detail Sheet
struct LogDetailSheet: View {
    let log: TelemetryLogEntry
    @Environment(\.presentationMode) var presentationMode
    
    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Text("Request Telemetry Inspector")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundColor(.white)
                Spacer()
                Button("Done") { presentationMode.wrappedValue.dismiss() }
                    .font(.system(size: 13, weight: .bold))
                    .foregroundColor(Theme.accent)
            }
            
            HStack(spacing: 8) {
                Text(log.method)
                    .font(.system(size: 11, weight: .bold, design: .monospaced))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Theme.getGreen)
                    .foregroundColor(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 6))
                
                Text(log.path)
                    .font(.system(size: 12, design: .monospaced))
                    .foregroundColor(.white)
            }
            
            VStack(alignment: .leading, spacing: 6) {
                Text("RESPONSE BODY")
                    .font(.system(size: 10, weight: .bold, design: .monospaced))
                    .foregroundColor(Theme.textMuted)
                
                ScrollView {
                    Text(log.responseBody ?? "{}")
                        .font(.system(size: 11, design: .monospaced))
                        .foregroundColor(Theme.getGreen)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(10)
                }
                .frame(maxHeight: 180)
                .background(Color.black.opacity(0.4))
                .clipShape(RoundedRectangle(cornerRadius: 10))
            }
            Spacer()
        }
        .padding(20)
        .background(Theme.background.ignoresSafeArea())
    }
}

// MARK: - 🔐 17. Auth Modal Sheet
struct AuthModalSheet: View {
    @Binding var isPresented: Bool
    @StateObject private var network = MockAPINetworkManager.shared
    
    enum AuthMode {
        case signin
        case signup
        case otpVerify
    }
    
    @State private var mode: AuthMode = .signin
    @State private var username = ""
    @State private var name = ""
    @State private var email = ""
    @State private var password = ""
    @State private var otp = ""
    
    @State private var isLoading = false
    @State private var authError: String?
    @State private var successNotice: String?
    @State private var otpCountdown = 120
    @State private var timerCancellable: AnyCancellable?
    @State private var pingStatus = ""
    
    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                // Top Header & Close
                HStack {
                    Text(titleForMode)
                        .font(.system(size: 18, weight: .bold))
                        .foregroundColor(.white)
                    Spacer()
                    Button("Close") { isPresented = false }
                        .font(.system(size: 13, weight: .bold))
                        .foregroundColor(Theme.accent)
                }
                
                // Mode Toggle Bar
                if mode != .otpVerify {
                    HStack(spacing: 4) {
                        Button(action: {
                            HapticFeedback.light()
                            withAnimation {
                                mode = .signin
                                authError = nil
                            }
                        }) {
                            Text("Sign In")
                                .font(.system(size: 12, weight: .bold))
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 8)
                                .background(mode == .signin ? Theme.accent : Color.white.opacity(0.05))
                                .foregroundColor(mode == .signin ? .white : Theme.textMuted)
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                        }
                        
                        Button(action: {
                            HapticFeedback.light()
                            withAnimation {
                                mode = .signup
                                authError = nil
                            }
                        }) {
                            Text("Register")
                                .font(.system(size: 12, weight: .bold))
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 8)
                                .background(mode == .signup ? Theme.accent : Color.white.opacity(0.05))
                                .foregroundColor(mode == .signup ? .white : Theme.textMuted)
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                        }
                    }
                    .padding(4)
                    .background(Theme.surfaceHighlight)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                }
                
                // Error Alert Banner
                if let err = authError {
                    HStack(alignment: .top, spacing: 8) {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .foregroundColor(Theme.deleteRed)
                        Text(err)
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundColor(Theme.deleteRed)
                            .multilineTextAlignment(.leading)
                    }
                    .padding(12)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Theme.deleteRed.opacity(0.12))
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(Theme.deleteRed.opacity(0.3), lineWidth: 1))
                }
                
                // Success Alert Banner
                if let notice = successNotice {
                    HStack(spacing: 8) {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundColor(Theme.getGreen)
                        Text(notice)
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundColor(Theme.getGreen)
                    }
                    .padding(10)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Theme.getGreen.opacity(0.12))
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                }
                
                // Form Fields according to Mode
                if mode == .signin {
                    // Sign In Form
                    VStack(alignment: .leading, spacing: 10) {
                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                Text("USERNAME")
                                    .font(.system(size: 10, weight: .bold, design: .monospaced))
                                    .foregroundColor(Theme.textMuted)
                                Spacer()
                                Text("Use username (e.g. aditya)")
                                    .font(.system(size: 10))
                                    .foregroundColor(Theme.accent)
                            }
                            TextField("Enter username", text: $username)
                                .font(.system(size: 13))
                                .padding(12)
                                .background(Theme.surfaceHighlight)
                                .clipShape(RoundedRectangle(cornerRadius: 10))
                                .autocapitalization(.none)
                                .disableAutocorrection(true)
                                .textContentType(.username)
                        }
                        
                        VStack(alignment: .leading, spacing: 4) {
                            Text("PASSWORD")
                                .font(.system(size: 10, weight: .bold, design: .monospaced))
                                .foregroundColor(Theme.textMuted)
                            SecureField("Enter password", text: $password)
                                .font(.system(size: 13))
                                .padding(12)
                                .background(Theme.surfaceHighlight)
                                .clipShape(RoundedRectangle(cornerRadius: 10))
                                .textContentType(.password)
                        }
                    }
                    
                    // Sign In Button
                    Button(action: handleSignIn) {
                        HStack {
                            if isLoading {
                                ProgressView().progressViewStyle(CircularProgressViewStyle(tint: .white))
                            } else {
                                Text("Sign In to MockAPI ✦")
                                    .font(.system(size: 13, weight: .bold))
                            }
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .background(Theme.accentGradient)
                        .foregroundColor(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                    }
                    .disabled(isLoading)
                    
                    // Guest Login Option
                    HStack {
                        Rectangle().frame(height: 1).foregroundColor(Theme.border)
                        Text("OR")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundColor(Theme.textMuted)
                        Rectangle().frame(height: 1).foregroundColor(Theme.border)
                    }
                    .padding(.vertical, 4)
                    
                    Button(action: handleGuestSignIn) {
                        HStack {
                            Image(systemName: "person.crop.circle")
                            Text("Continue as Guest")
                                .font(.system(size: 12, weight: .bold))
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                        .background(Theme.surfaceHighlight)
                        .foregroundColor(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                        .overlay(RoundedRectangle(cornerRadius: 10).stroke(Theme.borderBright, lineWidth: 1))
                    }
                    .disabled(isLoading)
                    
                    // Server Connectivity Diagnostic
                    Button(action: testServerPing) {
                        HStack(spacing: 4) {
                            Image(systemName: "network")
                                .font(.system(size: 10))
                            Text(pingStatus.isEmpty ? "Check Server Status (\(Env.apiBaseUrl))" : pingStatus)
                                .font(.system(size: 10, design: .monospaced))
                        }
                        .foregroundColor(Theme.textMuted)
                        .padding(.top, 6)
                    }
                    
                } else if mode == .signup {
                    // Register Form
                    VStack(alignment: .leading, spacing: 10) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("FULL NAME")
                                .font(.system(size: 10, weight: .bold, design: .monospaced))
                                .foregroundColor(Theme.textMuted)
                            TextField("e.g. Aditya Boxi", text: $name)
                                .font(.system(size: 13))
                                .padding(12)
                                .background(Theme.surfaceHighlight)
                                .clipShape(RoundedRectangle(cornerRadius: 10))
                        }
                        
                        VStack(alignment: .leading, spacing: 4) {
                            Text("USERNAME")
                                .font(.system(size: 10, weight: .bold, design: .monospaced))
                                .foregroundColor(Theme.textMuted)
                            TextField("Choose username", text: $username)
                                .font(.system(size: 13))
                                .padding(12)
                                .background(Theme.surfaceHighlight)
                                .clipShape(RoundedRectangle(cornerRadius: 10))
                                .autocapitalization(.none)
                                .disableAutocorrection(true)
                        }
                        
                        VStack(alignment: .leading, spacing: 4) {
                            Text("EMAIL ADDRESS")
                                .font(.system(size: 10, weight: .bold, design: .monospaced))
                                .foregroundColor(Theme.textMuted)
                            TextField("name@example.com", text: $email)
                                .font(.system(size: 13))
                                .padding(12)
                                .background(Theme.surfaceHighlight)
                                .clipShape(RoundedRectangle(cornerRadius: 10))
                                .keyboardType(.emailAddress)
                                .autocapitalization(.none)
                        }
                        
                        VStack(alignment: .leading, spacing: 4) {
                            Text("PASSWORD")
                                .font(.system(size: 10, weight: .bold, design: .monospaced))
                                .foregroundColor(Theme.textMuted)
                            SecureField("Choose a secure password", text: $password)
                                .font(.system(size: 13))
                                .padding(12)
                                .background(Theme.surfaceHighlight)
                                .clipShape(RoundedRectangle(cornerRadius: 10))
                        }
                    }
                    
                    // Register & Send OTP Button
                    Button(action: handleSignUp) {
                        HStack {
                            if isLoading {
                                ProgressView().progressViewStyle(CircularProgressViewStyle(tint: .white))
                            } else {
                                Text("Create Account & Send OTP 🚀")
                                    .font(.system(size: 13, weight: .bold))
                            }
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .background(Theme.accentGradient)
                        .foregroundColor(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                    }
                    .disabled(isLoading)
                    
                } else if mode == .otpVerify {
                    // OTP Verification Step
                    VStack(alignment: .leading, spacing: 12) {
                        Text("We sent a 6-digit verification code to \(email). Please enter it below:")
                            .font(.system(size: 12))
                            .foregroundColor(Theme.textSecondary)
                        
                        TextField("6-Digit OTP (e.g. 849201)", text: $otp)
                            .font(.system(size: 16, weight: .bold, design: .monospaced))
                            .padding(12)
                            .background(Theme.surfaceHighlight)
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                            .keyboardType(.numberPad)
                            .multilineTextAlignment(.center)
                        
                        Button(action: handleVerifyOtp) {
                            HStack {
                                if isLoading {
                                    ProgressView().progressViewStyle(CircularProgressViewStyle(tint: .white))
                                } else {
                                    Text("Verify OTP & Complete Sign In ✦")
                                        .font(.system(size: 13, weight: .bold))
                                }
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 12)
                            .background(Theme.getGreen)
                            .foregroundColor(.white)
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                        }
                        .disabled(isLoading)
                        
                        HStack {
                            if otpCountdown > 0 {
                                Text("Resend code in \(otpCountdown)s")
                                    .font(.system(size: 11))
                                    .foregroundColor(Theme.textMuted)
                            } else {
                                Button("Resend OTP Code") {
                                    handleResendOtp()
                                }
                                .font(.system(size: 11, weight: .bold))
                                .foregroundColor(Theme.accent)
                            }
                            Spacer()
                            Button("Back to Register") {
                                withAnimation {
                                    mode = .signup
                                    authError = nil
                                }
                            }
                            .font(.system(size: 11))
                            .foregroundColor(Theme.textSecondary)
                        }
                    }
                }
            }
            .padding(20)
        }
        .background(Theme.background.ignoresSafeArea())
    }
    
    private var titleForMode: String {
        switch mode {
        case .signin: return "Sign In"
        case .signup: return "Create Account"
        case .otpVerify: return "Verify Email OTP"
        }
    }
    
    private func handleSignIn() {
        let cleanUName = username.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleanUName.isEmpty else {
            authError = "Please enter your username"
            return
        }
        guard !password.isEmpty else {
            authError = "Please enter your password"
            return
        }
        
        isLoading = true
        authError = nil
        
        network.login(username: cleanUName, password: password) { success, errMsg in
            isLoading = false
            if success {
                isPresented = false
            } else {
                authError = errMsg ?? "Login failed"
                HapticFeedback.error()
            }
        }
    }
    
    private func handleGuestSignIn() {
        isLoading = true
        authError = nil
        network.createGuestSession { success, errMsg in
            isLoading = false
            if success {
                isPresented = false
            } else {
                authError = errMsg ?? "Failed to create guest session"
                HapticFeedback.error()
            }
        }
    }
    
    private func handleSignUp() {
        guard !name.trimmingCharacters(in: .whitespaces).isEmpty else {
            authError = "Please enter your name"
            return
        }
        guard !username.trimmingCharacters(in: .whitespaces).isEmpty else {
            authError = "Please choose a username"
            return
        }
        guard !email.trimmingCharacters(in: .whitespaces).isEmpty else {
            authError = "Please enter your email"
            return
        }
        guard !password.isEmpty else {
            authError = "Please enter a password"
            return
        }
        
        isLoading = true
        authError = nil
        
        network.signup(name: name, username: username, email: email, password: password) { success, msg in
            isLoading = false
            if success {
                successNotice = msg
                startOtpTimer()
                withAnimation {
                    mode = .otpVerify
                }
            } else {
                authError = msg
                HapticFeedback.error()
            }
        }
    }
    
    private func handleVerifyOtp() {
        guard !otp.trimmingCharacters(in: .whitespaces).isEmpty else {
            authError = "Please enter the OTP code"
            return
        }
        
        isLoading = true
        authError = nil
        
        network.verifyOtp(name: name, username: username, email: email, password: password, otp: otp) { success, errMsg in
            isLoading = false
            if success {
                isPresented = false
            } else {
                authError = errMsg ?? "OTP verification failed"
                HapticFeedback.error()
            }
        }
    }
    
    private func handleResendOtp() {
        isLoading = true
        authError = nil
        network.resendOtp(name: name, username: username, email: email, password: password) { success, msg in
            isLoading = false
            if success {
                successNotice = msg
                startOtpTimer()
            } else {
                authError = msg
                HapticFeedback.error()
            }
        }
    }
    
    private func startOtpTimer() {
        otpCountdown = Env.otpTimer
        timerCancellable?.cancel()
        timerCancellable = Timer.publish(every: 1.0, on: .main, in: .common)
            .autoconnect()
            .sink { _ in
                if self.otpCountdown > 0 {
                    self.otpCountdown -= 1
                } else {
                    self.timerCancellable?.cancel()
                }
            }
    }
    
    private func testServerPing() {
        guard let url = URL(string: "\(Env.apiBaseUrl)/api/latency-test") else { return }
        pingStatus = "Pinging \(url.host ?? "")..."
        var req = URLRequest(url: url)
        req.cachePolicy = .reloadIgnoringLocalCacheData
        let start = Date()
        
        URLSession.shared.dataTask(with: req) { _, res, err in
            let ms = Int(Date().timeIntervalSince(start) * 1000)
            DispatchQueue.main.async {
                if let err = err {
                    self.pingStatus = "❌ Unreachable: \(err.localizedDescription)"
                } else if let http = res as? HTTPURLResponse {
                    self.pingStatus = "✅ Connected (HTTP \(http.statusCode), \(ms)ms)"
                }
            }
        }.resume()
    }
}

// MARK: - 📄 18. OpenAPI Spec Importer Sheet
struct OpenApiImportSheet: View {
    @Binding var isPresented: Bool
    @State private var openApiSpecText = "openapi: 3.0.0\ninfo:\n  title: Sample API\n  version: 1.0.0\npaths:\n  /users:\n    get:\n      responses:\n        '200':\n          description: Success"
    @State private var isImporting = false
    
    var body: some View {
        VStack(spacing: 14) {
            HStack {
                Text("OpenAPI / Swagger Importer 📄")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundColor(.white)
                Spacer()
                Button("Done") { isPresented = false }
                    .font(.system(size: 13, weight: .bold))
                    .foregroundColor(Theme.accent)
            }
            
            Text("Paste your OpenAPI (Swagger) v3 specification in YAML or JSON format to bulk-generate endpoints for active workspace.")
                .font(.system(size: 11))
                .foregroundColor(Theme.textMuted)
                .frame(maxWidth: .infinity, alignment: .leading)
            
            TextEditor(text: $openApiSpecText)
                .font(.system(size: 11, design: .monospaced))
                .foregroundColor(Theme.postBlue)
                .frame(maxHeight: .infinity)
                .padding(8)
                .background(Color.black.opacity(0.45))
                .clipShape(RoundedRectangle(cornerRadius: 12))
            
            Button(action: {
                executeOpenApiImport()
            }) {
                HStack {
                    if isImporting {
                        ProgressView().progressViewStyle(CircularProgressViewStyle(tint: .white))
                    } else {
                        Text("Import Endpoints into Workspace 🚀")
                            .font(.system(size: 13, weight: .bold))
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .background(Theme.accentGradient)
                .foregroundColor(.white)
                .clipShape(RoundedRectangle(cornerRadius: 12))
            }
            .disabled(isImporting)
        }
        .padding(20)
        .background(Theme.background.ignoresSafeArea())
    }
    
    private func executeOpenApiImport() {
        guard let project = MockAPINetworkManager.shared.activeWorkspace else {
            MockAPINetworkManager.shared.statusToast = "Select a workspace first"
            return
        }
        guard let url = URL(string: Env.importOpenApiUrl) else { return }
        
        isImporting = true
        let boundary = "Boundary-\(UUID().uuidString)"
        var req = MockAPINetworkManager.shared.prepareAuthorizedRequest(url: url, method: "POST")
        req.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        
        var body = Data()
        // Form field: projectId
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"projectId\"\r\n\r\n".data(using: .utf8)!)
        body.append("\(project.id)\r\n".data(using: .utf8)!)
        
        // Form field: file
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"file\"; filename=\"spec.yaml\"\r\n".data(using: .utf8)!)
        body.append("Content-Type: text/yaml\r\n\r\n".data(using: .utf8)!)
        body.append(openApiSpecText.data(using: .utf8)!)
        body.append("\r\n--\(boundary)--\r\n".data(using: .utf8)!)
        
        req.httpBody = body
        
        URLSession.shared.dataTask(with: req) { _, _, _ in
            DispatchQueue.main.async {
                self.isImporting = false
                HapticFeedback.success()
                MockAPINetworkManager.shared.statusToast = "✨ Bulk imported endpoints from OpenAPI!"
                MockAPINetworkManager.shared.fetchHistory(projectId: project.id)
                self.isPresented = false
            }
        }.resume()
    }
}

// MARK: - ⚡ 19. Network Latency Ping Tester Sheet
struct NetworkLatencyTestSheet: View {
    @Binding var isPresented: Bool
    @State private var isRunning = false
    @State private var progress: Double = 0.0
    @State private var minLat: Int = 0
    @State private var avgLat: Int = 0
    @State private var maxLat: Int = 0
    
    var body: some View {
        VStack(spacing: 16) {
            HStack {
                Text("Server Latency Ping Benchmark ⚡")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundColor(.white)
                Spacer()
                Button("Done") { isPresented = false }
                    .font(.system(size: 13, weight: .bold))
                    .foregroundColor(Theme.accent)
            }
            
            VStack(spacing: 10) {
                HStack {
                    KPIStatCard(title: "MIN RTT", value: minLat > 0 ? "\(minLat)ms" : "—", color: Theme.getGreen)
                    KPIStatCard(title: "AVG RTT", value: avgLat > 0 ? "\(avgLat)ms" : "—", color: Theme.accent)
                    KPIStatCard(title: "MAX RTT", value: maxLat > 0 ? "\(maxLat)ms" : "—", color: Theme.putAmber)
                }
            }
            
            ProgressView(value: progress)
                .progressViewStyle(LinearProgressViewStyle(tint: Theme.accent))
                .padding(.vertical, 6)
            
            Button(action: {
                runLiveServerBenchmark()
            }) {
                HStack {
                    if isRunning {
                        ProgressView().progressViewStyle(CircularProgressViewStyle(tint: .white))
                    } else {
                        Image(systemName: "gauge.badge.plus")
                        Text("Run 5-Sample Live Server Ping")
                            .font(.system(size: 13, weight: .bold))
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .background(Theme.accentGradient)
                .foregroundColor(.white)
                .clipShape(RoundedRectangle(cornerRadius: 12))
            }
            
            Spacer()
        }
        .padding(20)
        .background(Theme.background.ignoresSafeArea())
    }
    
    private func runLiveServerBenchmark() {
        guard let url = URL(string: "\(Env.apiBaseUrl)/api/latency-test") else { return }
        isRunning = true
        progress = 0.0
        var samples: [Int] = []
        
        func pingNext(index: Int) {
            if index >= 5 {
                DispatchQueue.main.async {
                    self.isRunning = false
                    self.progress = 1.0
                    if !samples.isEmpty {
                        self.minLat = samples.min() ?? 0
                        self.maxLat = samples.max() ?? 0
                        self.avgLat = samples.reduce(0, +) / samples.count
                        MockAPINetworkManager.shared.avgLatencyMs = self.avgLat
                        HapticFeedback.success()
                    }
                }
                return
            }
            
            let start = Date()
            var req = URLRequest(url: url)
            req.cachePolicy = .reloadIgnoringLocalCacheData
            
            URLSession.shared.dataTask(with: req) { _, _, _ in
                let elapsed = Int(Date().timeIntervalSince(start) * 1000)
                samples.append(elapsed)
                DispatchQueue.main.async {
                    self.progress = Double(index + 1) / 5.0
                    DispatchQueue.global().asyncAfter(deadline: .now() + 0.1) {
                        pingNext(index: index + 1)
                    }
                }
            }.resume()
        }
        
        pingNext(index: 0)
    }
}

// MARK: - 💎 20. Pro Subscription Tier Sheet
struct SubscribePricingSheet: View {
    @Binding var isPresented: Bool
    @StateObject private var network = MockAPINetworkManager.shared
    
    var body: some View {
        ScrollView(showsIndicators: false) {
            VStack(spacing: 16) {
                HStack {
                    Text("Developer Access Tiers 💎")
                        .font(.system(size: 16, weight: .bold))
                        .foregroundColor(.white)
                    Spacer()
                    Button("Close") { isPresented = false }
                        .font(.system(size: 13, weight: .bold))
                        .foregroundColor(Theme.accent)
                }
                
                VStack(alignment: .leading, spacing: 12) {
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("PRO DEVELOPER PLAN")
                                .font(.system(size: 10, weight: .bold, design: .monospaced))
                                .foregroundColor(Theme.accent)
                            Text("$9 / mo")
                                .font(.system(size: 24, weight: .black, design: .monospaced))
                                .foregroundColor(.white)
                        }
                        Spacer()
                        Text(network.currentUser?.isSubscribed == true ? "ACTIVE" : "POPULAR")
                            .font(.system(size: 10, weight: .bold))
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(Theme.accent)
                            .foregroundColor(.white)
                            .clipShape(Capsule())
                    }
                    
                    Divider().background(Theme.border)
                    
                    VStack(alignment: .leading, spacing: 6) {
                        FeatureCheckRow(text: "Unlimited Workspaces & Collaborators")
                        FeatureCheckRow(text: "Sub-millisecond Mock API Response Latency")
                        FeatureCheckRow(text: "Unlimited AI Schema & Mock Data Blueprints")
                        FeatureCheckRow(text: "Real-time Socket.IO Live Telemetry Logging")
                        FeatureCheckRow(text: "OpenAPI v3 & Swagger Spec Bulk Importer")
                        FeatureCheckRow(text: "Custom Domain Routing & SSL Certificates")
                    }
                }
                .padding(16)
                .background(Theme.surface)
                .clipShape(RoundedRectangle(cornerRadius: 18))
                .overlay(RoundedRectangle(cornerRadius: 18).stroke(Theme.accent, lineWidth: 1.5))
            }
            .padding(20)
        }
        .background(Theme.background.ignoresSafeArea())
    }
}

struct FeatureCheckRow: View {
    let text: String
    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 12))
                .foregroundColor(Theme.getGreen)
            Text(text)
                .font(.system(size: 11))
                .foregroundColor(Theme.textSecondary)
        }
    }
}

// MARK: - 🎨 21. Color Hex Extension
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

struct KPIStatCard: View {
    let title: String
    let value: String
    let color: Color
    
    var body: some View {
        VStack(spacing: 3) {
            Text(title)
                .font(.system(size: 8, weight: .bold, design: .monospaced))
                .foregroundColor(Theme.textMuted)
            Text(value)
                .font(.system(size: 14, weight: .black, design: .monospaced))
                .foregroundColor(color)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
        .background(Theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.border, lineWidth: 1))
    }
}
