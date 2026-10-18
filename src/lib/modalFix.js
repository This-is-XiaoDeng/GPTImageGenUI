// 弹窗几何兜底：个别浏览器内核会把 position:fixed 处理成文档流/相对 body 的绝对定位，
// 导致弹窗没有遮罩、卡片掉到页面底部。打开弹窗后实测一次，
// 若没有覆盖视口，就用绝对定位 + flex 居中（兼容性最好的组合）手动摆正。
export function fixModalGeometry(el) {
  if (!el) return false;

  const coversViewport = () => {
    const rect = el.getBoundingClientRect();
    return (
      rect.left <= 2 &&
      rect.top <= 2 &&
      rect.width >= window.innerWidth - 2 &&
      rect.height >= window.innerHeight - 2
    );
  };

  const apply = () => {
    if (!el.isConnected) return false;
    if (coversViewport()) return true;
    el.style.position = "absolute";
    el.style.top = `${window.scrollY}px`;
    el.style.left = `${window.scrollX}px`;
    el.style.width = `${window.innerWidth}px`;
    el.style.height = `${window.innerHeight}px`;
    el.style.margin = "0";
    el.style.display = "flex";
    el.style.alignItems = "center";
    el.style.justifyContent = "center";
    el.style.overflow = "auto";
    return coversViewport();
  };

  // 等一帧让布局稳定后再测
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve(apply()));
  });
}

// 损坏模式下跟随滚动/缩放，保持弹窗贴住当前视口；返回清理函数
export function trackModalGeometry(el) {
  const reapply = () => {
    if (!el.isConnected) return;
    if (el.style.position !== "absolute") return; // 正常浏览器（fixed 生效），不干预
    el.style.top = `${window.scrollY}px`;
    el.style.left = `${window.scrollX}px`;
    el.style.width = `${window.innerWidth}px`;
    el.style.height = `${window.innerHeight}px`;
  };
  window.addEventListener("resize", reapply);
  window.addEventListener("scroll", reapply, { passive: true });
  return () => {
    window.removeEventListener("resize", reapply);
    window.removeEventListener("scroll", reapply);
  };
}
