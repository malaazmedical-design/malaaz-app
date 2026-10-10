// مكان لوجو الهيدر في الشاشة الرئيسية — الافتتاحية بتقيسه وقت الخروج عشان اللوجو يطير لمكانه بدل ما يختفي بس.
export type IntroTarget = { x: number; y: number; w: number; h: number };
type Measurer = (cb: (t: IntroTarget | null) => void) => void;

let measurer: Measurer | null = null;
export const setIntroMeasurer = (m: Measurer | null) => { measurer = m; };
export const unsetIntroMeasurer = (m: Measurer) => { if (measurer === m) measurer = null; };
export const measureIntroTarget = (cb: (t: IntroTarget | null) => void) => { if (measurer) measurer(cb); else cb(null); };

// الصورة بتتعرض بـ contain جوه الصندوق، فمكانها الفعلي أصغر من الصندوق لو النسبة مختلفة
export function containRect(box: IntroTarget, aspect: number): IntroTarget {
  let w = box.w, h = box.w / aspect;
  if (h > box.h) { h = box.h; w = box.h * aspect; }
  return { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, w, h };
}
