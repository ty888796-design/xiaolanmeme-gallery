"use client";

import { ChangeEvent, DragEvent, useEffect, useRef, useState } from "react";

type Category = "全部" | "陪伴" | "开心" | "晚安";
type StickerCategory = Exclude<Category, "全部">;
type CardTone = "peach" | "mint" | "blue" | "lilac" | "sunny";

type StickerBase = {
  id: string;
  name: string;
  dataUrl: string;
  type: string;
  category: StickerCategory;
  tone: CardTone;
};

type SavedSticker = StickerBase & {
  createdAt: number;
};

type PublicSticker = StickerBase & {
  caption: string;
  position: string;
};

type PublicStickerOverride = PublicSticker & { hidden?: boolean };

const categories: Category[] = ["全部", "陪伴", "开心", "晚安"];
const stickerCategories: StickerCategory[] = ["陪伴", "开心", "晚安"];
const cardTones: { value: CardTone; label: string; color: string }[] = [
  { value: "peach", label: "蜜桃粉", color: "#fce0cd" },
  { value: "mint", label: "薄荷绿", color: "#cfebda" },
  { value: "blue", label: "晴空蓝", color: "#cfe2ff" },
  { value: "lilac", label: "晚安紫", color: "#ded4f2" },
  { value: "sunny", label: "奶油黄", color: "#fff0b9" },
];

const defaultPublicStickers: PublicSticker[] = [
  {
    id: "always-here",
    name: "一直都在",
    dataUrl: "xiaolanjun-banner.jpeg",
    type: "image/jpeg",
    category: "陪伴",
    caption: "贴贴～",
    position: "74% 34%",
    tone: "peach",
  },
  {
    id: "good-day",
    name: "今天也很棒",
    dataUrl: "xiaolanjun-banner.jpeg",
    type: "image/jpeg",
    category: "开心",
    caption: "好耶！",
    position: "70% 58%",
    tone: "mint",
  },
  {
    id: "rainbow-hug",
    name: "彩虹抱抱",
    dataUrl: "xiaolanjun-banner.jpeg",
    type: "image/jpeg",
    category: "陪伴",
    caption: "给你抱抱",
    position: "65% 65%",
    tone: "blue",
  },
  {
    id: "sweet-dream",
    name: "晚安好梦",
    dataUrl: "xiaolanjun-banner.jpeg",
    type: "image/jpeg",
    category: "晚安",
    caption: "晚安啦☾",
    position: "87% 28%",
    tone: "lilac",
  },
];

const DB_NAME = "xiaolan-sticker-studio";
const STORE_NAME = "stickers";
const PUBLIC_STORE_NAME = "public-sticker-overrides";

function openStickerDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(PUBLIC_STORE_NAME)) {
        db.createObjectStore(PUBLIC_STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readSavedStickers(): Promise<SavedSticker[]> {
  const db = await openStickerDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => {
      const saved = (request.result as SavedSticker[]).map((sticker) => ({
        ...sticker,
        // Records created by the first version did not have editable metadata.
        category: stickerCategories.includes(sticker.category)
          ? sticker.category
          : "陪伴",
        tone: cardTones.some((tone) => tone.value === sticker.tone)
          ? sticker.tone
          : "sunny",
      }));
      resolve(saved.sort((a, b) => b.createdAt - a.createdAt));
    };
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
  });
}

async function storeSticker(sticker: SavedSticker) {
  const db = await openStickerDb();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(sticker);
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => reject(transaction.error);
  });
}

async function readPublicStickers(): Promise<PublicSticker[]> {
  const db = await openStickerDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PUBLIC_STORE_NAME, "readonly");
    const request = transaction.objectStore(PUBLIC_STORE_NAME).getAll();
    request.onsuccess = () => {
      const overrides = new Map(
        (request.result as PublicStickerOverride[]).map((override) => [
          override.id,
          override,
        ]),
      );
      resolve(
        defaultPublicStickers.flatMap((sticker) => {
          const override = overrides.get(sticker.id);
          if (override?.hidden) return [];
          return [{ ...sticker, ...override }];
        }),
      );
    };
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
  });
}

async function storePublicStickerOverride(override: PublicStickerOverride) {
  const db = await openStickerDb();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(PUBLIC_STORE_NAME, "readwrite");
    transaction.objectStore(PUBLIC_STORE_NAME).put(override);
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => reject(transaction.error);
  });
}

async function clearPublicStickerOverrides() {
  const db = await openStickerDb();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(PUBLIC_STORE_NAME, "readwrite");
    transaction.objectStore(PUBLIC_STORE_NAME).clear();
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => reject(transaction.error);
  });
}

async function removeStoredSticker(id: string) {
  const db = await openStickerDb();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(id);
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => reject(transaction.error);
  });
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function downloadFile(url: string, filename: string) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

function safeFilename(name: string) {
  return name.replace(/[\\/:*?"<>|]/g, "-").trim() || "小蓝君表情";
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}

function loadStickerImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("无法读取公开表情素材"));
    image.src = source;
  });
}

async function createPublicStickerBlob(sticker: PublicSticker): Promise<Blob> {
  const image = await loadStickerImage(sticker.dataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = 900;
  canvas.height = 900;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("当前浏览器不支持生成表情图片");

  const toneColor =
    cardTones.find((tone) => tone.value === sticker.tone)?.color ?? "#fff0b9";
  context.fillStyle = toneColor;
  roundedRect(context, 0, 0, 900, 900, 70);
  context.fill();

  context.fillStyle = "rgba(255,255,255,.94)";
  roundedRect(context, 38, 38, 824, 694, 48);
  context.fill();

  const targetX = 54;
  const targetY = 54;
  const targetWidth = 792;
  const targetHeight = 662;
  const targetRatio = targetWidth / targetHeight;
  const sourceRatio = image.naturalWidth / image.naturalHeight;
  let sourceX = 0;
  let sourceY = 0;
  let sourceWidth = image.naturalWidth;
  let sourceHeight = image.naturalHeight;
  const [positionX, positionY] = sticker.position
    .split(" ")
    .map((value) => Number.parseFloat(value) / 100);

  if (sourceRatio > targetRatio) {
    sourceWidth = image.naturalHeight * targetRatio;
    sourceX = (image.naturalWidth - sourceWidth) * (Number.isFinite(positionX) ? positionX : 0.5);
  } else {
    sourceHeight = image.naturalWidth / targetRatio;
    sourceY = (image.naturalHeight - sourceHeight) * (Number.isFinite(positionY) ? positionY : 0.5);
  }

  context.save();
  roundedRect(context, targetX, targetY, targetWidth, targetHeight, 36);
  context.clip();
  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    targetX,
    targetY,
    targetWidth,
    targetHeight,
  );
  context.restore();

  context.font = '700 38px "Noto Sans SC", "PingFang SC", sans-serif';
  const bubbleWidth = Math.min(context.measureText(sticker.caption).width + 64, 360);
  const bubbleX = 818 - bubbleWidth;
  const bubbleY = 634;
  context.fillStyle = "white";
  roundedRect(context, bubbleX, bubbleY, bubbleWidth, 66, 24);
  context.fill();
  context.lineWidth = 4;
  context.strokeStyle = "#16306c";
  context.stroke();
  context.fillStyle = "#16306c";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(sticker.caption, bubbleX + bubbleWidth / 2, bubbleY + 33);

  context.textAlign = "left";
  context.fillStyle = "#526487";
  context.font = '800 20px "Noto Sans SC", "PingFang SC", sans-serif';
  context.fillText(`${sticker.category} · XIAOLAN STICKER CLUB`, 64, 786);
  context.fillStyle = "#16306c";
  context.font = '900 43px "Noto Sans SC", "PingFang SC", sans-serif';
  context.fillText(sticker.name, 64, 844);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("生成表情图片失败"))),
      "image/png",
      0.95,
    );
  });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  downloadFile(url, filename);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function StickerFields({
  sticker,
  onChange,
  nameId,
}: {
  sticker: StickerBase;
  onChange: (changes: Partial<StickerBase>) => void;
  nameId: string;
}) {
  return (
    <div className="editor-fields">
      <label htmlFor={nameId}>
        <span>表情名字</span>
        <input
          id={nameId}
          value={sticker.name}
          maxLength={24}
          placeholder="例如：给你抱抱"
          onChange={(event) => onChange({ name: event.target.value })}
        />
        <small>{sticker.name.length}/24</small>
      </label>

      <label>
        <span>心情类别</span>
        <select
          value={sticker.category}
          onChange={(event) =>
            onChange({ category: event.target.value as StickerCategory })
          }
        >
          {stickerCategories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="tone-fieldset">
        <legend>背景卡片颜色</legend>
        <div className="tone-picker">
          {cardTones.map((tone) => (
            <label
              className={sticker.tone === tone.value ? "selected" : ""}
              key={tone.value}
              title={tone.label}
            >
              <input
                type="radio"
                name={`tone-${sticker.id}`}
                checked={sticker.tone === tone.value}
                onChange={() => onChange({ tone: tone.value })}
              />
              <i style={{ background: tone.color }} aria-hidden="true"></i>
              <span>{tone.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}

export default function Home() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const publicReplaceInputRef = useRef<HTMLInputElement>(null);
  const [activeCategory, setActiveCategory] = useState<Category>("全部");
  const [savedStickers, setSavedStickers] = useState<SavedSticker[]>([]);
  const [publicStickers, setPublicStickers] = useState<PublicSticker[]>(
    defaultPublicStickers,
  );
  const [isDragging, setIsDragging] = useState(false);
  const [toast, setToast] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPackingPublic, setIsPackingPublic] = useState(false);
  const [isPackingPersonal, setIsPackingPersonal] = useState(false);
  const [celebrate, setCelebrate] = useState(0);
  const [pendingStickers, setPendingStickers] = useState<SavedSticker[]>([]);
  const [editingSticker, setEditingSticker] = useState<SavedSticker | null>(null);
  const [editingPublicSticker, setEditingPublicSticker] =
    useState<PublicSticker | null>(null);

  useEffect(() => {
    Promise.all([readSavedStickers(), readPublicStickers()])
      .then(([personal, publicItems]) => {
        setSavedStickers(personal);
        setPublicStickers(publicItems);
      })
      .catch(() => setToast("暂时无法读取本地收藏"));
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const modalOpen =
      pendingStickers.length > 0 ||
      editingSticker !== null ||
      editingPublicSticker !== null;
    if (!modalOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSaving) {
        setPendingStickers([]);
        setEditingSticker(null);
        setEditingPublicSticker(null);
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [pendingStickers.length, editingSticker, editingPublicSticker, isSaving]);

  const filteredPublicStickers = publicStickers.filter(
    (sticker) =>
      activeCategory === "全部" || sticker.category === activeCategory,
  );
  const filteredSavedStickers = savedStickers.filter(
    (sticker) =>
      activeCategory === "全部" || sticker.category === activeCategory,
  );

  const categoryCount = (category: Category) => {
    const publicCount = publicStickers.filter(
      (sticker) => category === "全部" || sticker.category === category,
    ).length;
    const savedCount = savedStickers.filter(
      (sticker) => category === "全部" || sticker.category === category,
    ).length;
    return publicCount + savedCount;
  };

  const downloadPublicSticker = async (sticker: PublicSticker) => {
    try {
      setToast(`正在制作“${sticker.name}”…`);
      const blob = await createPublicStickerBlob(sticker);
      downloadBlob(blob, `${safeFilename(sticker.name)}.png`);
      setToast(`“${sticker.name}”已保存到电脑 ↓`);
    } catch {
      setToast("生成下载图片失败，请换个浏览器试试");
    }
  };

  const downloadPublicPack = async () => {
    if (!publicStickers.length) {
      setToast("公开表情馆还没有内容，可以先恢复默认示例");
      return;
    }
    if (isPackingPublic) return;
    setIsPackingPublic(true);
    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      for (const [index, sticker] of publicStickers.entries()) {
        const blob = await createPublicStickerBlob(sticker);
        zip.file(
          `${String(index + 1).padStart(2, "0")}-${safeFilename(sticker.name)}.png`,
          blob,
        );
      }
      zip.file(
        "使用说明.txt",
        "小蓝君公开表情包\n\n解压后即可将 PNG 图片用于聊天、收藏或个人分享。\n请勿擅自用于商业销售、二次打包收费或冒充原创。\n\n长时间陪伴，陪你走过每一天。",
      );
      downloadBlob(
        await zip.generateAsync({ type: "blob" }),
        "小蓝君公开表情包.zip",
      );
      setToast("公开表情包已打包下载 🎈");
    } catch {
      setToast("表情包打包失败，可以先单张下载");
    } finally {
      setIsPackingPublic(false);
    }
  };

  const exportPersonalPack = async () => {
    if (!savedStickers.length) {
      setToast("陪伴袋还是空的，先上传几张表情吧");
      return;
    }
    if (isPackingPersonal) return;
    setIsPackingPersonal(true);
    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      for (const [index, sticker] of savedStickers.entries()) {
        const response = await fetch(sticker.dataUrl);
        const extension = sticker.type.split("/")[1]?.replace("jpeg", "jpg") || "png";
        zip.file(
          `${String(index + 1).padStart(2, "0")}-${safeFilename(sticker.name)}.${extension}`,
          await response.blob(),
        );
      }
      zip.file(
        "表情资料.json",
        JSON.stringify(
          savedStickers.map(({ id, name, category, tone, type, createdAt }) => ({
            id,
            name,
            category,
            tone,
            type,
            createdAt,
          })),
          null,
          2,
        ),
      );
      downloadBlob(
        await zip.generateAsync({ type: "blob" }),
        "我的小蓝君表情包.zip",
      );
      setToast("个人收藏已导出，现在可以发给朋友了 ♡");
    } catch {
      setToast("导出失败，请稍后再试");
    } finally {
      setIsPackingPersonal(false);
    }
  };

  const handleFiles = async (files: FileList | File[]) => {
    const imageFiles = Array.from(files).filter((file) =>
      ["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type),
    );

    if (!imageFiles.length) {
      setToast("请选择 PNG、JPG、WebP 或 GIF 图片");
      return;
    }

    if (savedStickers.length + imageFiles.length > 12) {
      setToast("本地收藏最多放 12 张表情包哦");
      return;
    }

    if (imageFiles.some((file) => file.size > 6 * 1024 * 1024)) {
      setToast("单张图片请不要超过 6MB");
      return;
    }

    setIsUploading(true);
    try {
      const additions: SavedSticker[] = [];
      for (const file of imageFiles) {
        const sticker: SavedSticker = {
          id: `${Date.now()}-${crypto.randomUUID()}`,
          name: file.name.replace(/\.[^/.]+$/, "") || "小蓝君表情",
          dataUrl: await fileToDataUrl(file),
          type: file.type,
          createdAt: Date.now(),
          category: "陪伴",
          tone: "sunny",
        };
        additions.push(sticker);
      }
      setPendingStickers(additions);
    } catch {
      setToast("读取图片失败，可以减小图片后再试试");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const updatePendingSticker = (
    id: string,
    changes: Partial<SavedSticker>,
  ) => {
    setPendingStickers((current) =>
      current.map((sticker) =>
        sticker.id === id ? { ...sticker, ...changes } : sticker,
      ),
    );
  };

  const confirmPendingStickers = async () => {
    if (pendingStickers.some((sticker) => !sticker.name.trim())) {
      setToast("请给每张表情取个名字");
      return;
    }

    setIsSaving(true);
    try {
      const additions = pendingStickers.map((sticker) => ({
        ...sticker,
        name: sticker.name.trim(),
      }));
      for (const sticker of additions) await storeSticker(sticker);
      setSavedStickers((current) => [...additions, ...current]);
      setPendingStickers([]);
      setActiveCategory("全部");
      setCelebrate((value) => value + 1);
      setToast(`收藏成功！${additions.length} 张小蓝君已入住 ✨`);
      window.setTimeout(() => {
        document
          .querySelector("#collection")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 250);
    } catch {
      setToast("保存失败，请稍后再试");
    } finally {
      setIsSaving(false);
    }
  };

  const saveStickerEdits = async () => {
    if (!editingSticker) return;
    if (!editingSticker.name.trim()) {
      setToast("表情名字不能为空");
      return;
    }

    setIsSaving(true);
    try {
      const updated = { ...editingSticker, name: editingSticker.name.trim() };
      await storeSticker(updated);
      setSavedStickers((current) =>
        current.map((sticker) =>
          sticker.id === updated.id ? updated : sticker,
        ),
      );
      setEditingSticker(null);
      setToast("编辑已保存 ✦");
    } catch {
      setToast("编辑保存失败，请稍后再试");
    } finally {
      setIsSaving(false);
    }
  };

  const replaceStickerImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !editingSticker) return;
    if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type)) {
      setToast("请选择 PNG、JPG、WebP 或 GIF 图片");
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      setToast("替换图片请不要超过 6MB");
      return;
    }
    try {
      setEditingSticker({
        ...editingSticker,
        dataUrl: await fileToDataUrl(file),
        type: file.type,
      });
      setToast("新图片已加入预览，记得保存");
    } catch {
      setToast("无法读取这张图片");
    } finally {
      event.target.value = "";
    }
  };

  const savePublicStickerEdits = async () => {
    if (!editingPublicSticker) return;
    if (!editingPublicSticker.name.trim()) {
      setToast("表情名字不能为空");
      return;
    }

    setIsSaving(true);
    try {
      const updated: PublicSticker = {
        ...editingPublicSticker,
        name: editingPublicSticker.name.trim(),
      };
      await storePublicStickerOverride(updated);
      setPublicStickers((current) =>
        current.map((sticker) =>
          sticker.id === updated.id ? updated : sticker,
        ),
      );
      setEditingPublicSticker(null);
      setToast("公开示例已更新 ✦");
    } catch {
      setToast("示例编辑保存失败，请稍后再试");
    } finally {
      setIsSaving(false);
    }
  };

  const replacePublicStickerImage = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file || !editingPublicSticker) return;
    if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type)) {
      setToast("请选择 PNG、JPG、WebP 或 GIF 图片");
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      setToast("替换图片请不要超过 6MB");
      return;
    }
    try {
      setEditingPublicSticker({
        ...editingPublicSticker,
        dataUrl: await fileToDataUrl(file),
        type: file.type,
        position: "50% 50%",
      });
      setToast("新图片已加入公开示例预览，记得保存");
    } catch {
      setToast("无法读取这张图片");
    } finally {
      event.target.value = "";
    }
  };

  const deletePublicSticker = async (sticker: PublicSticker) => {
    if (
      !window.confirm(
        `确定要从公开表情馆删除“${sticker.name}”吗？之后可通过“恢复默认示例”找回。`,
      )
    ) {
      return;
    }
    try {
      await storePublicStickerOverride({ ...sticker, hidden: true });
      setPublicStickers((current) =>
        current.filter((item) => item.id !== sticker.id),
      );
      if (editingPublicSticker?.id === sticker.id) {
        setEditingPublicSticker(null);
      }
      setToast("已从公开表情馆移除");
    } catch {
      setToast("删除失败，请稍后再试");
    }
  };

  const restoreDefaultPublicStickers = async () => {
    if (
      !window.confirm(
        "恢复默认示例会撤销对 4 张公开表情的替换、改名、换色和删除记录。确定继续吗？",
      )
    ) {
      return;
    }
    try {
      await clearPublicStickerOverrides();
      setPublicStickers(defaultPublicStickers.map((sticker) => ({ ...sticker })));
      setActiveCategory("全部");
      setToast("默认示例已全部恢复 ↻");
    } catch {
      setToast("恢复失败，请稍后再试");
    }
  };

  const handleInput = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) void handleFiles(event.target.files);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    void handleFiles(event.dataTransfer.files);
  };

  const deleteSticker = async (id: string, name: string) => {
    if (!window.confirm(`确定要删除“${name}”吗？删除后无法恢复。`)) {
      return;
    }
    try {
      await removeStoredSticker(id);
      setSavedStickers((current) =>
        current.filter((sticker) => sticker.id !== id),
      );
      if (editingSticker?.id === id) setEditingSticker(null);
      setToast("已从这台设备移除");
    } catch {
      setToast("移除失败，请稍后再试");
    }
  };

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="回到首页">
          <span className="brand-mascot" aria-hidden="true">蓝</span>
          <span>
            <strong>小蓝君</strong>
            <small>STICKER CLUB</small>
          </span>
        </a>
        <nav aria-label="主要导航">
          <a href="#collection">表情馆</a>
          <a href="#upload">上传</a>
          <a href="#about">关于</a>
        </nav>
        <button
          className="header-cta"
          type="button"
          onClick={() =>
            document.querySelector("#upload")?.scrollIntoView({ behavior: "smooth" })
          }
        >
          <span aria-hidden="true">＋</span> 加入表情
        </button>
      </header>

      <section className="hero" id="top">
        <div className="hero-doodle doodle-star" aria-hidden="true">✦</div>
        <div className="hero-doodle doodle-heart" aria-hidden="true">♡</div>
        <div className="hero-copy">
          <div className="eyebrow"><span></span> 每一份心情，都值得被抱抱</div>
          <h1>
            把小蓝君<br />
            <em>带进每天</em>
          </h1>
          <p className="hero-lead">
            收藏、预览和下载你的小蓝君系列表情包。<br />
            让一句轻轻的回应，变成长久的陪伴。
          </p>
          <div className="hero-actions">
            <button
              className="primary-button"
              type="button"
              onClick={() => fileInputRef.current?.click()}
            >
              <span aria-hidden="true">↑</span> 上传我的表情包
            </button>
            <a className="text-link" href="#collection">
              先逛逛表情馆 <span aria-hidden="true">↘</span>
            </a>
          </div>
          <div className="tiny-note">
            <span className="avatar-stack" aria-hidden="true">
              <i>☺</i><i>☁</i><i>♥</i>
            </span>
            <span><strong>今日陪伴值 100%</strong><br />小蓝君正在为你打气</span>
          </div>
        </div>

        <div className="hero-visual">
          <div className="tape tape-one" aria-hidden="true"></div>
          <div className="tape tape-two" aria-hidden="true"></div>
          <div className="hero-image-wrap">
            <img
              src="xiaolanjun-banner.jpeg"
              alt="小蓝君坐在暖色客厅中抱着彩虹气球，画面写着长时间陪伴"
            />
            <div className="image-stamp">
              <span>长时间陪伴</span>
              <small>THANK YOU FOR BEING WITH ME</small>
            </div>
          </div>
          <div className="hero-badge badge-top" aria-hidden="true">
            <span>☀</span>
            <b>暖暖的</b>
            <small>EVERY DAY</small>
          </div>
          <div className="hero-badge badge-bottom" aria-hidden="true">
            <b>❤</b> 正在陪伴中
          </div>
        </div>
      </section>

      <div className="marquee" aria-label="小蓝君陪伴宣言">
        <div>
          <span>♡ 今天也有好好陪伴</span>
          <span>✦ 分享快乐，收藏温柔</span>
          <span>☁ 每一刻都很重要</span>
          <span>♡ 今天也有好好陪伴</span>
        </div>
      </div>

      <section className="collection section-shell" id="collection">
        <div className="section-heading">
          <div>
            <span className="section-kicker">XIAOLAN&apos;S MOOD</span>
            <h2>小蓝君表情馆 <span aria-hidden="true">✦</span></h2>
            <p>挑一张今天的心情，发给你在意的人。</p>
          </div>
          <div className="category-tabs" aria-label="表情包分类">
            {categories.map((category) => (
              <button
                className={activeCategory === category ? "active" : ""}
                key={category}
                type="button"
                onClick={() => setActiveCategory(category)}
              >
                {category}<span>{categoryCount(category)}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="public-download-panel">
          <div className="pack-icon" aria-hidden="true">
            <span>ZIP</span>
            <b>↓</b>
          </div>
          <div>
            <small>PUBLIC DOWNLOAD</small>
            <h3>这一套，每个人都可以下载</h3>
            <p>单张点击下载，或一键打包为 ZIP，解压后就能保存到电脑和聊天软件中使用。</p>
          </div>
          <button
            type="button"
            disabled={isPackingPublic || publicStickers.length === 0}
            onClick={() => void downloadPublicPack()}
          >
            <span aria-hidden="true">↓</span>
            {isPackingPublic ? "正在打包…" : `下载整套 · ${publicStickers.length} 张`}
          </button>
        </div>

        <div className="public-manager-row">
          <span><b>管理提示</b> 下方“公开下载”示例也可以编辑、替换图片或删除。</span>
          <button type="button" onClick={() => void restoreDefaultPublicStickers()}>
            ↻ 恢复默认示例
          </button>
        </div>

        <div className="sticker-grid">
          {filteredPublicStickers.map((sticker, index) => (
            <article className={`sticker-card ${sticker.tone}`} key={sticker.id}>
              <div className="sticker-number">0{index + 1}</div>
              <div className="sticker-art">
                <img
                  src={sticker.dataUrl}
                  alt={`${sticker.name}小蓝君表情`}
                  style={{ objectPosition: sticker.position }}
                />
                <span className="public-badge">公开下载</span>
                <span className="speech-bubble">{sticker.caption}</span>
              </div>
              <div className="sticker-meta">
                <div>
                  <small>{sticker.category}</small>
                  <h3>{sticker.name}</h3>
                </div>
                <div className="card-actions public-card-actions">
                  <button
                    type="button"
                    title={`下载${sticker.name} PNG`}
                    aria-label={`下载${sticker.name}`}
                    onClick={() => void downloadPublicSticker(sticker)}
                  >
                    ↓
                  </button>
                  <button
                    className="edit-button"
                    type="button"
                    aria-label={`编辑公开示例${sticker.name}`}
                    onClick={() => setEditingPublicSticker({ ...sticker })}
                  >
                    ✎
                  </button>
                  <button
                    className="delete-button"
                    type="button"
                    aria-label={`删除公开示例${sticker.name}`}
                    onClick={() => void deletePublicSticker(sticker)}
                  >
                    ×
                  </button>
                </div>
              </div>
            </article>
          ))}

          {filteredSavedStickers.map((sticker, index) => (
              <article className={`sticker-card uploaded ${sticker.tone}`} key={sticker.id}>
                <div className="sticker-number">MY {index + 1}</div>
                <div className="sticker-art">
                  <img src={sticker.dataUrl} alt={sticker.name} />
                  <span className="saved-badge">可编辑 ♡</span>
                </div>
                <div className="sticker-meta">
                  <div>
                    <small>{sticker.category} · 本地收藏</small>
                    <h3>{sticker.name}</h3>
                  </div>
                  <div className="card-actions">
                    <button
                      type="button"
                      aria-label={`下载${sticker.name}`}
                      onClick={() =>
                        downloadFile(
                          sticker.dataUrl,
                          `${sticker.name}.${sticker.type.split("/")[1] || "png"}`,
                        )
                      }
                    >
                      ↓
                    </button>
                    <button
                      className="edit-button"
                      type="button"
                      aria-label={`编辑${sticker.name}`}
                      onClick={() => setEditingSticker({ ...sticker })}
                    >
                      ✎
                    </button>
                    <button
                      className="delete-button"
                      type="button"
                      aria-label={`移除${sticker.name}`}
                      onClick={() => void deleteSticker(sticker.id, sticker.name)}
                    >
                      ×
                    </button>
                  </div>
                </div>
              </article>
            ))}
        </div>

        {activeCategory !== "全部" &&
          filteredPublicStickers.length === 0 &&
          filteredSavedStickers.length === 0 && (
          <div className="empty-state">这个心情的小蓝君还在赶来的路上…</div>
        )}
      </section>

      <section className="upload-section section-shell" id="upload">
        <div className="upload-copy">
          <span className="section-kicker">MAKE IT YOURS</span>
          <h2>把你的小蓝君<br />收进陪伴袋</h2>
          <p>
            上传你喜欢的系列表情，即刻加入上方的收藏墙。
            图片只保存在当前浏览器中，清爽又安心。
          </p>
          <ul>
            <li><span>✓</span> 支持 PNG、JPG、WebP 和 GIF</li>
            <li><span>✓</span> 单张最大 6MB，最多收藏 12 张</li>
            <li><span>✓</span> 随时改名、分类、换色或替换图片</li>
          </ul>
          <button
            className="export-personal-button"
            type="button"
            disabled={isPackingPersonal || savedStickers.length === 0}
            onClick={() => void exportPersonalPack()}
          >
            <span aria-hidden="true">↓</span>
            {isPackingPersonal
              ? "正在导出…"
              : `导出我的收藏${savedStickers.length ? ` · ${savedStickers.length} 张` : ""}`}
          </button>
          <small className="local-privacy-note">个人上传不会自动公开，导出 ZIP 后可以自行发给朋友。</small>
        </div>

        <div
          className={`drop-zone ${isDragging ? "dragging" : ""}`}
          onDragEnter={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          <div className="drop-pattern" aria-hidden="true"></div>
          <div className="upload-icon" aria-hidden="true">
            <span>☁</span>
            <b>↑</b>
          </div>
          <h3>{isUploading ? "正在收进陪伴袋…" : "把表情包拖到这里"}</h3>
          <p>或者选择电脑里的图片</p>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? "收藏中…" : "选择图片"}
          </button>
          <small>不会自动上传到服务器</small>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            multiple
            onChange={handleInput}
            aria-label="选择表情包图片"
          />
          {celebrate > 0 && (
            <div className="celebration" key={celebrate} aria-hidden="true">
              <i>♥</i><i>✦</i><i>♡</i><i>★</i><i>✦</i>
            </div>
          )}
        </div>
      </section>

      <section className="promise section-shell" id="about">
        <div className="promise-card">
          <div className="promise-mark" aria-hidden="true">♡</div>
          <div>
            <span className="section-kicker">A LITTLE PROMISE</span>
            <h2>陪伴不用很大声，但会一直都在。</h2>
          </div>
          <p>
            小蓝君想把简单的安慰、可爱的应答和真诚的想念，
            变成一张张随时可以分享的表情。
          </p>
        </div>
      </section>

      <footer>
        <a className="brand footer-brand" href="#top">
          <span className="brand-mascot" aria-hidden="true">蓝</span>
          <span><strong>小蓝君</strong><small>STICKER CLUB</small></span>
        </a>
        <p>长时间陪伴，陪你走过每一天。</p>
        <span>© 2026 小蓝君表情研究所 · MADE WITH ♡</span>
      </footer>

      {pendingStickers.length > 0 && (
        <div className="modal-backdrop">
          <section
            className="editor-modal batch-editor"
            role="dialog"
            aria-modal="true"
            aria-labelledby="upload-editor-title"
          >
            <header className="editor-header">
              <div>
                <span className="section-kicker">NEW STICKERS</span>
                <h2 id="upload-editor-title">给新表情登记一下 <span>✦</span></h2>
                <p>选好名字、心情类别和背景色，它们就会住进表情馆。</p>
              </div>
              <button
                className="modal-close"
                type="button"
                aria-label="关闭上传编辑器"
                disabled={isSaving}
                onClick={() => setPendingStickers([])}
              >
                ×
              </button>
            </header>

            <div className="batch-editor-list">
              {pendingStickers.map((sticker, index) => (
                <article className={`editor-item ${sticker.tone}`} key={sticker.id}>
                  <div className="editor-preview">
                    <span>NEW {index + 1}</span>
                    <img src={sticker.dataUrl} alt={`${sticker.name}预览`} />
                    <small>{sticker.category}</small>
                  </div>
                  <StickerFields
                    sticker={sticker}
                    nameId={`pending-name-${sticker.id}`}
                    onChange={(changes) => updatePendingSticker(sticker.id, changes)}
                  />
                </article>
              ))}
            </div>

            <footer className="editor-footer">
              <span>共 {pendingStickers.length} 张 · 保存后仍可随时编辑</span>
              <div>
                <button
                  className="secondary-action"
                  type="button"
                  disabled={isSaving}
                  onClick={() => setPendingStickers([])}
                >
                  暂不添加
                </button>
                <button
                  className="save-action"
                  type="button"
                  disabled={isSaving}
                  onClick={() => void confirmPendingStickers()}
                >
                  {isSaving ? "正在收藏…" : `加入表情馆 · ${pendingStickers.length}`}
                </button>
              </div>
            </footer>
          </section>
        </div>
      )}

      {editingPublicSticker && (
        <div className="modal-backdrop">
          <section
            className="editor-modal single-editor public-editor"
            role="dialog"
            aria-modal="true"
            aria-labelledby="public-sticker-editor-title"
          >
            <header className="editor-header">
              <div>
                <span className="section-kicker">EDIT PUBLIC SAMPLE</span>
                <h2 id="public-sticker-editor-title">管理公开示例 <span>✎</span></h2>
                <p>修改后会立即影响表情馆预览、单张下载和整套 ZIP 的内容。</p>
              </div>
              <button
                className="modal-close"
                type="button"
                aria-label="关闭公开示例编辑器"
                disabled={isSaving}
                onClick={() => setEditingPublicSticker(null)}
              >
                ×
              </button>
            </header>

            <div className="single-editor-layout">
              <div className={`live-preview ${editingPublicSticker.tone}`}>
                <div className="live-preview-image">
                  <img
                    src={editingPublicSticker.dataUrl}
                    alt={`${editingPublicSticker.name}公开示例预览`}
                    style={{ objectPosition: editingPublicSticker.position }}
                  />
                  <span>{editingPublicSticker.category}</span>
                  <i>{editingPublicSticker.caption}</i>
                </div>
                <strong>{editingPublicSticker.name || "未命名表情"}</strong>
                <button
                  type="button"
                  className="replace-image-button"
                  onClick={() => publicReplaceInputRef.current?.click()}
                >
                  ↻ 替换示例图片
                </button>
                <input
                  ref={publicReplaceInputRef}
                  className="visually-hidden-input"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={(event) => void replacePublicStickerImage(event)}
                  aria-label="替换公开示例图片"
                />
              </div>
              <div className="public-editor-fields">
                <StickerFields
                  sticker={editingPublicSticker}
                  nameId="editing-public-sticker-name"
                  onChange={(changes) =>
                    setEditingPublicSticker((current) =>
                      current ? { ...current, ...changes } : current,
                    )
                  }
                />
                <label className="caption-field" htmlFor="editing-public-caption">
                  <span>表情气泡文字</span>
                  <input
                    id="editing-public-caption"
                    maxLength={12}
                    value={editingPublicSticker.caption}
                    placeholder="例如：贴贴～"
                    onChange={(event) =>
                      setEditingPublicSticker((current) =>
                        current ? { ...current, caption: event.target.value } : current,
                      )
                    }
                  />
                  <small>{editingPublicSticker.caption.length}/12</small>
                </label>
              </div>
            </div>

            <footer className="editor-footer edit-footer">
              <button
                className="danger-action"
                type="button"
                disabled={isSaving}
                onClick={() => void deletePublicSticker(editingPublicSticker)}
              >
                删除这张公开示例
              </button>
              <div>
                <button
                  className="secondary-action"
                  type="button"
                  disabled={isSaving}
                  onClick={() => setEditingPublicSticker(null)}
                >
                  取消
                </button>
                <button
                  className="save-action"
                  type="button"
                  disabled={isSaving}
                  onClick={() => void savePublicStickerEdits()}
                >
                  {isSaving ? "正在保存…" : "保存示例修改 ✓"}
                </button>
              </div>
            </footer>
          </section>
        </div>
      )}

      {editingSticker && (
        <div className="modal-backdrop">
          <section
            className="editor-modal single-editor"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sticker-editor-title"
          >
            <header className="editor-header">
              <div>
                <span className="section-kicker">EDIT STICKER</span>
                <h2 id="sticker-editor-title">编辑这张表情 <span>✎</span></h2>
                <p>换个名字、心情分类、卡片背景，或直接替换图片。</p>
              </div>
              <button
                className="modal-close"
                type="button"
                aria-label="关闭表情编辑器"
                disabled={isSaving}
                onClick={() => setEditingSticker(null)}
              >
                ×
              </button>
            </header>

            <div className="single-editor-layout">
              <div className={`live-preview ${editingSticker.tone}`}>
                <div className="live-preview-image">
                  <img src={editingSticker.dataUrl} alt={`${editingSticker.name}编辑预览`} />
                  <span>{editingSticker.category}</span>
                </div>
                <strong>{editingSticker.name || "未命名表情"}</strong>
                <button
                  type="button"
                  className="replace-image-button"
                  onClick={() => replaceInputRef.current?.click()}
                >
                  ↻ 替换图片
                </button>
                <input
                  ref={replaceInputRef}
                  className="visually-hidden-input"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={(event) => void replaceStickerImage(event)}
                  aria-label="替换表情图片"
                />
              </div>
              <StickerFields
                sticker={editingSticker}
                nameId="editing-sticker-name"
                onChange={(changes) =>
                  setEditingSticker((current) =>
                    current ? { ...current, ...changes } : current,
                  )
                }
              />
            </div>

            <footer className="editor-footer edit-footer">
              <button
                className="danger-action"
                type="button"
                disabled={isSaving}
                onClick={() =>
                  void deleteSticker(editingSticker.id, editingSticker.name)
                }
              >
                删除这张表情
              </button>
              <div>
                <button
                  className="secondary-action"
                  type="button"
                  disabled={isSaving}
                  onClick={() => setEditingSticker(null)}
                >
                  取消
                </button>
                <button
                  className="save-action"
                  type="button"
                  disabled={isSaving}
                  onClick={() => void saveStickerEdits()}
                >
                  {isSaving ? "正在保存…" : "保存修改 ✓"}
                </button>
              </div>
            </footer>
          </section>
        </div>
      )}

      {toast && (
        <div className="toast" role="status" aria-live="polite">
          <span aria-hidden="true">蓝</span> {toast}
        </div>
      )}
    </main>
  );
}
