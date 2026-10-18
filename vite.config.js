import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// base 使用相对路径，部署到 GitHub Pages 子路径（/GPTImageGenUI/）也能正常加载
export default defineConfig({
  plugins: [vue()],
  base: "./",
  build: {
    outDir: "dist",
  },
});
