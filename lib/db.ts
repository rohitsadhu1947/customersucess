import { neon } from "@neondatabase/serverless"

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required")
}

// Create a reusable SQL client
export const sql = neon(process.env.DATABASE_URL)

// Example function to test the connection
export async function testConnection() {
  try {
    const result = await sql`SELECT version()`
    console.log("Database connected successfully:", result[0].version)
    return true
  } catch (error) {
    console.error("Database connection failed:", error)
    return false
  }
}

// Function to get all tables in the database
export async function getTables() {
  try {
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `
    return tables.map((table) => table.table_name)
  } catch (error) {
    console.error("Error fetching tables:", error)
    throw error
  }
}
