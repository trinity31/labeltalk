import { CSSProperties, ReactNode } from 'react';
import { colors } from '../lib/theme';

// 선택형 칩 (알레르기/식이제한)
export function Chip({
  label,
  selected,
  onPress,
  tone = 'green',
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  tone?: 'green' | 'amber';
}) {
  const on =
    tone === 'amber'
      ? { bg: colors.warningTint, fg: colors.warningText, bd: colors.warningChipBorder }
      : { bg: colors.primaryTint, fg: colors.primary, bd: colors.primaryChipBorder };
  return (
    <button
      onClick={onPress}
      style={{
        padding: '9px 14px',
        borderRadius: 999,
        fontSize: 14,
        border: '1px solid',
        fontWeight: selected ? 600 : 500,
        background: selected ? on.bg : colors.fill,
        color: selected ? on.fg : colors.grey600,
        borderColor: selected ? on.bd : 'transparent',
      }}
    >
      {label}
    </button>
  );
}

export function PrimaryButton({
  title,
  onPress,
  disabled,
  style,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  style?: CSSProperties;
}) {
  return (
    <button
      onClick={onPress}
      disabled={disabled}
      style={{
        width: '100%',
        background: colors.primary,
        color: colors.white,
        fontSize: 16,
        fontWeight: 700,
        padding: 16,
        border: 'none',
        borderRadius: 14,
        opacity: disabled ? 0.5 : 1,
        ...style,
      }}
    >
      {title}
    </button>
  );
}

export function OutlineButton({
  title,
  onPress,
  style,
}: {
  title: string;
  onPress: () => void;
  style?: CSSProperties;
}) {
  return (
    <button
      onClick={onPress}
      style={{
        width: '100%',
        background: colors.white,
        color: colors.primary,
        border: `1px solid #CFE6DA`,
        fontSize: 15,
        fontWeight: 700,
        padding: 14,
        borderRadius: 14,
        ...style,
      }}
    >
      {title}
    </button>
  );
}

export function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      style={{
        width: 48,
        height: 29,
        borderRadius: 999,
        border: 'none',
        padding: 0,
        position: 'relative',
        flexShrink: 0,
        background: value ? colors.primary : '#D2D7DB',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 3,
          left: value ? 22 : 3,
          width: 23,
          height: 23,
          borderRadius: '50%',
          background: colors.white,
          boxShadow: '0 1px 3px rgba(0,0,0,.25)',
          transition: 'left .15s',
        }}
      />
    </button>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 5, background: colors.fillAlt, borderRadius: 13, padding: 4 }}>
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <button
            key={opt.id}
            onClick={() => onChange(opt.id)}
            style={{
              flex: 1,
              textAlign: 'center',
              padding: '10px 0',
              borderRadius: 10,
              border: 'none',
              fontSize: 13,
              fontWeight: active ? 700 : 500,
              color: active ? colors.primary : colors.grey500,
              background: active ? colors.white : 'transparent',
              boxShadow: active ? '0 1px 2px rgba(0,0,0,.08)' : 'none',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function SectionTitle({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div style={{ fontSize: 14, fontWeight: 700, color: colors.ink, ...style }}>{children}</div>;
}

export function Spinner() {
  return (
    <>
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          border: `3px solid ${colors.primaryTint}`,
          borderTopColor: colors.primary,
          animation: 'spin 0.8s linear infinite',
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </>
  );
}

// 모바일 프레임 컨테이너 (세로 꽉 채움)
export function Screen({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        minHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: colors.white,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
