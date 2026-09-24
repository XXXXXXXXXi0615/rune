export const MAX_PAYLOAD_BYTES = 4096;
const TYPES = new Set(['session.started','session.ended','turn.started','thinking','tool.started','tool.completed','approval.requested','user.input.required','task.completed','task.failed','heartbeat']);
const TOOLS = new Set(['read','search','edit','shell','test','build','other']);
const KEYS = new Set(['version','id','type','source','timestamp','sessionId','turnId','toolCategory']);
const SAFE_ID = /^[a-zA-Z0-9._:-]{1,96}$/;

export function normalizeCodexHook(input, now = Date.now()) {
  const hookName = typeof input?.hook_event_name === 'string' ? input.hook_event_name : '';
  const reason = typeof input?.reason === 'string' ? input.reason.toLowerCase() : '';
  const permissionTool = typeof input?.tool_name === 'string' ? input.tool_name.toLowerCase() : '';
  const type = typeof input?.type === 'string' ? input.type
    : hookName === 'PermissionRequest' && /request_user_input|user_input|elicitation/.test(permissionTool) ? 'user.input.required'
      : hookName === 'SessionEnd' && /fail|error|abort/.test(reason) ? 'task.failed'
        : ({ SessionStart: 'session.started', UserPromptSubmit: 'turn.started', PreToolUse: 'tool.started', PermissionRequest: 'approval.requested', PostToolUse: 'tool.completed', SessionEnd: 'session.ended', Stop: 'task.completed' })[hookName] || '';
  const toolName = typeof input?.tool_name === 'string' ? input.tool_name.toLowerCase() : '';
  const inferredTool = /read|find|search|grep|glob|list/.test(toolName) ? (/search|grep|find|glob/.test(toolName) ? 'search' : 'read') : /test|vitest|playwright/.test(toolName) ? 'test' : /build|compile|typecheck/.test(toolName) ? 'build' : /edit|write|patch/.test(toolName) ? 'edit' : /shell|exec|command|terminal/.test(toolName) ? 'shell' : 'other';
  const toolCategory = typeof input?.toolCategory === 'string' ? input.toolCategory : type.startsWith('tool.') ? inferredTool : undefined;
  return validateActivity({
    version: 1,
    id: typeof input?.id === 'string' ? input.id : `codex:${now}:${Math.random().toString(36).slice(2, 10)}`,
    type,
    source: 'codex',
    timestamp: typeof input?.timestamp === 'number' ? input.timestamp : now,
    ...(typeof input?.sessionId === 'string' ? { sessionId: input.sessionId } : typeof input?.session_id === 'string' ? { sessionId: input.session_id } : {}),
    ...(typeof input?.turnId === 'string' ? { turnId: input.turnId } : typeof input?.turn_id === 'string' ? { turnId: input.turn_id } : {}),
    ...(toolCategory ? { toolCategory } : {}),
  });
}

export function validateActivity(input) {
  let bytes = 0;
  try { bytes = Buffer.byteLength(JSON.stringify(input)); } catch { return { ok: false, error: 'not_serializable' }; }
  if (bytes > MAX_PAYLOAD_BYTES) return { ok: false, error: 'payload_too_large' };
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, error: 'invalid_object' };
  if (Object.keys(input).some((key) => !KEYS.has(key))) return { ok: false, error: 'unknown_field' };
  if (input.version !== 1 || !SAFE_ID.test(input.id || '') || !TYPES.has(input.type) || input.source !== 'codex' || !Number.isFinite(input.timestamp)) return { ok: false, error: 'invalid_schema' };
  if (input.sessionId !== undefined && !SAFE_ID.test(input.sessionId)) return { ok: false, error: 'invalid_session' };
  if (input.turnId !== undefined && !SAFE_ID.test(input.turnId)) return { ok: false, error: 'invalid_turn' };
  if (input.toolCategory !== undefined && !TOOLS.has(input.toolCategory)) return { ok: false, error: 'invalid_tool_category' };
  return { ok: true, value: input };
}
