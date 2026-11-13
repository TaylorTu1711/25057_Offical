import { useEffect, useState } from 'react';

const TOUCH_MQ = '(hover: none), (pointer: coarse)';

/** True trên điện thoại / cảm ứng — ưu tiên scroll trang hơn pan biểu đồ. */
export function isTouchUi() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia(TOUCH_MQ).matches;
}

export default function useTouchUi() {
  const [touchUi, setTouchUi] = useState(isTouchUi);

  useEffect(() => {
    const mq = window.matchMedia(TOUCH_MQ);
    const apply = () => setTouchUi(mq.matches);
    apply();
    mq.addEventListener?.('change', apply);
    return () => mq.removeEventListener?.('change', apply);
  }, []);

  return touchUi;
}
