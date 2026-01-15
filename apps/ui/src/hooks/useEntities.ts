import { useQuery } from "@tanstack/react-query";
import {
  getEntities,
  getEntityBookmarks,
  type Entity,
  type EntityType,
  type EntityBookmark,
} from "~/lib/api";

export function useEntities(type?: EntityType) {
  return useQuery({
    queryKey: ["entities", type],
    queryFn: async () => {
      const response = await getEntities(type);
      if (!response.success) {
        throw new Error("Failed to fetch entities");
      }
      return {
        entities: response.data.entities,
        total: response.data.total,
      };
    },
  });
}

export function useEntityBookmarks(entityId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["entityBookmarks", entityId],
    queryFn: async () => {
      if (!entityId) throw new Error("Entity ID required");
      const response = await getEntityBookmarks(entityId);
      if (!response.success) {
        throw new Error("Failed to fetch entity bookmarks");
      }
      return {
        entity: response.data.entity,
        bookmarks: response.data.bookmarks,
        total: response.data.total,
      };
    },
    enabled: enabled && !!entityId,
  });
}

export type { Entity, EntityType, EntityBookmark };
