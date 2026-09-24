import Foundation

struct MCPServerConfiguration: Codable, Sendable {
    let serverId: String
    let displayName: String
    let endpoint: URL
    let permissionPolicy: String
}

struct MCPConnectionSnapshot: Codable, Sendable {
    let serverId: String
    let displayName: String
    let endpoint: String
    let connectionStatus: String
    let toolCount: Int
    let lastConnectedAt: String?
    let lastError: String?
    let permissionPolicy: String
}

struct MCPCredential: Codable, Sendable {
    let accessToken: String?
    let refreshToken: String?
    let tokenExpiry: Date?
    let oauthVerifier: String?
    let credentialIdentifier: String
}

enum LunartideMCPError: LocalizedError {
    case invalidEndpoint
    case notConnected
    case authorizationNotConfigured
    case callNotFound

    var errorDescription: String? {
        switch self {
        case .invalidEndpoint: return "Only HTTPS MCP endpoints are supported."
        case .notConnected: return "MCP server is not connected."
        case .authorizationNotConfigured: return "This server has not provided an OAuth authorization endpoint."
        case .callNotFound: return "The MCP call is no longer active."
        }
    }
}
