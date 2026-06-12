interface HeaderProps {
  eyebrow: string;
  title: string;
}

export function Header({ eyebrow, title }: HeaderProps) {
  return (
    <header>
      <div className="hdr-left">
        <div className="hdr-eyebrow">{eyebrow}</div>
        <h1 className="hdr-greeting">{title}</h1>
      </div>
    </header>
  );
}
