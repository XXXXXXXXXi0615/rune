import Foundation
import MCP

actor MCPConnectionRegistry {
    static let shared = MCPConnectionRegistry()
    private var clients: [String: LunartideMCPClient] = [:]

    func connect(_ configuration: MCPServerConfiguration) async throws -> MCPConnectionSnapshot {
        let client = LunartideMCPClient(configuration: configuration)
        try await client.connect()
        clients[configuration.serverId] = client
        return await snapshot(for: client, status: "connected", error: nil)
    }

    func disconnect(serverId: String) async {
        guard let client = clients.removeValue(forKey: serverId) else { return }
        await client.disconnect()
    }

    func listTools(serverId: String) async throws -> [Tool] {
        guard let client = clients[serverId] else { throw LunartideMCPError.notConnected }
        return try await client.listTools()
    }

    func callTool(serverId: String, name: String, arguments: [String: Value]?, callId: String) async throws -> CallTool.Result {
        guard let client = clients[serverId] else { throw LunartideMCPError.notConnected }
        return try await client.callTool(name: name, arguments: arguments, callId: callId)
    }

    func cancel(serverId: String, callId: String) async throws {
        guard let client = clients[serverId] else { throw LunartideMCPError.notConnected }
        try await client.cancel(callId: callId)
    }

    func snapshots() async -> [MCPConnectionSnapshot] {
        var result: [MCPConnectionSnapshot] = []
        for client in clients.values { result.append(await snapshot(for: client, status: "connected", error: nil)) }
        return result
    }

    private func snapshot(for client: LunartideMCPClient, status: String, error: String?) async -> MCPConnectionSnapshot {
        let config = client.configuration
        let toolCount = await client.toolCount
        let connectedAt = await client.lastConnectedAt
        return MCPConnectionSnapshot(
            serverId: config.serverId,
            displayName: config.displayName,
            endpoint: config.endpoint.absoluteString,
            connectionStatus: status,
            toolCount: toolCount,
            lastConnectedAt: connectedAt.map { ISO8601DateFormatter().string(from: $0) },
            lastError: error,
            permissionPolicy: config.permissionPolicy
        )
    }
}
