import { PatternMirrorScreen } from '../components/pattern-mirror/PatternMirrorScreen';
import { mirrorData } from '../lib/mirrorData';

// The mirror data is currently a typed mock — the design's contract documented
// as a TypeScript shape. Swap mirrorData for a real adapter once the backend
// exposes per-manager aggregates (flag-category counts with period deltas,
// pipeline composition by represented vs majority background, etc.).
export default function PatternMirror() {
  return <PatternMirrorScreen data={mirrorData} />;
}
