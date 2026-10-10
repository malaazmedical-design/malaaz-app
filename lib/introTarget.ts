// مكان لوجو الهيدر في الشاشة الرئيسية — الافتتاحية بتقراه عشان اللوجو يطلع لمكانه بدل ما يختفي بس.
export type IntroTarget = { x: number; y: number; w: number; h: number };
let target: IntroTarget | null = null;
export const setIntroTarget = (t: IntroTarget | null) => { target = t; };
export const getIntroTarget = () => target;

// الصورة بتتعرض بـ contain جوه الصندوق، فمكانها الفعلي أصغر من الصندوق لو النسبة مختلفة
export function containRect(box: IntroTarget, aspect: number): IntroTarget {
  let w = box.w, h = box.w / aspect;
  if (h > box.h) { h = box.h; w = box.h * aspect; }
  return { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, w, h };
}
