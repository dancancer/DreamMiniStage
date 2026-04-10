import { WorldBookOperations } from "@/lib/data/roleplay/world-book-operation";

export interface GlobalWorldBookMetadata {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
  entryCount: number;
  tags?: string[];
}

export async function listClientGlobalWorldBooks(): Promise<GlobalWorldBookMetadata[]> {
  try {
    const globalKeys = await WorldBookOperations.getWorldBookKeysByPrefix("global:");
    const books: GlobalWorldBookMetadata[] = [];

    for (const key of globalKeys) {
      const settings = await WorldBookOperations.getWorldBookSettings(key);
      if (settings.metadata) {
        books.push(settings.metadata as GlobalWorldBookMetadata);
      }
    }

    return books.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch (error) {
    console.error("[GlobalWB:client] Failed to list global world books:", error);
    return [];
  }
}

export async function createClientGlobalWorldBook(
  name: string,
  description?: string,
): Promise<{ success: boolean; globalKey: string; error?: string }> {
  try {
    if (!name.trim()) {
      return { success: false, globalKey: "", error: "名称不能为空" };
    }

    const timestamp = Date.now();
    const random = Math.random().toString(36).slice(2, 8);
    const globalKey = `global:${timestamp}_${random}`;

    await WorldBookOperations.updateWorldBook(globalKey, {});
    await WorldBookOperations.updateWorldBookSettings(globalKey, {
      enabled: true,
      maxEntries: 100,
      contextWindow: 5,
      metadata: {
        id: globalKey,
        name: name.trim(),
        description: description?.trim(),
        enabled: true,
        createdAt: timestamp,
        updatedAt: timestamp,
        entryCount: 0,
      } satisfies GlobalWorldBookMetadata,
    });

    return { success: true, globalKey };
  } catch (error) {
    console.error("[GlobalWB:client] Failed to create global world book:", error);
    return {
      success: false,
      globalKey: "",
      error: error instanceof Error ? error.message : "创建失败",
    };
  }
}

export async function deleteClientGlobalWorldBook(
  globalKey: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!globalKey.startsWith("global:")) {
      return { success: false, error: "无效的全局世界书键" };
    }

    const success = await WorldBookOperations.deleteWorldBook(globalKey);
    return success
      ? { success: true }
      : { success: false, error: "世界书不存在或删除失败" };
  } catch (error) {
    console.error("[GlobalWB:client] Failed to delete global world book:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "删除失败",
    };
  }
}

export async function toggleClientGlobalWorldBook(
  globalKey: string,
  enabled: boolean,
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!globalKey.startsWith("global:")) {
      return { success: false, error: "无效的全局世界书键" };
    }

    const settings = await WorldBookOperations.getWorldBookSettings(globalKey);
    if (!settings.metadata) {
      return { success: false, error: "元数据不存在" };
    }

    await WorldBookOperations.updateWorldBookSettings(globalKey, {
      enabled,
      metadata: {
        ...(settings.metadata as GlobalWorldBookMetadata),
        enabled,
        updatedAt: Date.now(),
      },
    });

    return { success: true };
  } catch (error) {
    console.error("[GlobalWB:client] Failed to toggle global world book:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "操作失败",
    };
  }
}
