"use client";

import { useEffect, useRef, useState } from "react";

export const THEMES = [
  { id: "cream", label: "奶油", color: "#f3e6c9" },
  { id: "pink", label: "粉色", color: "#f5d6e2" },
  { id: "lavender", label: "淡紫", color: "#e4dcf5" },
  { id: "matcha", label: "抹茶绿", color: "#dce8ce" },
  { id: "blue", label: "淡蓝", color: "#d6e9f7" },
] as const;

type Theme = "default" | typeof THEMES[number]["id"];
export const HOME_BLOCKS = [
  { id: "goal", label: "目标概览", hint: "目标名称、预留金额和计算说明" },
  { id: "progress", label: "目标进度", hint: "目标金额、完成比例和进度条" },
  { id: "completion", label: "预计准备好", hint: "预计完成日期" },
  { id: "daily", label: "明天的基本开销", hint: "明天的生活开销" },
  { id: "spending", label: "当前最多可额外支出", hint: "安全范围内的可用金额" },
] as const;
export type HomeBlock = typeof HOME_BLOCKS[number]["id"];
export type BlockBackgrounds = Partial<Record<HomeBlock, string>>;
export const HELLO_KITTY_BACKGROUNDS: Record<HomeBlock, string> = {
  goal: "/themes/hello-kitty/goal.png",
  progress: "/themes/hello-kitty/progress.png",
  completion: "/themes/hello-kitty/completion.png",
  daily: "/themes/hello-kitty/daily.png",
  spending: "/themes/hello-kitty/spending.png",
};
type Appearance = { theme: Theme; background: string | null; blocks: BlockBackgrounds };
const DEFAULT: Appearance = { theme: "default", background: null, blocks: {} };
const KEY = "goalio:appearance:v1";
const MAX_BACKGROUND_LENGTH = 2_500_000;
const MAX_CARD_LENGTH = 600_000;

function validLocalImage(value: unknown, maxLength = MAX_BACKGROUND_LENGTH): value is string {
  return typeof value === "string" && value.length <= maxLength &&
    /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value);
}

function loadAppearance(): Appearance {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return DEFAULT;
    const { theme, background, blocks } = parsed as Record<string, unknown>;
    const savedBlocks: BlockBackgrounds = {};
    if (blocks && typeof blocks === "object" && !Array.isArray(blocks)) {
      for (const { id } of HOME_BLOCKS) {
        const source = (blocks as Record<string, unknown>)[id];
        if (validLocalImage(source, MAX_CARD_LENGTH) || source === HELLO_KITTY_BACKGROUNDS[id]) savedBlocks[id] = source;
      }
    }
    return {
      theme: THEMES.some(item => item.id === theme) ? theme as Theme : "default",
      background: validLocalImage(background) ? background : null,
      blocks: savedBlocks,
    };
  } catch { return DEFAULT; }
}

// FileReader and canvas stay on this device; this path never makes a network request.
async function prepareBackground(file: File, card = false): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
    throw new Error("请选择 JPG、PNG、WebP 或 GIF 图片。");
  }
  if (file.size > 20 * 1024 * 1024) throw new Error("图片过大，请选择 20 MB 以内的图片。");
  const source = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("图片读取失败，请重新选择。"));
    reader.onerror = () => reject(new Error("图片读取失败，请重新选择。"));
    reader.onabort = () => reject(new Error("图片读取已取消，请重新选择。"));
    reader.readAsDataURL(file);
  });
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("无法读取这张图片，请换一张试试。"));
    image.src = source;
  });
  if (!image.naturalWidth || !image.naturalHeight) throw new Error("图片尺寸无效，请换一张试试。");
  const scale = Math.min(1, (card ? 1200 : 1600) / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("浏览器暂时无法处理图片，请重试。");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  let background = canvas.toDataURL("image/jpeg", 0.82);
  if (card && background.length > MAX_CARD_LENGTH) {
    // Re-render from the source at a smaller size to keep five cards within local storage limits.
    canvas.width = Math.max(1, Math.round(canvas.width * .65));
    canvas.height = Math.max(1, Math.round(canvas.height * .65));
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    background = canvas.toDataURL("image/jpeg", 0.72);
  }
  if (!background.startsWith("data:image/jpeg;base64,") || background.length > (card ? MAX_CARD_LENGTH : MAX_BACKGROUND_LENGTH)) {
    throw new Error("图片处理后仍然过大，请选择更小的图片。");
  }
  return background;
}

export function usePersonalization() {
  const [appearance, setAppearance] = useState<Appearance>(DEFAULT);
  const current = useRef(appearance);
  const [error, setError] = useState("");
  const [processingTarget, setProcessingTarget] = useState<HomeBlock | "background" | null>(null);
  const request = useRef(0);

  useEffect(() => {
    current.current = loadAppearance();
    setAppearance(current.current);
    return () => { request.current += 1; };
  }, []);

  function save(next: Appearance, reset = false) {
    try {
      if (reset) localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, JSON.stringify(next));
      current.current = next;
      setAppearance(next);
      setError("");
    } catch {
      setError("设置未保存，请检查浏览器存储空间或隐私设置后重试。");
    }
  }

  async function selectBackground(file: File, block?: HomeBlock) {
    const id = ++request.current;
    setProcessingTarget(block ?? "background");
    setError("");
    try {
      const background = await prepareBackground(file, !!block);
      if (request.current === id) save(block
        ? { ...current.current, blocks: { ...current.current.blocks, [block]: background } }
        : { ...current.current, background });
    } catch (error) {
      if (request.current === id) setError(error instanceof Error ? error.message : "图片处理失败，请重试。");
    } finally {
      if (request.current === id) setProcessingTarget(null);
    }
  }

  return {
    ...appearance, error, processing: processingTarget !== null, processingTarget, selectBackground,
    selectBlockBackground: (block: HomeBlock, file: File) => selectBackground(file, block),
    removeBlockBackground: (block: HomeBlock) => {
      request.current += 1;
      setProcessingTarget(null);
      const blocks = { ...current.current.blocks };
      delete blocks[block];
      save({ ...current.current, blocks });
    },
    useHelloKitty: () => {
      request.current += 1;
      setProcessingTarget(null);
      save({ theme: "pink", background: null, blocks: { ...HELLO_KITTY_BACKGROUNDS } });
    },
    selectTheme: (theme: Theme) => save({ ...current.current, theme }),
    removeBackground: () => {
      request.current += 1;
      setProcessingTarget(null);
      save({ ...current.current, background: null });
    },
    reset: () => {
      request.current += 1;
      setProcessingTarget(null);
      save(DEFAULT, true);
    },
  };
}

export type Personalization = ReturnType<typeof usePersonalization>;
