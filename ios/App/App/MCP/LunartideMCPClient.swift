import Foundation
import MCP

actor LunartideMCPClient {
    let configuration: MCPServerConfiguration
    private let credentialStore: MCPCredentialStore
    private var client: Client?
    private var transport: HTTPClientTransport?
    private var activeCalls: [String: ID] = [:]
    private(set) var toolCount = 0
    private(set) var lastConnectedAt: Date?

    init(configuration: MCPServerConfiguration, credentialStore: MCPCredentialStore = .shared) {
        self.configuration = configuration
        self.credentialStore = credentialStore
    }

    func connect() async throws {
        guard configuration.endpoint.scheme?.lowercased() == "https" else { throw LunartideMCPError.invalidEndpoint }
        await disconnect()
        let credential = try credentialStore.load(serverId: configuration.serverId)
        let sessionConfiguration = URLSessionConfiguration.ephemeral
        sessionConfiguration.timeoutIntervalForRequest = 30
        sessionConfiguration.timeoutIntervalForResource = 90
        let transport = HTTPClientTransport(
            endpoint: configuration.endpoint,
            configuration: sessionConfiguration,
            streaming: true,
            sseInitializationTimeout: 10,
            requestModifier: { request in
                var request = request
                if let token = credential?.accessToken, !token.isEmpty { request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
                return request
            }
        )
        let client = Client(name: "Lunartide iOS", version: "1.0.0")
        _ = try await client.connect(transport: transport)
        self.transport = transport
        self.client = client
        lastConnectedAt = Date()
        let toolsResult = try await client.listTools()
        let tools = toolsResult.tools
        toolCount = tools.count
    }

    func disconnect() async {
        if let client { await client.disconnect() }
        client = nil
        transport = nil
        activeCalls.removeAll()
    }

    func listTools() async throws -> [Tool] {
        try await withSessionRecovery { client in
            let result = try await client.listTools()
            return result.tools
        }
    }

    func callTool(name: String, arguments: [String: Value]?, callId: String) async throws -> CallTool.Result {
        try await withSessionRecovery { client in
            let context: RequestContext<CallTool.Result> = try await client.callTool(name: name, arguments: arguments)
            self.activeCalls[callId] = context.requestID
            defer { self.activeCalls.removeValue(forKey: callId) }
            return try await context.value
        }
    }

    func cancel(callId: String) async throws {
        guard let client, let requestID = activeCalls[callId] else { throw LunartideMCPError.callNotFound }
        try await client.cancelRequest(requestID, reason: "Cancelled by Lunartide user")
        activeCalls.removeValue(forKey: callId)
    }

    private func withSessionRecovery<T>(_ operation: (Client) async throws -> T) async throws -> T {
        guard let client else { throw LunartideMCPError.notConnected }
        do { return try await operation(client) }
        catch {
            guard isExpiredSession(error) else { throw error }
            try await connect()
            guard let recovered = self.client else { throw LunartideMCPError.notConnected }
            return try await operation(recovered)
        }
    }

    private func isExpiredSession(_ error: Error) -> Bool {
        let text = error.localizedDescription.lowercased()
        return text.contains("404") || text.contains("session") && (text.contains("expired") || text.contains("invalid"))
    }
}
