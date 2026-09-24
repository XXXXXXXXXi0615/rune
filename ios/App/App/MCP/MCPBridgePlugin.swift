import Foundation
import Capacitor

@objc(MCPBridgePlugin)
public final class MCPBridgePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "MCPBridgePlugin"
    public let jsName = "MCPBridge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "connect", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "beginAuthorization", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "completeAuthorization", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "disconnect", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "listTools", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "callTool", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancelCall", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getConnections", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearCredentials", returnType: CAPPluginReturnPromise),
    ]

    private let registry = MCPConnectionRegistry.shared
    private let credentials = MCPCredentialStore.shared

    @objc func connect(_ call: CAPPluginCall) {
        do {
            let configuration = try configuration(from: call)
            Task {
                do {
                    let snapshot = try await registry.connect(configuration)
                    call.resolve(try dictionary(snapshot))
                }
                catch { call.reject(error.localizedDescription) }
            }
        } catch { call.reject(error.localizedDescription) }
    }

    @objc func beginAuthorization(_ call: CAPPluginCall) {
        call.reject(LunartideMCPError.authorizationNotConfigured.localizedDescription)
    }

    @objc func completeAuthorization(_ call: CAPPluginCall) {
        call.reject(LunartideMCPError.authorizationNotConfigured.localizedDescription)
    }

    @objc func disconnect(_ call: CAPPluginCall) {
        guard let serverId = call.getString("serverId") else { call.reject("Missing serverId"); return }
        Task { await registry.disconnect(serverId: serverId); call.resolve() }
    }

    @objc func listTools(_ call: CAPPluginCall) {
        guard let serverId = call.getString("serverId") else { call.reject("Missing serverId"); return }
        Task {
            do { call.resolve(["tools": try await registry.listTools(serverId: serverId).map(MCPToolNormalizer.normalizeTool)]) }
            catch { call.reject(error.localizedDescription) }
        }
    }

    @objc func callTool(_ call: CAPPluginCall) {
        guard let serverId = call.getString("serverId"), let toolName = call.getString("toolName") else { call.reject("Missing serverId or toolName"); return }
        let callId = call.getString("callId") ?? UUID().uuidString
        do {
            let arguments = try MCPToolNormalizer.valueMap(from: call.getObject("arguments"))
            Task {
                do {
                    let result = try await registry.callTool(serverId: serverId, name: toolName, arguments: arguments, callId: callId)
                    call.resolve(try MCPToolNormalizer.normalizeResult(result))
                }
                catch is CancellationError { call.reject("Call cancelled", "MCP_CALL_CANCELLED") }
                catch { call.reject(error.localizedDescription) }
            }
        } catch { call.reject(error.localizedDescription) }
    }

    @objc func cancelCall(_ call: CAPPluginCall) {
        guard let serverId = call.getString("serverId"), let callId = call.getString("callId") else { call.reject("Missing serverId or callId"); return }
        Task {
            do { try await registry.cancel(serverId: serverId, callId: callId); call.resolve() }
            catch { call.reject(error.localizedDescription) }
        }
    }

    @objc func getConnections(_ call: CAPPluginCall) {
        Task {
            do {
                let snapshots = await registry.snapshots()
                call.resolve(["connections": try snapshots.map(dictionary)])
            }
            catch { call.reject(error.localizedDescription) }
        }
    }

    @objc func clearCredentials(_ call: CAPPluginCall) {
        guard let serverId = call.getString("serverId") else { call.reject("Missing serverId"); return }
        do { try credentials.clear(serverId: serverId); call.resolve() }
        catch { call.reject(error.localizedDescription) }
    }

    private func configuration(from call: CAPPluginCall) throws -> MCPServerConfiguration {
        guard
            let serverId = call.getString("serverId"),
            let displayName = call.getString("displayName"),
            let endpointText = call.getString("endpoint"),
            let endpoint = URL(string: endpointText),
            endpoint.scheme?.lowercased() == "https"
        else { throw LunartideMCPError.invalidEndpoint }
        return MCPServerConfiguration(serverId: serverId, displayName: displayName, endpoint: endpoint, permissionPolicy: call.getString("permissionPolicy") ?? "ask")
    }

    private func dictionary<T: Encodable>(_ value: T) throws -> [String: Any] {
        guard let object = try MCPToolNormalizer.jsonObject(value) as? [String: Any] else { return [:] }
        return object
    }
}
