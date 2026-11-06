import { Icon } from './Icon';
import { accent, type Visual } from '../lib/visuals';

/** 色付きの丸いアイコン (ウォレット・予算枠の見分け用) */
export function VIcon({ v, size = 16 }: { v: Visual; size?: number }) {
  return (
    <span className="v-icon" style={accent(v)} aria-hidden>
      <Icon name={v.icon} size={size} />
    </span>
  );
}
