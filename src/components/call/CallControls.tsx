interface CallControlsProps {
  micOn: boolean;
  cameraOn: boolean;
  speakerOn: boolean;
  captionsOn: boolean;
  isVideo: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onToggleSpeaker: () => void;
  onToggleCaptions: () => void;
  onBackground: () => void;
  onReaction: () => void;
  onShare: () => void;
  onMinimize: () => void;
  onHangUp: () => void;
}

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

function ControlButton({ label, pressed, danger, onClick, children, testId }: {
  label: string;
  pressed?: boolean;
  danger?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  testId?: string;
}) {
  return (
    <button
      type="button"
      className={`call-control${danger ? ' is-danger' : ''}${pressed === false ? ' is-off' : ''}`}
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
      data-testid={testId}
    >
      {children}
      <span className="call-control__label">{label}</span>
    </button>
  );
}

export function CallControls(props: CallControlsProps) {
  return (
    <div className="call-controls" role="toolbar" aria-label="通話控制">
      <ControlButton label="麥克風" pressed={props.micOn} onClick={props.onToggleMic} testId="call-mic">
        {props.micOn
          ? <svg viewBox="0 0 24 24" {...stroke} aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>
          : <svg viewBox="0 0 24 24" {...stroke} aria-hidden="true"><path d="M3 3l18 18"/><path d="M9 5a3 3 0 0 1 6 0v4M9 9v2a3 3 0 0 0 5 2.2M5 11a7 7 0 0 0 11 5.5M12 18v3"/></svg>}
      </ControlButton>
      {props.isVideo && (
        <ControlButton label="鏡頭" pressed={props.cameraOn} onClick={props.onToggleCamera} testId="call-camera">
          {props.cameraOn
            ? <svg viewBox="0 0 24 24" {...stroke} aria-hidden="true"><rect x="3" y="6" width="12" height="12" rx="2"/><path d="m15 12 6-4v8z"/></svg>
            : <svg viewBox="0 0 24 24" {...stroke} aria-hidden="true"><path d="M3 3l18 18"/><path d="M15 9.3V8a2 2 0 0 0-2-2H7.6M4.3 6.5A2 2 0 0 0 3 8.4V16a2 2 0 0 0 2 2h8a2 2 0 0 0 1.7-.9M15 12.5 21 8v8l-2.4-1.4"/></svg>}
        </ControlButton>
      )}
      <ControlButton label="揚聲器" pressed={props.speakerOn} onClick={props.onToggleSpeaker} testId="call-speaker">
        {props.speakerOn
          ? <svg viewBox="0 0 24 24" {...stroke} aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12"/></svg>
          : <svg viewBox="0 0 24 24" {...stroke} aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="m16 9 5 6M21 9l-5 6"/></svg>}
      </ControlButton>
      <ControlButton label="字幕" pressed={props.captionsOn} onClick={props.onToggleCaptions} testId="call-captions">
        <svg viewBox="0 0 24 24" {...stroke} aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 12h4M7 15.5h7M13.5 12H17"/></svg>
      </ControlButton>
      <ControlButton label="背景" onClick={props.onBackground} testId="call-background">
        <svg viewBox="0 0 24 24" {...stroke} aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m4 18 5.5-5 4 3.6L17 13l3 3"/></svg>
      </ControlButton>
      <ControlButton label="心情回應" onClick={props.onReaction} testId="call-reaction">
        <svg viewBox="0 0 24 24" {...stroke} aria-hidden="true"><path d="M12 20.5s-7-4.2-9-8.4C1.7 9 3.4 6 6.4 6c1.9 0 3 .9 3.8 2h3.6c.8-1.1 1.9-2 3.8-2 3 0 4.7 3 3.4 6.1-2 4.2-9 8.4-9 8.4Z"/></svg>
      </ControlButton>
      <ControlButton label="分享內容" onClick={props.onShare} testId="call-share">
        <svg viewBox="0 0 24 24" {...stroke} aria-hidden="true"><rect x="3" y="5" width="18" height="12" rx="2"/><path d="M12 21v-4M8 21h8"/><path d="m12 8-2.5 2.5M12 8l2.5 2.5M12 8v6" transform="translate(0 -.5)"/></svg>
      </ControlButton>
      <ControlButton label="縮小通話" onClick={props.onMinimize} testId="call-minimize">
        <svg viewBox="0 0 24 24" {...stroke} aria-hidden="true"><path d="M4 14h6v6M20 10h-6V4"/><path d="m10 14-6 6M14 10l6-6"/></svg>
      </ControlButton>
      <ControlButton label="掛斷" danger onClick={props.onHangUp} testId="call-hangup">
        <svg viewBox="0 0 24 24" {...stroke} aria-hidden="true"><path d="M4.5 13.5C8.5 9.5 15.5 9.5 19.5 13.5l1 1a2 2 0 0 1 0 2.8l-1.4 1.4-3.8-2.2v-2.6a10.5 10.5 0 0 0-6.6 0v2.6l-3.8 2.2L3.5 17.3a2 2 0 0 1 0-2.8z"/></svg>
      </ControlButton>
    </div>
  );
}
