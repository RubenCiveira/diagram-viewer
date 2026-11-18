import type { ReactNode } from 'react';
import { StickyNote } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { DiagramElementType } from '../../../DiagramElementType';

export type NoteProps = {
  text: string;
  color?: 'yellow' | 'blue' | 'green' | 'pink';
};

const COLORS = {
  yellow: { bg: '#FEF9C3', border: '#FDE68A' },
  blue: { bg: '#DBEAFE', border: '#BFDBFE' },
  green: { bg: '#DCFCE7', border: '#BBF7D0' },
  pink: { bg: '#FCE7F3', border: '#FBCFE8' },
} as const;

export class NoteElement implements DiagramElementType<NoteProps> {
  kind = 'note';
  title = 'Nota';
  paletteIcon = (<StickyNote size={18} />);

  label({ name }: { name?: string; props: NoteProps }) {
    return name ?? 'Nota';
  }

  category() {
    return 'note' as const;
  }

  isBackground() {
    return true;
  }

  nodeSize() {
    return { width: 220, height: 140 };
  }

  renderShape(props: NoteProps): ReactNode {
    const palette = COLORS[props.color ?? 'yellow'] ?? COLORS.yellow;
    return (
      <div className="dv-note" style={{ background: palette.bg, borderColor: palette.border }}>
        <div className="dv-md">
          <ReactMarkdown>{props.text ?? ''}</ReactMarkdown>
        </div>
      </div>
    );
  }

  /** Las notas ya muestran todo su contenido: no tienen ficha. */
  detail() {
    return null;
  }
}
