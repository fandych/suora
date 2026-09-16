import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

export const chats = sqliteTable("chats", {
  id: text("id").primaryKey(), title: text("title").notNull(), chatbotId: text("chatbot_id").notNull(), summary: text("summary").notNull().default(""), sourceType: text("source_type").notNull().default("manual"), sourceRef: text("source_ref"), updatedAt: integer("updated_at", { mode: "number" }).notNull(),
})

export const chatMessages = sqliteTable("chat_messages", {
  id: text("id").primaryKey(), chatId: text("chat_id").notNull(), role: text("role").notNull(), content: text("content").notNull(), partsJson: text("parts_json").notNull().default("[]"), createdAt: integer("created_at", { mode: "number" }).notNull(),
})
