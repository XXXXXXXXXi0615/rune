import { AppSwitch } from '@/components/ui/AppPrimitives';

interface IOSSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
}

export function IOSSwitch({ checked, onChange, disabled, label }: IOSSwitchProps) {
  return <AppSwitch checked={checked} onChange={onChange} disabled={disabled} label={label} />;
}
