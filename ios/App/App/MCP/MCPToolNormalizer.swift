import Foundation
import MCP

enum MCPToolNormalizer {
    static func jsonObject<T: Encodable>(_ value: T) throws -> Any {
        let data = try JSONEncoder().encode(value)
        return try JSONSerialization.jsonObject(with: data)
    }

    static func normalizeTool(_ tool: Tool) throws -> [String: Any] {
        [
            "name": tool.name,
            "title": tool.title as Any,
            "description": tool.description as Any,
            "inputSchema": try jsonObject(tool.inputSchema),
        ]
    }

    static func normalizeResult(_ result: CallTool.Result) throws -> [String: Any] {
        var payload: [String: Any] = [
            "content": try result.content.map { try jsonObject($0) },
            "isError": result.isError ?? false,
        ]
        if let structured = result.structuredContent { payload["structuredContent"] = try jsonObject(structured) }
        return payload
    }

    static func valueMap(from object: [String: Any]?) throws -> [String: Value]? {
        guard let object else { return nil }
        let data = try JSONSerialization.data(withJSONObject: object)
        return try JSONDecoder().decode([String: Value].self, from: data)
    }
}
