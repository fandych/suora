import { defineConfig } from "drizzle-kit"

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/drizzle/schema/**/*.ts",
  out: "./src/drizzle/migrations",
  strict: true,
  verbose: true,
})
